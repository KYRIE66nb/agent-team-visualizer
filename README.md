# Agent Team Visualizer

Visualize multi-agent teamwork as an auditable timeline: who talked to whom, what they said, what stage outputs were produced.

## MVP

- Desktop app (Electron) loading the visualizer UI
- Timeline view of events
- Filter by agent/stage/type
- Agent-to-agent messages (handoffs)
- Stage outputs (artifacts)
- Import/export from JSONL (current: paste; file import next)

## Run

Web (dev):

```bash
npm install
npm run dev
```

Desktop (dev):

```bash
npm install
npm run desktop:dev
```

## Data format (JSONL)

See `docs/event-schema.md`.

## License

MIT
