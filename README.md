# checkpoint

A CLI gate that validates your code changes — review, test, lint, docs — before they reach your configured push target.

## Status

Early. One daemon, shared across every worktree/repo on the machine, runs the full 9-stage pipeline (`intent`, `rebase`, `review`, `test`, `document`, `lint`, `push`, `PR`, `CI`). `checkpoint status` lists runs from all repos through that same daemon. Findings/gating (`checkpoint respond`) and Windows named-pipe transport are not built yet.

On macOS and Linux, `checkpoint init` registers the daemon as an OS-managed service (launchd/systemd) with socket activation: the OS starts the daemon on first connection, stops it after it's idle, and restarts it automatically if it crashes. Without running `init` — and always on Windows — the CLI falls back to lazily spawning the daemon itself on first use.

## Usage

```sh
npm install
npm run build
node dist/index.js init    # macOS/Linux: register the daemon as an OS service (optional)
node dist/index.js run
node dist/index.js status
```

`checkpoint run` connects to the background daemon (spawning it detached on first use if it isn't already running, from any worktree), runs the pipeline, and prints `stage_started` / `stage_finished` / `outcome` as they happen. `checkpoint status` prints every run recorded across all repos. Daemon state is global under `~/.checkpoint/` (Unix socket + SQLite) — not scoped per-repo or per-worktree.

`checkpoint init` writes `~/.checkpoint/config.yaml` (if it doesn't already exist) and, on macOS, installs a launchd agent at `~/Library/LaunchAgents/dev.checkpoint.daemon.plist`; on Linux, installs `checkpoint-daemon.socket` + `.service` user units under `~/.config/systemd/user/`. Both are configured for socket activation on `~/.checkpoint/daemon.sock`. On Windows, `init` only writes the config — lazy-start remains the only auto-start path.

## Development

```sh
npm install
npm run dev   # runs the CLI via tsx, no build step
npm test      # vitest — tests hit the daemon's socket protocol, not internals
npm run build # tsc
```

## License

MIT
