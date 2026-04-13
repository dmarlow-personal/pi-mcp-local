import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import os from "node:os";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GPU_BUSY_PATH = process.env.GPU_BUSY_PATH || "/sys/class/drm/card0/device/gpu_busy_percent";

let defaultThinkingLevel: string | null = null;
try {
  const settingsPath = resolve(os.homedir(), ".pi/agent/settings.json");
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  defaultThinkingLevel = settings.defaultThinkingLevel || null;
} catch { /* no settings file */ }

export default function (pi: ExtensionAPI) {
  let intervalId: NodeJS.Timeout | null = null;
  let cpuPct = 0;
  let gpuPct = 0;
  let memPct = 0;

  const sample = () => {
    memPct = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    cpuPct = Math.min((os.loadavg()[0] / os.cpus().length) * 100, 100);
    try { gpuPct = parseInt(readFileSync(GPU_BUSY_PATH, "utf8"), 10) || 0; } catch { gpuPct = 0; }
  };

  function formatTokens(n: number): string {
    if (n < 1000) return n.toString();
    if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
    if (n < 1000000) return `${Math.round(n / 1000)}k`;
    return `${(n / 1000000).toFixed(1)}M`;
  }

  const installFooter = (ctx: any) => {
    if (!ctx.hasUI) return;

    ctx.ui.setFooter((tui: any, theme: any, footerData: any) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          try {
          // --- Line 1: pwd + git branch + session name ---
          let pwd = ctx.sessionManager?.getCwd?.() || process.cwd();
          const home = process.env.HOME || process.env.USERPROFILE;
          if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`;
          const branch = footerData.getGitBranch();
          if (branch) pwd = `${pwd} (${branch})`;
          const sessionName = ctx.sessionManager?.getSessionName?.();
          if (sessionName) pwd = `${pwd} \u2022 ${sessionName}`;
          const pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));

          // --- Line 2: left stats | center monitor | right model ---

          // Left: token stats + context
          let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCost = 0;
          for (const entry of ctx.sessionManager.getEntries()) {
            if (entry.type === "message" && entry.message.role === "assistant") {
              const m = entry.message as AssistantMessage;
              totalInput += m.usage.input;
              totalOutput += m.usage.output;
              totalCacheRead += m.usage.cacheRead;
              totalCost += m.usage.cost.total;
            }
          }

          const contextUsage = ctx.getContextUsage?.();
          const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
          const contextPctVal = contextUsage?.percent ?? 0;
          const contextPctStr = contextUsage?.percent !== null ? `${contextPctVal.toFixed(1)}%` : "?";
          let contextDisplay = `${contextPctStr}/${formatTokens(contextWindow)}`;
          if (contextPctVal > 90) contextDisplay = theme.fg("error", contextDisplay);
          else if (contextPctVal > 70) contextDisplay = theme.fg("warning", contextDisplay);

          const leftParts: string[] = [];
          if (totalInput) leftParts.push(`\u2191${formatTokens(totalInput)}`);
          if (totalOutput) leftParts.push(`\u2193${formatTokens(totalOutput)}`);
          if (totalCacheRead) leftParts.push(`R${formatTokens(totalCacheRead)}`);
          if (totalCost) leftParts.push(`$${totalCost.toFixed(3)}`);
          leftParts.push(contextDisplay);
          const leftText = leftParts.join(" ");

          // Right: model name
          const modelName = ctx.model?.id || "no-model";
          let rightText = modelName;
          if (ctx.model?.reasoning) {
            const tl = ctx.sessionManager?.state?.thinkingLevel || defaultThinkingLevel;
            if (tl && tl !== "off") rightText = `${modelName} \u2022 ${tl}`;
          }
          if (footerData.getAvailableProviderCount?.() > 1 && ctx.model) {
            const candidate = `(${ctx.model.provider}) ${rightText}`;
            if (visibleWidth(leftText) + 2 + visibleWidth(candidate) <= width) rightText = candidate;
          }

          // Center: sys monitor
          const bar = (pct: number) => {
            const w = 8, f = Math.round((w * pct) / 100);
            let inner = "";
            for (let i = 0; i < w; i++) {
              inner += theme.fg("dim", i < f ? "\u2588" : "\u2591");
            }
            return theme.fg("dim", "\u2595") + inner + theme.fg("dim", "\u258f");
          };
          const centerText =
            theme.fg("dim", "cpu ") + bar(cpuPct) + theme.fg("dim", ` ${cpuPct.toFixed(0).padStart(3)}%`) +
            theme.fg("dim", "  ") +
            theme.fg("dim", "gpu ") + bar(gpuPct) + theme.fg("dim", ` ${gpuPct.toFixed(0).padStart(3)}%`) +
            theme.fg("dim", "  ") +
            theme.fg("dim", "ram ") + bar(memPct) + theme.fg("dim", ` ${memPct.toFixed(0).padStart(3)}%`);

          const lw = visibleWidth(leftText);
          const rw = visibleWidth(rightText);
          const cw = visibleWidth(centerText);

          const dimLeft = theme.fg("dim", leftText);
          const dimRight = theme.fg("dim", rightText);
          const totalNeeded = lw + 2 + cw + 2 + rw;

          let statsLine: string;
          if (totalNeeded <= width) {
            const totalPad = width - lw - cw - rw;
            const padLeft = Math.floor(totalPad / 2);
            const padRight = totalPad - padLeft;
            statsLine = dimLeft + " ".repeat(padLeft) + centerText + " ".repeat(padRight) + dimRight;
          } else if (lw + 2 + rw <= width) {
            statsLine = dimLeft + " ".repeat(width - lw - rw) + dimRight;
          } else {
            statsLine = truncateToWidth(dimLeft, width, theme.fg("dim", "..."));
          }

          // --- Line 3: extension statuses (if any, excluding ours) ---
          const lines = [pwdLine, statsLine];
          const extensionStatuses = footerData.getExtensionStatuses();
          if (extensionStatuses.size > 0) {
            const sorted = Array.from(extensionStatuses.entries())
              .sort(([a]: [string, string], [b]: [string, string]) => a.localeCompare(b))
              .map(([, text]: [string, string]) => text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim());
            if (sorted.length > 0) {
              lines.push(truncateToWidth(sorted.join(" "), width, theme.fg("dim", "...")));
            }
          }

          return lines;
          } catch { return []; }
        },
      };
    });
  };

  pi.on("session_start", async (_event, ctx) => {
    if (intervalId) clearInterval(intervalId);
    sample();
    installFooter(ctx);
    intervalId = setInterval(() => { sample(); }, 3000);
  });

  pi.on("session_shutdown", async () => {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  });
}