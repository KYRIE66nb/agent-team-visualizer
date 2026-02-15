# Event Schema (JSONL)

Each line is one JSON object.

## Common fields

- `id` (string) unique event id
- `ts` (string) ISO-8601 timestamp
- `type` (string) event type
- `run_id` (string) optional: one execution/run
- `stage` (string) optional: planning|implementation|review|verify|custom
- `lang` (string) optional: e.g. "zh-CN"
- `agent` (object) required
  - `id` (string)
  - `name` (string)
  - `role` (string) optional: e.g. "lead", "planner", "builder", "reviewer"
- `meta` (object) optional: arbitrary

## Types

### agent_status

Explicit runtime status for an agent. Use this to avoid guessing based on task events.

Fields:
- `agent` agent object
- `status.state` one of: idle|busy|waiting|blocked
- `status.stage` (string) optional
- `status.current_task` (string) optional
- `status.summary_zh` (string) optional

### message

Agent-to-agent communication.

Fields:
- `from` agent object
- `to` agent object
- `content` (string)
- `content_zh` (string) optional: Chinese rendering of content
- `channel` (string) e.g. "handoff", "question", "decision", "instruction"
- `thread_id` (string) optional

### artifact

A stage output artifact.

Fields:
- `producer` agent object
- `title` (string)
- `title_zh` (string) optional
- `summary` (string)
- `summary_zh` (string) optional: Chinese summary
- `uri` (string) optional: file path or URL
- `content` (string) optional: small inline content

### task

Represents a stage task status update.

Fields:
- `task_id` (string)
- `title` (string)
- `status` (string) queued|running|done|failed
- `result` (string) optional

## Minimal example

```json
{"id":"evt_1","ts":"2026-02-15T12:00:00+08:00","type":"message","stage":"planning","from":{"id":"planner","name":"Planner"},"to":{"id":"builder","name":"Builder"},"content":"Implement feature X in 3 steps...","channel":"handoff"}
```
