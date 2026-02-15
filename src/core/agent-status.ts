import type { TeamEvent } from "./types";

export type AgentRuntimeStatus = {
  state: "idle" | "busy" | "waiting" | "blocked";
  stage?: string;
  current_task?: string;
  summary_zh?: string;
};

export type AgentStatusEvent = {
  id: string;
  ts: string;
  type: "agent_status";
  stage?: string;
  agent: { id: string; name: string; role?: string };
  status: AgentRuntimeStatus;
  meta?: Record<string, unknown>;
};

export function isAgentStatusEvent(e: TeamEvent | any): e is AgentStatusEvent {
  return e && typeof e === "object" && e.type === "agent_status";
}

export function latestAgentRuntimeStatus(events: any[]): Map<string, AgentStatusEvent> {
  const m = new Map<string, AgentStatusEvent>();
  for (const e of events) {
    if (!isAgentStatusEvent(e)) continue;
    const prev = m.get(e.agent.id);
    if (!prev || prev.ts < e.ts) m.set(e.agent.id, e);
  }
  return m;
}
