export type AgentRef = {
  id: string;
  name: string;
  role?: string;
};

export type EventCommon = {
  id: string;
  ts: string;
  type: "message" | "artifact" | "task" | "agent_status";
  run_id?: string;
  stage?: string;
  lang?: string;
  meta?: Record<string, unknown>;
};

export type MessageEvent = EventCommon & {
  type: "message";
  from: AgentRef;
  to: AgentRef;
  content: string;
  content_zh?: string;
  channel?: string;
  thread_id?: string;
};

export type ArtifactEvent = EventCommon & {
  type: "artifact";
  producer: AgentRef;
  title: string;
  title_zh?: string;
  summary?: string;
  summary_zh?: string;
  uri?: string;
  content?: string;
};

export type TaskEvent = EventCommon & {
  type: "task";
  agent: AgentRef;
  task_id: string;
  title: string;
  status: "queued" | "running" | "done" | "failed";
  result?: string;
};

export type AgentStatusEvent = EventCommon & {
  type: "agent_status";
  agent: AgentRef;
  status: {
    state: "idle" | "busy" | "waiting" | "blocked";
    stage?: string;
    current_task?: string;
    summary_zh?: string;
  };
};

export type TeamEvent = MessageEvent | ArtifactEvent | TaskEvent | AgentStatusEvent;
