import type { TeamEvent } from "./types";

export function runTitleZh(events: TeamEvent[], runId: string): string {
  for (const e of events) {
    if ((e.run_id ?? "default") !== runId) continue;
    const t = (e.meta as any)?.run_title_zh;
    if (t) return String(t);
    const inline = (e as any).run_title_zh;
    if (inline) return String(inline);
  }
  return runId === "default" ? "默认记录" : `运行 ${runId}`;
}
