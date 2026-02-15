import type { TeamEvent } from "./types";

export function parseJsonl(text: string): TeamEvent[] {
  const events: TeamEvent[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw) as TeamEvent;
      events.push(obj);
    } catch (e) {
      throw new Error(`Invalid JSONL at line ${i + 1}: ${String(e)}`);
    }
  }
  return events;
}

export function sortByTs(events: TeamEvent[]): TeamEvent[] {
  return [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}
