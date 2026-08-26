# checkpoint

A CLI gate that validates your code changes — review, test, lint, docs — before they reach your configured push target.

## Status

Early. One daemon, shared across every worktree/repo on the machine, runs the full 9-stage pipeline (`intent`, `rebase`, `review`, `test`, `document`, `lint`, `push`, `PR`, `CI`) and lazily auto-starts on any CLI invocation. `checkpoint status` lists runs from all repos through that same daemon. Findings/gating (`checkpoint respond`) and Windows named-pipe transport are not built yet.

## Usage

```sh
npm install
npm run build
node dist/index.js run
node dist/index.js status
```

`checkpoint run` connects to the background daemon (spawning it detached on first use, from any worktree), runs the pipeline, and prints `stage_started` / `stage_finished` / `outcome` as they happen. `checkpoint status` prints every run recorded across all repos. Daemon state is global under `~/.checkpoint/` (Unix socket + SQLite) — not scoped per-repo or per-worktree.

## Development

```sh
npm install
npm run dev   # runs the CLI via tsx, no build step
npm test      # vitest — tests hit the daemon's socket protocol, not internals
npm run build # tsc
```

## License

MIT
