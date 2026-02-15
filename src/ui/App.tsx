import React, { useMemo, useState } from "react";
import { parseJsonl, sortByTs } from "../core/jsonl";
import type { TeamEvent } from "../core/types";
import { sampleJsonl } from "../core/sample-data";
import { generateStageSummaries } from "../core/autosummary";
import { agentsInRun, agentNarrativeZh, leaderPlanZh, taskBreakdownZh } from "../core/narrative";
import { splitRuns } from "../core/runs";
import { buildThreads } from "../core/thread";
import { computeFlags } from "../core/flags";
import { loadRuns, saveRuns, toStoredRun, upsertRun } from "../core/storage";
import "./layout.css";

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
  const [storedRuns, setStoredRuns] = useState(() => loadRuns());

  const eventsAll = useMemo(() => {
    const parsed = sortByTs(parseJsonl(jsonl));
    const generated = generateStageSummaries(parsed);
    return sortByTs([...parsed, ...generated]);
  }, [jsonl]);

  const runs = useMemo(() => splitRuns(eventsAll), [eventsAll]);
  const [runId, setRunId] = useState<string>(runs[0]?.runId ?? "default");

  const events = useMemo(() => {
    const r = runs.find((x) => x.runId === runId) ?? runs[0];
    return r ? r.events : eventsAll;
  }, [runs, runId, eventsAll]);

  const members = useMemo(() => agentsInRun(events), [events]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(members[0]?.id ?? "");

  const threads = useMemo(() => buildThreads(events), [events]);
  const flags = useMemo(() => computeFlags(events), [events]);

  const [rightTab, setRightTab] = useState<"叙述" | "对话">("叙述");
  const [threadId, setThreadId] = useState<string>(threads[0]?.threadId ?? "");

  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<EventType>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [tab, setTab] = useState<"timeline" | "threads">("timeline");

  // Keep old filters for now; new UI uses member selection.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const agentNameMap = useMemo(() => agentNames(events), [events]);

  const agentOptions = useMemo(() => {
    return uniq(events.flatMap(agentIdsFromEvent));
  }, [events]);

  const agentStatus = useMemo(() => agentStatusFromTasks(events), [events]);

  const stageOptions = useMemo(() => {
    return uniq(events.map((e) => e.stage).filter(Boolean) as string[]);
  }, [events]);

  const leaderPlanText = useMemo(() => leaderPlanZh(events), [events]);
  const taskBreakdownText = useMemo(() => taskBreakdownZh(events), [events]);

  const agentNarrative = useMemo(() => {
    if (!selectedAgentId) return "";
    return agentNarrativeZh(events, selectedAgentId);
  }, [events, selectedAgentId]);

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
          <div className="title">Agent Team</div>
          <div className="subtitle">左侧：历史运行记录｜中间：成员｜右侧：中文叙述（不显示 JSON）</div>
        </div>
        <div className="actions">
          <button className="button" onClick={() => setJsonl(sampleJsonl)}>载入示例</button>
          <input
            type="file"
            accept=".jsonl,.txt,application/json,text/plain"
            style={{ display: "none" }}
            id="fileInput"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              setJsonl(text);
            }}
          />
          <button
            className="button"
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            导入 .jsonl
          </button>
          <button
            className="button"
            onClick={() => {
              const r = runs.find((x) => x.runId === runId) ?? runs[0];
              if (!r) return;
              const next = upsertRun(storedRuns, toStoredRun(r, jsonl));
              setStoredRuns(next);
              saveRuns(next);
            }}
          >
            保存到历史
          </button>
        </div>
      </div>

      <div className="appShell">
        <div className="panel">
          <div className="panelHeader">
            <div className="panelHeaderRow">
              <div>
                <div className="title" style={{ fontSize: 12 }}>历史记录</div>
                <div className="subtitle">本次运行 + 已保存历史</div>
              </div>
              <span className="kbd">runs: {runs.length} + saved: {storedRuns.length}</span>
            </div>
          </div>
          <div className="body">
            <div className="navList">
              {runs.map((r) => (
                <div
                  key={r.runId}
                  className={"navItem " + (r.runId === runId ? "navItemOn" : "")}
                  onClick={() => {
                    setRunId(r.runId);
                    const m = agentsInRun(r.events);
                    setSelectedAgentId(m[0]?.id ?? "");
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="big">{r.titleZh}</div>
                  <div className="small">{r.startTs ?? ""} → {r.endTs ?? ""}</div>
                </div>
              ))}

              {storedRuns.length ? (
                <div style={{ height: 8 }} />
              ) : null}

              {storedRuns.map((r) => (
                <div
                  key={"saved:" + r.runId}
                  className={"navItem"}
                  onClick={() => {
                    setJsonl(r.jsonl);
                    setRunId(r.runId);
                    setSelectedAgentId(agentsInRun(parseJsonl(r.jsonl) as any)[0]?.id ?? "");
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="big">{r.titleZh}</div>
                  <div className="small">(saved) {r.startTs ?? ""} → {r.endTs ?? ""}</div>
                </div>
              ))}
            </div>

            <div style={{ height: 12 }} />

            <div className="field">
              <div className="label">数据输入（暂时：粘贴 JSONL；后续改成文件导入）</div>
              <textarea
                className="input"
                style={{ minHeight: 160, fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.45 }}
                value={jsonl}
                onChange={(e) => setJsonl(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div className="panelHeaderRow">
              <div>
                <div className="title" style={{ fontSize: 12 }}>成员</div>
                <div className="subtitle">点击切换右侧中文叙述</div>
              </div>
              <span className="kbd">members: {members.length}</span>
            </div>
          </div>
          <div className="body">
            <div className="memberList">
              {members.map((m) => (
                <div
                  key={m.id}
                  className={"memberItem " + (m.id === selectedAgentId ? "memberItemOn" : "")}
                  onClick={() => setSelectedAgentId(m.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="big">{m.name}</div>
                  <div className="small">id={m.id}{m.role ? ` · role=${m.role}` : ""}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div className="panelHeaderRow">
              <div>
                <div className="title" style={{ fontSize: 12 }}>中文叙述</div>
                <div className="subtitle">规划目标 / 拆解 / 阶段结果 / 指令与回报</div>
              </div>
              <span className="kbd">agent: {selectedAgentId || "(none)"}</span>
            </div>
          </div>
          <div className="body">
            <div className="tabRow">
              <button className={"button " + (rightTab === "叙述" ? "buttonAccent" : "")} onClick={() => setRightTab("叙述")}>叙述</button>
              <button className={"button " + (rightTab === "对话" ? "buttonAccent" : "")} onClick={() => setRightTab("对话")}>对话</button>
              <span className="kbd">flags: {flags.length}</span>
            </div>

            {flags.length ? (
              <div className="docSection">
                {flags.map((f, idx) => (
                  <div key={idx} className={"flag " + (f.level === "risk" ? "flagRisk" : "flagWarn")}>
                    <div className="big">{f.level === "risk" ? "风险" : "提醒"}：{f.titleZh}</div>
                    {f.detailZh ? <div className="small">{f.detailZh}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {rightTab === "叙述" ? (
              <div className="doc">
                <div className="docTitle">领导规划</div>
                <div className="docSection">{leaderPlanText}</div>

                <div className="docTitle">任务拆解</div>
                <div className="docSection">{taskBreakdownText}</div>

                <div className="docTitle">成员回报：{members.find((x) => x.id === selectedAgentId)?.name ?? selectedAgentId}</div>
                <div className="docSection">{agentNarrative}</div>
              </div>
            ) : (
              <div>
                <div className="field">
                  <div className="label">选择对话线程</div>
                  <select className="select" value={threadId} onChange={(e) => setThreadId(e.target.value)}>
                    <option value="">(none)</option>
                    {threads.map((t) => (
                      <option key={t.threadId} value={t.threadId}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ height: 12 }} />

                <div className="chat">
                  {(threads.find((t) => t.threadId === threadId)?.messages ?? []).map((m) => (
                    <div key={m.id} className="bubble">
                      <div className="bubbleMeta">
                        {m.ts}{m.stage ? ` · ${m.stage}` : ""} · {m.from.name} → {m.to.name}{m.channel ? ` · ${m.channel}` : ""}
                      </div>
                      <div>{m.content_zh ?? m.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
