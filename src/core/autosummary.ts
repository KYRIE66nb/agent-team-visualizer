import type { ArtifactEvent, TeamEvent } from "./types";

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function generateStageSummaries(events: TeamEvent[]): ArtifactEvent[] {
  const stages = uniq(events.map((e) => e.stage).filter(Boolean) as string[]);
  const out: ArtifactEvent[] = [];

  for (const stage of stages) {
    const stageEvents = events.filter((e) => (e.stage ?? "") === stage);
    const tasks = stageEvents.filter((e) => e.type === "task") as any[];
    if (tasks.length === 0) continue;

    const done = tasks.filter((t) => t.status === "done").length;
    const running = tasks.filter((t) => t.status === "running").length;
    const failed = tasks.filter((t) => t.status === "failed").length;

    const owners = uniq(tasks.map((t) => t.agent?.name ?? t.agent?.id).filter(Boolean));
    const topTitles = tasks
      .slice()
      .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
      .slice(0, 3)
      .map((t) => t.title)
      .filter(Boolean);

    const lastTs = stageEvents
      .slice()
      .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))[0]?.ts;

    const summaryZh = [
      `阶段：${stage}`,
      `任务：完成 ${done}，进行中 ${running}，失败 ${failed}`,
      owners.length ? `涉及：${owners.join("、")}` : null,
      topTitles.length ? `近期任务：${topTitles.join("；")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      id: `gen_${stage}`,
      ts: lastTs ?? new Date().toISOString(),
      type: "artifact",
      stage,
      producer: { id: "visualizer", name: "Visualizer", role: "system" },
      title: `Stage summary (${stage})`,
      title_zh: `阶段总结（${stage}）`,
      summary_zh: summaryZh,
      meta: { generated_by: "visualizer", generated_kind: "stage_summary" },
    });
  }

  return out;
}
