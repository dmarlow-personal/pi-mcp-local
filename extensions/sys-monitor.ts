import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import os from "node:os";

export default function (pi: ExtensionAPI) {
  let intervalId: NodeJS.Timeout | null = null;
  let cpuPct = 0;
  let memPct = 0;

  const sample = () => {
    memPct = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    cpuPct = Math.min((os.loadavg()[0] / os.cpus().length) * 100, 100);
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
            const tl = ctx.sessionManager?.state?.thinkingLevel || "off";
            rightText = tl === "off" ? `${modelName} \u2022 thinking off` : `${modelName} \u2022 ${tl}`;
          }
          if (footerData.getAvailableProviderCount?.() > 1 && ctx.model) {
            const candidate = `(${ctx.model.provider}) ${rightText}`;
            if (visibleWidth(leftText) + 2 + visibleWidth(candidate) <= width) rightText = candidate;
          }

          // Center: sys monitor
          const bar = (pct: number) => {
            const w = 8, f = Math.round((w * pct) / 100);
            const fillColor = pct > 90 ? "error" : pct > 70 ? "warning" : "muted";
            const emptyColor = "dim";
            const capColor = "dim";
            let inner = "";
            for (let i = 0; i < w; i++) {
              const segPct = ((i + 1) / w) * 100;
              if (i < f) {
                const c = segPct > 90 ? "error" : segPct > 70 ? "warning" : fillColor;
                inner += theme.fg(c, "\u2588");
              } else {
                inner += theme.fg(emptyColor, "\u2591");
              }
            }
            return theme.fg(capColor, "\u2595") + inner + theme.fg(capColor, "\u258f");
          };
          const centerText =
            theme.fg("dim", "cpu ") + bar(cpuPct) + theme.fg("dim", ` ${cpuPct.toFixed(0).padStart(3)}%`) +
            theme.fg("dim", "  ") +
            theme.fg("dim", "ram ") + bar(memPct) + theme.fg("dim", ` ${memPct.toFixed(0).padStart(3)}%`);

          const lw = visibleWidth(leftText);
          const rw = visibleWidth(rightText);
          const cw = visibleWidth(centerText);

          let statsLine: string;
          const totalNeeded = lw + 2 + cw + 2 + rw;

          if (totalNeeded <= width) {
            // All three fit: left ... center ... right
            const totalPad = width - lw - cw - rw;
            const padLeft = Math.floor(totalPad / 2);
            const padRight = totalPad - padLeft;
            statsLine = leftText + " ".repeat(padLeft) + centerText + " ".repeat(padRight) + rightText;
          } else if (lw + 2 + rw <= width) {
            // No room for center, fall back to default left...right
            const padding = " ".repeat(width - lw - rw);
            statsLine = leftText + padding + rightText;
          } else {
            statsLine = truncateToWidth(leftText, width, "...");
          }

          const dimLeft = theme.fg("dim", leftText);
          const dimRight = theme.fg("dim", rightText);

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