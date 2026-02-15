import React, { useMemo, useState } from "react";
import { parseJsonl, sortByTs } from "../core/jsonl";
import type { TeamEvent } from "../core/types";
import { sampleJsonl } from "../core/sample-data";
import { generateStageSummaries } from "../core/autosummary";
import { extractLeaderPlans, extractTaskBreakdowns, isLeaderAgentId } from "../core/leader";
import { buildThreads } from "../core/thread";
import { latestAgentRuntimeStatus } from "../core/agent-status";

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
  if (t === "agent_status") return "status";
  return "task";
}

function badgeClass(t: TeamEvent["type"]): string {
  if (t === "message") return "badge badgeMsg";
  if (t === "artifact") return "badge badgeArt";
  if (t === "agent_status") return "badge badgeStatus";
  return "badge badgeTask";
}

function eventTitle(e: TeamEvent): string {
  if (e.type === "message") {
    const ch = e.channel ? ` [${e.channel}]` : "";
    return `${prettyAgent(e.from)} → ${prettyAgent(e.to)}${ch}`;
  }
  if (e.type === "artifact") {
    const t = e.title_zh ?? e.title;
    return `${prettyAgent(e.producer)} 产出: ${t}`;
  }
  if (e.type === "agent_status") {
    const st = e.status;
    const brief = `${st.state}${st.current_task ? ` · ${st.current_task}` : ""}`;
    return `${prettyAgent(e.agent)} 状态: ${brief}`;
  }
  return `${prettyAgent(e.agent)} ${e.status}: ${e.title}`;
}

function preview(e: TeamEvent): string {
  if (e.type === "message") return e.content_zh ?? e.content;
  if (e.type === "artifact") return e.summary_zh ?? e.summary ?? e.content ?? "";
  if (e.type === "agent_status") return e.status.summary_zh ?? "";
  return e.result ?? "";
}

function agentIdsFromEvent(e: TeamEvent): string[] {
  if (e.type === "message") return [e.from.id, e.to.id];
  if (e.type === "artifact") return [e.producer.id];
  return [e.agent.id];
}

function agentNames(events: TeamEvent[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of events) {
    if (e.type === "message") {
      m.set(e.from.id, e.from.name);
      m.set(e.to.id, e.to.name);
    } else if (e.type === "artifact") {
      m.set(e.producer.id, e.producer.name);
    } else {
      m.set(e.agent.id, e.agent.name);
    }
  }
  return m;
}

function agentStatusFromTasks(events: TeamEvent[]): Map<string, { lastTs: string; summary: string; currentStage?: string }> {
  const tasksByAgent = new Map<string, TeamEvent[]>();
  for (const e of events) {
    if (e.type !== "task") continue;
    const arr = tasksByAgent.get(e.agent.id) ?? [];
    arr.push(e);
    tasksByAgent.set(e.agent.id, arr);
  }
  const res = new Map<string, { lastTs: string; summary: string; currentStage?: string }>();
  for (const [agentId, tasks] of tasksByAgent.entries()) {
    tasks.sort((a, b) => ((a as any).ts < (b as any).ts ? -1 : (a as any).ts > (b as any).ts ? 1 : 0));
    const last = tasks[tasks.length - 1] as any;
    const done = tasks.filter((t: any) => t.status === "done").length;
    const running = tasks.filter((t: any) => t.status === "running").length;
    const failed = tasks.filter((t: any) => t.status === "failed").length;
    res.set(agentId, {
      lastTs: last.ts,
      currentStage: last.stage,
      summary: `任务：完成 ${done}，进行中 ${running}，失败 ${failed}`
    });
  }
  return res;
}

function agentProfile(events: TeamEvent[], agentId: string): string {
  const related = events.filter((e) => agentIdsFromEvent(e).includes(agentId));
  related.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  const sentInstructions = related.filter(
    (e) => e.type === "message" && e.from.id === agentId && e.channel === "instruction"
  ) as any[];
  const receivedInstructions = related.filter(
    (e) => e.type === "message" && e.to.id === agentId && e.channel === "instruction"
  ) as any[];

  const artifacts = related.filter((e) => e.type === "artifact") as any[];

  const lastEvent = related[related.length - 1];
  const lastStage = lastEvent?.stage;

  const formatMsg = (m: any) => {
    const from = `${m.from?.name ?? m.from?.id}(${m.from?.id})`;
    const to = `${m.to?.name ?? m.to?.id}(${m.to?.id})`;
    const body = (m.content_zh ?? m.content ?? "").toString().trim();
    const head = `${m.ts}${m.stage ? ` stage=${m.stage}` : ""} ${from}→${to}`;
    return `${head}\n${body}`;
  };

  const formatArt = (a: any) => {
    const t = (a.title_zh ?? a.title ?? "").toString();
    const s = (a.summary_zh ?? a.summary ?? "").toString();
    const head = `${a.ts}${a.stage ? ` stage=${a.stage}` : ""} ${t}`;
    return s ? `${head}\n${s}` : head;
  };

  return [
    `Agent: ${agentId}`,
    `最近阶段: ${lastStage ?? "(unknown)"}`,
    `最近事件: ${lastEvent ? `${lastEvent.ts} type=${lastEvent.type}` : "(none)"}`,
    "\n收到的领导指令（最近3条）:\n" +
      (receivedInstructions.length
        ? receivedInstructions
            .slice(-3)
            .reverse()
            .map(formatMsg)
            .join("\n\n")
        : "(none)"),
    "\n\n发出的领导指令（最近3条）:\n" +
      (sentInstructions.length
        ? sentInstructions
            .slice(-3)
            .reverse()
            .map(formatMsg)
            .join("\n\n")
        : "(none)"),
    "\n\n阶段产出（最近3条）:\n" +
      (artifacts.length
        ? artifacts
            .slice(-3)
            .reverse()
            .map(formatArt)
            .join("\n\n")
        : "(none)"),
  ].join("\n");
}

export default function App(): React.JSX.Element {
  const [jsonl, setJsonl] = useState(sampleJsonl);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<EventType>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [tab, setTab] = useState<"timeline" | "threads">("timeline");

  const events = useMemo(() => {
    const parsed = sortByTs(parseJsonl(jsonl));
    const generated = generateStageSummaries(parsed);
    return sortByTs([...parsed, ...generated]);
  }, [jsonl]);

  const agentNameMap = useMemo(() => agentNames(events), [events]);

  const agentOptions = useMemo(() => {
    return uniq(events.flatMap(agentIdsFromEvent));
  }, [events]);

  const agentStatus = useMemo(() => agentStatusFromTasks(events), [events]);

  const stageOptions = useMemo(() => {
    return uniq(events.map((e) => e.stage).filter(Boolean) as string[]);
  }, [events]);

  const leaderAgentIds = useMemo(() => {
    return agentOptions.filter((id) => isLeaderAgentId(events, id));
  }, [agentOptions, events]);

  const leaderPlans = useMemo(() => extractLeaderPlans(events), [events]);
  const taskBreakdowns = useMemo(() => extractTaskBreakdowns(events), [events]);

  const threads = useMemo(() => buildThreads(events), [events]);
  const runtimeStatus = useMemo(() => latestAgentRuntimeStatus(events as any), [events]);

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
                      {agentNameMap.get(id) ?? id} ({id})
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
                {(["all", "message", "artifact", "task", "agent_status"] as const).map((t) => (
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
              <div className="label">Leader 视图（meta.role=lead）</div>
              <div className="details">
                {leaderAgentIds.length === 0 ? (
                  "(no leader detected)"
                ) : (
                  [
                    `Leader agents: ${leaderAgentIds.map((id) => `${agentNameMap.get(id) ?? id}(${id})`).join(", ")}`,
                    "\n\n中文规划表（leader_plan）:\n" +
                      (leaderPlans.length
                        ? leaderPlans
                            .map((p) => {
                              const d = p.plan.deliverables_zh?.length ? `\n- 交付物：${p.plan.deliverables_zh.join("；")}` : "";
                              const m = p.plan.milestones_zh?.length
                                ? `\n- 里程碑：${p.plan.milestones_zh.map((x) => `${x.done ? "[x]" : "[ ]"} ${x.name}`).join("；")}`
                                : "";
                              return `${p.ts}${p.stage ? ` stage=${p.stage}` : ""}\n- 目标：${p.plan.goal_zh ?? ""}${d}${m}\n(ref=${p.rawId})`;
                            })
                            .join("\n\n")
                        : "(none)"),
                    "\n\n任务拆解表（task_breakdown_zh）:\n" +
                      (taskBreakdowns.length
                        ? taskBreakdowns
                            .map((t) => {
                              const rows = t.items
                                .map((it) => `- ${it.id ?? "?"} | owner=${it.owner ?? "?"} | ${it.title ?? ""} | 验收：${it.acceptance ?? ""}`)
                                .join("\n");
                              return `${t.ts}${t.stage ? ` stage=${t.stage}` : ""}\n${rows}\n(ref=${t.rawId})`;
                            })
                            .join("\n\n")
                        : "(none)"),
                  ].join("\n")
                )}
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="field">
              <div className="label">Agent 状态（基于 task 事件）</div>
              <div className="details">
                {agentFilter !== "all" ? (
                  (() => {
                    const st = agentStatus.get(agentFilter);
                    const head = st
                      ? `${agentNameMap.get(agentFilter) ?? agentFilter}\nlast=${st.lastTs}${st.currentStage ? `\nstage=${st.currentStage}` : ""}\n${st.summary}`
                      : "(no task events for this agent)";
                    const rt = runtimeStatus.get(agentFilter);
                    const rtBlock = rt
                      ? `\n\n运行时状态(显式 agent_status)：\nstate=${rt.status.state}${rt.status.stage ? `\nstage=${rt.status.stage}` : ""}${rt.status.current_task ? `\ncurrent_task=${rt.status.current_task}` : ""}${rt.status.summary_zh ? `\n${rt.status.summary_zh}` : ""}`
                      : "\n\n运行时状态(显式 agent_status)：\n(none)";
                    return head + rtBlock + "\n\n" + agentProfile(events, agentFilter);
                  })()
                ) : (
                  agentOptions
                    .map((id) => {
                      const st = agentStatus.get(id);
                      const name = agentNameMap.get(id) ?? id;
                      return `${name} (${id})${st ? `\n  last=${st.lastTs}${st.currentStage ? `\n  stage=${st.currentStage}` : ""}\n  ${st.summary}` : "\n  (no task events)"}`;
                    })
                    .join("\n\n")
                )}
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
                <button className={"button " + (tab === "timeline" ? "buttonAccent" : "")} onClick={() => setTab("timeline")}>Timeline</button>
                <button className={"button " + (tab === "threads" ? "buttonAccent" : "")} onClick={() => setTab("threads")}>Threads</button>
                <span className="kbd">Agents: {agentOptions.length}</span>
              </div>
            </div>
          </div>

          <div className="body">
            {tab === "timeline" ? (
              <div className="list">
                {filtered.map((e) => (
                  <div
                    key={e.id}
                    className="card"
                    style={{ borderColor: selectedId === e.id ? "rgba(255,255,255,0.22)" : undefined }}
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
            ) : (
              <div className="list">
                {threads.map((t) => (
                  <div
                    key={t.threadId}
                    className="card"
                    onClick={() => setSelectedId(t.messages[t.messages.length - 1]?.id ?? null)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="cardTop">
                      <div>
                        <div className="cardTitle">{t.title}</div>
                        <div className="cardMeta">{t.firstTs} → {t.lastTs}</div>
                      </div>
                      <div className="badge badgeMsg">thread</div>
                    </div>
                    <div className="preview">
                      {(t.messages[t.messages.length - 1]?.content_zh ?? t.messages[t.messages.length - 1]?.content ?? "").slice(0, 220)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
