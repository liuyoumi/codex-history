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

## SQLite Mutations

For `state_5.sqlite`:

- delete from `threads`
- delete from `thread_dynamic_tools`
- delete from `stage1_outputs`
- delete from `thread_spawn_edges` where parent or child matches
- update or report `agent_job_items.assigned_thread_id` references if present

For `logs_2.sqlite`:

- delete from `logs` where `thread_id` matches

For `goals_1.sqlite`:

- delete from `thread_goals` where `thread_id` matches

Each SQLite database should run:

```sql
PRAGMA wal_checkpoint(TRUNCATE);
```

`VACUUM` should be available behind an option because it rewrites the database and may be slower.

## JSON Mutations

For `session_index.jsonl`:

- remove lines whose `id` matches the target thread id

For `.codex-global-state.json` and `.bak`:

- remove target thread id keys from known maps
- remove target thread id values from known arrays
- remove prompt-history entry for the target thread id

The tool must parse JSON structurally and write formatted JSON. It must not use ad hoc string replacement for these files.

## File Mutations

Remove:

- the target thread rollout jsonl file
- shell snapshots matching `{threadId}.*.sh`

The tool should not recursively delete broad directories.

## Active Thread Protection

The tool should refuse purge if:

- the target thread id is the current running Codex thread
- the rollout file is actively growing
- app-server reports the thread as loaded, if a reliable check is implemented

This protection can be conservative. False positives are acceptable; accidental deletion of an active thread is not.

## Version Drift

Codex local storage is not a public stable API.

Before mutation, the tool must:

- check expected files exist
- check required SQLite tables and columns
- check JSON roots have expected object shapes
- fail closed if the data model is unknown

