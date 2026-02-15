import React, { useMemo, useState } from "react";
import { parseJsonl, sortByTs } from "../core/jsonl";
import type { TeamEvent } from "../core/types";
import { sampleJsonl } from "../core/sample-data";

type EventType = TeamEvent["type"] | "all";

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function prettyAgent(a: { id: string; name: string }): string {
  return `${a.name} (${a.id})`;
}

function typeLabel(t: TeamEvent["type"]): string {
  if (t === "message") return "message";
  if (t === "artifact") return "artifact";
  return "task";
}

function badgeClass(t: TeamEvent["type"]): string {
  if (t === "message") return "badge badgeMsg";
  if (t === "artifact") return "badge badgeArt";
  return "badge badgeTask";
}

function eventTitle(e: TeamEvent): string {
  if (e.type === "message") return `${prettyAgent(e.from)} → ${prettyAgent(e.to)}`;
  if (e.type === "artifact") return `${prettyAgent(e.producer)} produced: ${e.title}`;
  return `${prettyAgent(e.agent)} ${e.status}: ${e.title}`;
}

function preview(e: TeamEvent): string {
  if (e.type === "message") return e.content;
  if (e.type === "artifact") return e.summary ?? e.content ?? "";
  return e.result ?? "";
}

function agentIdsFromEvent(e: TeamEvent): string[] {
  if (e.type === "message") return [e.from.id, e.to.id];
  if (e.type === "artifact") return [e.producer.id];
  return [e.agent.id];
}

export default function App(): React.JSX.Element {
  const [jsonl, setJsonl] = useState(sampleJsonl);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<EventType>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const events = useMemo(() => {
    const parsed = sortByTs(parseJsonl(jsonl));
    return parsed;
  }, [jsonl]);

  const agentOptions = useMemo(() => {
    return uniq(events.flatMap(agentIdsFromEvent));
  }, [events]);

  const stageOptions = useMemo(() => {
    return uniq(events.map((e) => e.stage).filter(Boolean) as string[]);
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (agentFilter !== "all") {
        const ids = agentIdsFromEvent(e);
        if (!ids.includes(agentFilter)) return false;
      }
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (stageFilter !== "all" && (e.stage ?? "") !== stageFilter) return false;
      return true;
    });
  }, [events, agentFilter, typeFilter, stageFilter]);

  const selected = useMemo(() => {
    const id = selectedId;
    if (!id) return null;
    return filtered.find((e) => e.id === id) ?? events.find((e) => e.id === id) ?? null;
  }, [selectedId, filtered, events]);

  return (
    <div className="shell">
      <div className="header">
        <div>
          <div className="title">Agent Team Visualizer</div>
          <div className="subtitle">
            Audit multi-agent runs: messages, stage outputs, and task status.
          </div>
        </div>
        <div className="kbd">JSONL → Timeline → Details</div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panelHeader">
            <div className="panelHeaderRow">
              <div>
                <div className="title" style={{ fontSize: 14 }}>Input</div>
                <div className="subtitle">Paste JSONL events. One JSON object per line.</div>
              </div>
              <div className="actions">
                <button
                  className="button"
                  onClick={() => {
                    setJsonl(sampleJsonl);
                    setSelectedId(null);
                  }}
                >
                  Load sample
                </button>
              </div>
            </div>
          </div>
          <div className="body">
            <textarea
              className="input"
              style={{ minHeight: 210, fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.45 }}
              value={jsonl}
              onChange={(e) => setJsonl(e.target.value)}
            />

            <div style={{ height: 12 }} />

            <div className="split">
              <div className="field">
                <div className="label">Agent filter</div>
                <select className="select" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
                  <option value="all">All</option>
                  {agentOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <div className="label">Stage filter</div>
                <select className="select" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                  <option value="all">All</option>
                  {stageOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="field">
              <div className="label">Type</div>
              <div className="pills">
                {(["all", "message", "artifact", "task"] as const).map((t) => (
                  <div
                    key={t}
                    className={"pill " + (typeFilter === t ? "pillOn" : "")}
                    onClick={() => setTypeFilter(t as EventType)}
                    role="button"
                    tabIndex={0}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="field">
              <div className="label">Selected event</div>
              <div className="details">
                {selected ? JSON.stringify(selected, null, 2) : "(none)"}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div className="panelHeaderRow">
              <div>
                <div className="title" style={{ fontSize: 14 }}>Timeline</div>
                <div className="subtitle">
                  {filtered.length} events shown (of {events.length}). Click an event for details.
                </div>
              </div>
              <div className="actions">
                <span className="kbd">Total agents: {agentOptions.length}</span>
              </div>
            </div>
          </div>

          <div className="body">
            <div className="list">
              {filtered.map((e) => (
                <div
                  key={e.id}
                  className="card"
                  style={{ borderColor: selectedId === e.id ? "rgba(255,209,102,0.45)" : undefined }}
                  onClick={() => setSelectedId(e.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cardTop">
                    <div>
                      <div className="cardTitle">{eventTitle(e)}</div>
                      <div className="cardMeta">{e.ts}{e.stage ? `  ·  stage=${e.stage}` : ""}</div>
                    </div>
                    <div className={badgeClass(e.type)}>{typeLabel(e.type)}</div>
                  </div>
                  <div className="preview">{preview(e)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
