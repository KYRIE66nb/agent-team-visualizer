import type { MessageEvent, TeamEvent } from "./types";

export type ThreadView = {
  threadId: string;
  title: string;
  messages: MessageEvent[];
  participants: string[];
  firstTs: string;
  lastTs: string;
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function buildThreads(events: TeamEvent[]): ThreadView[] {
  const msgs = events.filter((e) => e.type === "message") as MessageEvent[];
  const byThread = new Map<string, MessageEvent[]>();

  for (const m of msgs) {
    const tid = m.thread_id ?? `__no_thread__:${m.from.id}->${m.to.id}`;
    const arr = byThread.get(tid) ?? [];
    arr.push(m);
    byThread.set(tid, arr);
  }

  const threads: ThreadView[] = [];
  for (const [threadId, messages] of byThread.entries()) {
    messages.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    const participants = uniq(messages.flatMap((m) => [m.from.id, m.to.id]));
    const firstTs = messages[0]?.ts ?? "";
    const lastTs = messages[messages.length - 1]?.ts ?? "";
    const title = `${participants.join(" ↔ ")} (${messages.length})`;
    threads.push({ threadId, title, messages, participants, firstTs, lastTs });
  }

  threads.sort((a, b) => (a.lastTs < b.lastTs ? 1 : a.lastTs > b.lastTs ? -1 : 0));
  return threads;
}
