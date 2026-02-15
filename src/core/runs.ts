import type { TeamEvent } from "./types";
import { runTitleZh } from "./run-meta";

export type RunRecord = {
  runId: string;
  titleZh: string;
  startTs?: string;
  endTs?: string;
  events: TeamEvent[];
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function splitRuns(events: TeamEvent[]): RunRecord[] {
  const runIds = uniq(events.map((e) => e.run_id).filter(Boolean) as string[]);
  if (runIds.length === 0) {
    const sorted = events.slice().sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    return [
      {
        runId: "default",
        titleZh: "默认记录",
        startTs: sorted[0]?.ts,
        endTs: sorted[sorted.length - 1]?.ts,
        events: sorted,
      },
    ];
  }

  const runs: RunRecord[] = [];
  for (const id of runIds) {
    const ev = events
      .filter((e) => e.run_id === id)
      .slice()
      .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    runs.push({
      runId: id,
      titleZh: runTitleZh(events, id),
      startTs: ev[0]?.ts,
      endTs: ev[ev.length - 1]?.ts,
      events: ev,
    });
  }

  runs.sort((a, b) => ((a.endTs ?? "") < (b.endTs ?? "") ? 1 : (a.endTs ?? "") > (b.endTs ?? "") ? -1 : 0));
  return runs;
}
