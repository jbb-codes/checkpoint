# checkpoint

A standalone CLI and background daemon that runs a fixed pipeline of validation stages against a committed branch before it reaches its push target — driven interchangeably by a human at a terminal or an AI agent over the same protocol.

## Language

**Run**:
One execution of the pipeline against a branch, from the first stage through to an outcome (`passed`, `failed`, or `aborted`).
_Avoid_: Job, task, build, execution

**Stage**:
One step in the pipeline's fixed order (`intent → rebase → review → test → document → lint → push → PR → CI`). A stage's actual work is delegated to a backend.
_Avoid_: Step, phase, check

**Backend**:
The pluggable implementation that performs a stage's actual work — either a built-in default or a local script satisfying the `StageBackend` interface.
_Avoid_: Plugin, provider, handler

**Finding**:
An issue a stage's backend surfaces during a run, carrying a severity and a classification action.
_Avoid_: Issue, violation, result

**Finding action**:
The three-tag classification a finding carries: `auto-fix` (a driver may resolve it without asking), `no-op` (informational, doesn't block), or `ask-user` (must always reach the human unless standing consent to drive unattended has been given).
_Avoid_: Priority, severity level (severity is a separate field)

**Gate**:
The point where a run pauses because a stage produced an `ask-user` finding, waiting on a `respond` before the pipeline continues.
_Avoid_: Block, pause, hold

**Driver**:
Whichever client is operating a run through the socket protocol — an interactive human terminal or an AI agent — both speaking the identical `run`/`status`/`respond` protocol.
_Avoid_: Client, consumer, user (a driver may be an agent, not a person)

**Daemon**:
The single background process, global across every worktree on the machine, that coordinates every run and persists state to SQLite.
_Avoid_: Server, service, worker
