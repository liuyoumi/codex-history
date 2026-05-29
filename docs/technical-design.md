# Technical Design

## Storage Locations

The current macOS Codex Desktop and CLI local data model includes several related stores.

Primary stores:

- `~/.codex/state_5.sqlite`
- `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
- `~/.codex/session_index.jsonl`
- `~/.codex/.codex-global-state.json`
- `~/.codex/.codex-global-state.json.bak`

Secondary stores:

- `~/.codex/logs_2.sqlite`
- `~/.codex/goals_1.sqlite`
- `~/.codex/shell_snapshots/{threadId}.*.sh`

The tool must not write tool-owned recovery copies of purged conversations.

## Architecture

Suggested modules:

- `paths`: resolve Codex home and platform-specific paths
- `schema`: validate supported Codex data model
- `threads`: list, filter, and resolve thread candidates
- `planner`: build purge plans before mutation
- `orphans`: find missing-rollout and logs-only orphan cleanup candidates
- `sqlite`: execute database mutations with transactions and checkpoints
- `json-state`: mutate structured JSON and JSONL state files
- `files`: remove rollout files and shell snapshots
- `verify`: scan supported stores for remaining thread references
- `cli`: parse arguments and format output

The `planner` module should be pure where possible. Given fixtures and a thread id, it should return an operation plan without mutating data.

## Thread Discovery

The `threads` table in `state_5.sqlite` is the canonical source for local thread metadata.

Important columns:

- `id`
- `title`
- `rollout_path`
- `created_at`
- `updated_at`
- `cwd`
- `archived`
- `first_user_message`
- `preview`

The tool should validate that required columns exist before executing any operation.

## Purge Strategy

Single-target purge execution should use these steps:

1. Resolve input to exactly one thread.
2. Reject if the thread appears active or loaded.
3. Build a purge plan.
4. Execute database and file changes.
5. Checkpoint SQLite WAL files.
6. Optionally vacuum SQLite databases.
7. Verify no supported store still references the thread id.

Interactive `purge` shows the resolved target after step 3 and requires the user to type the standard short id before continuing. `--force` skips only that interactive confirmation.

Multi-target purge should use the same planning and mutation primitives, with these extra constraints:

- resolve all provided ids or short id prefixes before mutation
- deduplicate inputs that resolve to the same full thread id
- refuse the whole batch before mutation if any target is missing, ambiguous, or active
- require typing `purge-selected` before interactive batch deletion
- summarize per-store row counts and aggregate verification failures after execution

Filtered purge should use the same batch purge primitive after selecting threads with supported list filters:

- accept `--cwd`, `--grep`, and `--archived`
- combine filters as an intersection
- match `--cwd` against working-directory path fragments
- match `--grep` against conversation text fields only: display title, source title, first user message, and preview
- reject filter mode with no filters
- reject commands that mix explicit ids with filters
- match non-archived conversations by default unless `--archived` is provided
- require typing `purge-selected` before interactive filtered deletion

## Orphan Cleanup Strategy

`purge-orphans` handles supported local data whose rollout file is already missing, plus logs-only records that no longer have a matching thread row.

Candidate types:

- thread rows whose `rollout_path` points to a missing session or archived session file
- logs-only thread ids present in `logs_2.sqlite.logs` but absent from `state_5.sqlite.threads`

Execution should:

1. Validate the supported data model.
2. Build a complete cleanup plan.
3. Refuse active orphan thread targets when detectable.
4. Require typing `purge-orphans` unless `--force` is used.
5. Reuse single-thread purge behavior for missing-rollout threads.
6. Delete only matching `logs_2.sqlite.logs` rows for logs-only orphan ids.
7. Checkpoint SQLite WAL files.
8. Verify supported stores after mutation.

Branch relationships are not recursive cleanup rules. If an orphaned parent has a valid child, only the orphaned parent and the edge that references it should be removed.

The command should report affected row counts, file deletion counts, and estimated local disk space affected. The estimate must not claim that SQLite database files shrink immediately, because automatic `VACUUM` remains out of scope.

## Purge Plan

A purge plan should include:

- target thread metadata
- SQLite databases and row counts to mutate
- JSON/JSONL files to rewrite
- files to delete
- validation warnings
- unsupported stores, if any

## SQLite Mutations

For `state_5.sqlite`:

- delete from `threads`
- delete from `thread_dynamic_tools`
- delete from `stage1_outputs`
- delete from `thread_spawn_edges` where parent or child matches
- update or report `agent_job_items.assigned_thread_id` references if present

`threads` has dependent tables with foreign keys, but the tool should not rely on SQLite foreign key cascading being enabled. It should delete supported dependent records explicitly.

For `logs_2.sqlite`:

- delete from `logs` where `thread_id` matches

For `goals_1.sqlite`:

- delete from `thread_goals` where `thread_id` matches

Each SQLite database should run:

```sql
PRAGMA wal_checkpoint(TRUNCATE);
```

`VACUUM` should be available behind an option because it rewrites the database and may be slower.

`VACUUM` is not required for `0.1`; checkpointing WAL is required.

## JSON Mutations

For `session_index.jsonl`:

- remove lines whose `id` matches the target thread id

For `.codex-global-state.json` and `.bak`:

- remove target thread id keys from known maps
- remove target thread id values from known arrays
- remove prompt-history entry for the target thread id

The tool must parse JSON structurally and write formatted JSON. It must not use ad hoc string replacement for these files.

Known global-state keys observed during investigation:

- `electron-persisted-atom-state.prompt-history`
- `electron-persisted-atom-state.heartbeat-thread-permissions-by-id`
- `projectless-thread-ids`
- `thread-workspace-root-hints`

Unknown keys should be left untouched unless they are structurally known containers whose key or array item exactly equals the target thread id.

## File Mutations

Remove:

- the target thread rollout jsonl file
- shell snapshots matching `{threadId}.*.sh`

The tool should not recursively delete broad directories.

## Recovery Model

`purge` is a permanent local deletion flow. The tool does not create backups or provide restore commands in `0.1`.

Safety comes from:

- resolving exactly one target before mutation
- showing the resolved target before deletion
- requiring short-id confirmation unless `--force` is used
- requiring `purge-selected` confirmation for multi-target and filtered purge unless `--force` is used
- refusing active threads when detectable
- verifying supported stores after mutation

## Active Thread Protection

The tool should refuse purge if:

- the target thread id is the current running Codex thread
- the rollout file is actively growing
- app-server reports the thread as loaded, if a reliable check is implemented

This protection can be conservative. False positives are acceptable; accidental deletion of an active thread is not.

Initial `0.1` active-thread checks:

- refuse if the target thread id matches `CODEX_THREAD_ID` when present
- refuse if the rollout file modification time changes during planning
- warn if Codex Desktop appears to be running

Because process detection is platform-sensitive, the Codex Desktop running check should warn in `0.1` and may become a hard block later.

## Version Drift

Codex local storage is not a public stable API.

Before mutation, the tool must:

- check expected files exist
- check required SQLite tables and columns
- check JSON roots have expected object shapes
- fail closed if the data model is unknown

## Testing Strategy

Tests must use fixtures, not the developer's real `~/.codex`.

Required fixture types:

- minimal valid Codex home
- duplicate-title conversations
- missing rollout file
- malformed JSON state
- missing SQLite column
- active-thread simulation
- WAL file presence

Required test groups:

- thread resolution
- purge planning
- SQLite mutation against temporary fixtures
- JSON/JSONL mutation
- verification failure reporting
