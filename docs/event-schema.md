# Event Schema (JSONL)

Each line is one JSON object.

## Common fields

- `id` (string) unique event id
- `ts` (string) ISO-8601 timestamp
- `type` (string) event type
- `run_id` (string) optional: one execution/run
- `stage` (string) optional: planning|implementation|review|verify|custom
- `agent` (object) required
  - `id` (string)
  - `name` (string)
- `meta` (object) optional: arbitrary

## Types

### message

Agent-to-agent communication.

Fields:
- `from` agent object
- `to` agent object
- `content` (string)
- `channel` (string) e.g. "handoff", "question", "decision"
- `thread_id` (string) optional

### artifact

A stage output artifact.

Fields:
- `producer` agent object
- `title` (string)
- `summary` (string)
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
