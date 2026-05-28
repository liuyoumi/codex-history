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

Tool-owned stores:

- `~/.codex-history/backups`
- `~/.codex-history/reports`

The tool must never store its own metadata inside `~/.codex`.

## Architecture

Suggested modules:

- `paths`: resolve Codex home, tool home, and platform-specific paths
- `schema`: validate supported Codex data model
- `threads`: list, search, and resolve thread candidates
- `planner`: build purge plans before mutation
- `backup`: copy all files required for rollback or manual inspection
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

Purge execution should use these steps:

1. Resolve input to exactly one thread.
2. Reject if the thread appears active or loaded.
3. Build a purge plan.
4. Create a backup unless disabled by explicit option.
5. Execute database and file changes.
6. Checkpoint SQLite WAL files.
7. Optionally vacuum SQLite databases.
8. Verify no supported store still references the thread id.

Interactive `purge` shows the resolved target after step 3 and requires the user to type the standard short id before continuing. `--force` skips only that interactive confirmation.

## Purge Plan

A purge plan should include:

- target thread metadata
- SQLite databases and row counts to mutate
- JSON/JSONL files to rewrite
- files to delete
- backup destination
- validation warnings
- unsupported stores, if any

The plan should be serializable for `--json`.

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

## Backup Format

Backup directory:

```text
~/.codex-history/backups/YYYYMMDD-HHMMSS-<threadId>/
```

Contents:

- `manifest.json`
- `state_5.sqlite`
- `state_5.sqlite-wal`, if present
- `state_5.sqlite-shm`, if present
- `logs_2.sqlite`, if present
- `logs_2.sqlite-wal`, if present
- `logs_2.sqlite-shm`, if present
- `goals_1.sqlite`, if present
- `session_index.jsonl`, if present
- `.codex-global-state.json`, if present
- `.codex-global-state.json.bak`, if present
- rollout jsonl file, if present
- shell snapshots, if present

The manifest should include original absolute paths, copied paths, file sizes, and timestamps.

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
- backup manifest generation
- SQLite mutation against temporary fixtures
- JSON/JSONL mutation
- verification failure reporting
