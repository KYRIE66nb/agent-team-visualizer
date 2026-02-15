import type { AgentRef, TeamEvent } from "./types";

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function agentsInRun(events: TeamEvent[]): AgentRef[] {
  const m = new Map<string, AgentRef>();
  for (const e of events) {
    if (e.type === "message") {
      m.set(e.from.id, e.from);
      m.set(e.to.id, e.to);
    } else if (e.type === "artifact") {
      m.set(e.producer.id, e.producer);
    } else {
      m.set(e.agent.id, e.agent);
    }
  }
  return [...m.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function leaderGoalZh(events: TeamEvent[]): string | null {
  // Pull from leader_plan or from instruction messages.
  for (const e of events) {
    if (e.type !== "message") continue;
    if (e.from.role !== "lead") continue;
    const goal = (e.meta as any)?.leader_plan?.goal_zh;
    if (goal) return String(goal);
  }
  const instructionMsgs = events.filter((e) => e.type === "message" && e.channel === "instruction") as any[];
  if (instructionMsgs.length) {
    const last = instructionMsgs[instructionMsgs.length - 1];
    return (last.content_zh ?? last.content ?? null) ? `领导指令：${(last.content_zh ?? last.content).toString().slice(0, 60)}` : null;
  }
  return null;
}

export function leaderPlanZh(events: TeamEvent[]): string {
  const plans: any[] = [];
  for (const e of events) {
    if (e.type !== "message") continue;
    if (e.from.role !== "lead") continue;
    const plan = (e.meta as any)?.leader_plan;
    if (plan) plans.push({ ts: e.ts, stage: e.stage, plan });
  }
  if (!plans.length) return "(未提供 leader_plan)";

  const p = plans[plans.length - 1];
  const goal = p.plan.goal_zh ? `目标：${p.plan.goal_zh}` : "";
  const delivs = Array.isArray(p.plan.deliverables_zh) && p.plan.deliverables_zh.length
    ? `交付物：${p.plan.deliverables_zh.join("；")}`
    : "";
  const miles = Array.isArray(p.plan.milestones_zh) && p.plan.milestones_zh.length
    ? `里程碑：${p.plan.milestones_zh.map((x: any) => `${x.done ? "[x]" : "[ ]"} ${x.name}`).join("；")}`
    : "";

  return [goal, delivs, miles].filter(Boolean).join("\n");
}

export function taskBreakdownZh(events: TeamEvent[]): string {
  const all: any[] = [];
  for (const e of events) {
    if (e.type !== "message") continue;
    const items = (e.meta as any)?.task_breakdown_zh;
    if (Array.isArray(items) && items.length) {
      all.push({ ts: e.ts, stage: e.stage, items });
    }
  }
  if (!all.length) return "(未提供 task_breakdown_zh)";

  const last = all[all.length - 1];
  const rows = last.items
    .map((it: any) => `- ${it.id ?? "?"}：${it.title ?? ""}（owner=${it.owner ?? "?"}）\n  验收：${it.acceptance ?? ""}`)
    .join("\n");
  return `任务拆解（${last.stage ?? ""} ${last.ts}）\n${rows}`.trim();
}

export function agentNarrativeZh(events: TeamEvent[], agentId: string): string {
  const related = events.filter((e) => {
    if (e.type === "message") return e.from.id === agentId || e.to.id === agentId;
    if (e.type === "artifact") return e.producer.id === agentId;
    return e.agent.id === agentId;
  });
  related.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  const statusEvents = related.filter((e) => e.type === "agent_status") as any[];
  const lastStatus = statusEvents.length ? statusEvents[statusEvents.length - 1] : null;

  const tasks = related.filter((e) => e.type === "task") as any[];
  const done = tasks.filter((t) => t.status === "done").length;
  const running = tasks.filter((t) => t.status === "running").length;
  const failed = tasks.filter((t) => t.status === "failed").length;

  const artifacts = related.filter((e) => e.type === "artifact") as any[];
  const artLines = artifacts.slice(-5).map((a) => {
    const t = (a.title_zh ?? a.title ?? "").toString();
    const s = (a.summary_zh ?? a.summary ?? "").toString();
    return s ? `- ${t}\n  ${s}` : `- ${t}`;
  });

  const instrIn = related.filter((e) => e.type === "message" && e.to.id === agentId && e.channel === "instruction") as any[];
  const instrLines = instrIn.slice(-5).map((m) => `- ${(m.content_zh ?? m.content ?? "").toString()}`);

  const stages = uniq(related.map((e) => e.stage).filter(Boolean) as string[]);

  return [
    `当前状态：${lastStatus ? lastStatus.status.state : "(未知)"}`,
    lastStatus?.status.current_task ? `当前任务：${lastStatus.status.current_task}` : null,
    lastStatus?.status.summary_zh ? `说明：${lastStatus.status.summary_zh}` : null,
    stages.length ? `涉及阶段：${stages.join("、")}` : null,
    `任务统计：完成 ${done}，进行中 ${running}，失败 ${failed}`,
    "\n收到的领导指令：\n" + (instrLines.length ? instrLines.join("\n") : "(无)"),
    "\n阶段产出：\n" + (artLines.length ? artLines.join("\n") : "(无)"),
  ]
    .filter(Boolean)
    .join("\n");
}
