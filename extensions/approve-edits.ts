import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const gatedTools = ["edit", "write", "bash"];
  const autoAccept = process.env.PI_AUTO_ACCEPT === "1";

  pi.on("tool_call", async (event, ctx) => {
    if (!gatedTools.includes(event.toolName)) return undefined;
    if (autoAccept) return undefined;
    if (!ctx.hasUI) return { block: true, reason: "No UI for approval" };

    let summary = event.toolName;
    if (event.toolName === "bash") {
      summary = `bash: ${(event.input as any).command}`;
    } else {
      summary = `${event.toolName}: ${(event.input as any).file_path || (event.input as any).filePath || ""}`;
    }

    const choice = await ctx.ui.select(`Approve?\n\n  ${summary}`, ["Yes", "No"]);
    if (choice !== "Yes") return { block: true, reason: "Blocked by user" };
    return undefined;
  });
}
