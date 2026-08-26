# checkpoint

A CLI gate that validates your code changes — review, test, lint, docs — before they reach your configured push target.

## Status

Early. The daemon/socket/SQLite/CLI stack works end-to-end for a single hardcoded stage — `checkpoint run` starts the daemon if needed, streams stage events live, and persists the run. The real 9-stage pipeline, findings/gating (`checkpoint respond`), and Windows named-pipe transport are not built yet.

## Usage

```sh
npm install
npm run build
node dist/index.js run
```

`checkpoint run` connects to the background daemon (spawning it on first use), runs one stub stage, and prints `stage_started` / `stage_finished` / `outcome` as they happen. Daemon state lives under `~/.checkpoint/` (Unix socket + SQLite).

## Development

```sh
npm install
npm run dev   # runs the CLI via tsx, no build step
npm test      # vitest — tests hit the daemon's socket protocol, not internals
npm run build # tsc
```

## License

MIT
