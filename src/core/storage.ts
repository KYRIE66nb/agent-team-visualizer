import type { RunRecord } from "./runs";

const KEY = "atv:runs:v1";

export type StoredRun = {
  runId: string;
  titleZh: string;
  startTs?: string;
  endTs?: string;
  jsonl: string;
};

export function loadRuns(): StoredRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as StoredRun[];
  } catch {
    return [];
  }
}

export function saveRuns(runs: StoredRun[]): void {
  localStorage.setItem(KEY, JSON.stringify(runs.slice(0, 50)));
}

export function upsertRun(existing: StoredRun[], run: StoredRun): StoredRun[] {
  const out = existing.filter((r) => r.runId !== run.runId);
  out.unshift(run);
  return out;
}

export function toStoredRun(run: RunRecord, jsonl: string): StoredRun {
  return {
    runId: run.runId,
    titleZh: run.titleZh,
    startTs: run.startTs,
    endTs: run.endTs,
    jsonl,
  };
}
