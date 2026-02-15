import type { TeamEvent } from "./types";

export type Flag = {
  level: "risk" | "warn";
  titleZh: string;
  detailZh?: string;
};

export function computeFlags(events: TeamEvent[]): Flag[] {
  const flags: Flag[] = [];

  // 1) Any failed tasks.
  const failedTasks = events.filter((e) => e.type === "task" && e.status === "failed") as any[];
  if (failedTasks.length) {
    flags.push({
      level: "risk",
      titleZh: `存在失败任务：${failedTasks.length} 个`,
      detailZh: failedTasks
        .slice(-5)
        .map((t) => `${t.agent?.name ?? t.agent?.id}：${t.title}`)
        .join("；"),
    });
  }

  // 2) Blocked agent status.
  const blocked = events.filter((e) => e.type === "agent_status" && e.status?.state === "blocked") as any[];
  if (blocked.length) {
    flags.push({
      level: "risk",
      titleZh: `存在 blocked 状态：${blocked.length} 条`,
      detailZh: blocked
        .slice(-5)
        .map((s) => `${s.agent?.name ?? s.agent?.id}：${s.status?.summary_zh ?? ""}`)
        .join("；"),
    });
  }

  // 3) Missing leader plan.
  const hasLeaderPlan = events.some(
    (e) => e.type === "message" && (e as any).from?.role === "lead" && (e.meta as any)?.leader_plan?.goal_zh
  );
  if (!hasLeaderPlan) {
    flags.push({
      level: "warn",
      titleZh: "缺少领导规划（leader_plan）",
      detailZh: "建议 leader 在 planning 阶段上报 meta.leader_plan.goal_zh / deliverables_zh / milestones_zh。",
    });
  }

  // 4) No per-agent stage artifact summaries.
  const hasAgentArtifacts = events.some((e) => e.type === "artifact" && !!(e as any).summary_zh);
  if (!hasAgentArtifacts) {
    flags.push({
      level: "warn",
      titleZh: "缺少阶段性中文回报（artifact.summary_zh）",
      detailZh: "建议每个 agent 在阶段结束时产出一条 artifact，并填 summary_zh。",
    });
  }

  return flags;
}
