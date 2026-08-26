# Single global daemon, not one per worktree or repo

Developers work across several git worktrees on the same machine at once, and each needs live visibility into its own runs without hunting through separate processes. We chose one global daemon that tracks every run across every worktree, rather than a daemon per worktree or per repo. This trades away process isolation between projects for a single, always-discoverable place to query "show all active runs" — the alternative (per-worktree daemons) would need a separate coordination layer just to answer that question, defeating the point.
