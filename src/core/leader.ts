import type { TeamEvent } from "./types";

type LeaderPlan = {
  goal_zh?: string;
  deliverables_zh?: string[];
  milestones_zh?: { name: string; done?: boolean }[];
};

type TaskBreakdownItem = {
  id?: string;
  owner?: string;
  title?: string;
  acceptance?: string;
};

export function isLeaderAgentId(events: TeamEvent[], agentId: string): boolean {
  // Default rule per user choice: meta.role === "lead" (via agent.role)
  for (const e of events) {
    if (e.type === "message") {
      if (e.from.id === agentId && e.from.role === "lead") return true;
      if (e.to.id === agentId && e.to.role === "lead") return true;
    } else if (e.type === "artifact") {
      if (e.producer.id === agentId && e.producer.role === "lead") return true;
    } else {
      if (e.agent.id === agentId && e.agent.role === "lead") return true;
    }
  }
  return false;
}

export function extractLeaderPlans(events: TeamEvent[]): { ts: string; stage?: string; plan: LeaderPlan; rawId: string }[] {
  const res: { ts: string; stage?: string; plan: LeaderPlan; rawId: string }[] = [];
  for (const e of events) {
    if (e.type !== "message") continue;
    if (e.from.role !== "lead") continue;
    const plan = (e.meta as any)?.leader_plan as LeaderPlan | undefined;
    if (!plan) continue;
    res.push({ ts: e.ts, stage: e.stage, plan, rawId: e.id });
  }
  return res;
}

export function extractTaskBreakdowns(events: TeamEvent[]): { ts: string; stage?: string; items: TaskBreakdownItem[]; rawId: string }[] {
  const res: { ts: string; stage?: string; items: TaskBreakdownItem[]; rawId: string }[] = [];
  for (const e of events) {
    if (e.type !== "message") continue;
    // Task breakdown can be produced by leader or planner.
    const items = (e.meta as any)?.task_breakdown_zh as TaskBreakdownItem[] | undefined;
    if (!items || !Array.isArray(items)) continue;
    res.push({ ts: e.ts, stage: e.stage, items, rawId: e.id });
  }
  return res;
}
