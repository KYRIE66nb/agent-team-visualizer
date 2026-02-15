export type AgentRef = {
  id: string;
  name: string;
};

export type EventCommon = {
  id: string;
  ts: string;
  type: "message" | "artifact" | "task";
  run_id?: string;
  stage?: string;
  meta?: Record<string, unknown>;
};

export type MessageEvent = EventCommon & {
  type: "message";
  from: AgentRef;
  to: AgentRef;
  content: string;
  channel?: string;
  thread_id?: string;
};

export type ArtifactEvent = EventCommon & {
  type: "artifact";
  producer: AgentRef;
  title: string;
  summary?: string;
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

export type TeamEvent = MessageEvent | ArtifactEvent | TaskEvent;
