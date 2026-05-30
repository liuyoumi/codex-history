# Deletion Scope

## Must Remove

- row in `state_5.sqlite.threads`
- dependent rows in supported `state_5.sqlite` tables
- rollout jsonl file referenced by `threads.rollout_path`
- matching line in `session_index.jsonl`
- matching prompt history and thread state in `.codex-global-state.json`
- matching prompt history and thread state in `.codex-global-state.json.bak`
- matching prefixed global-state keys, such as composer drafts stored as `local:<threadId>`

## Should Remove

- matching rows in `logs_2.sqlite.logs`
- matching rows in `goals_1.sqlite.thread_goals`
- matching shell snapshots in `~/.codex/shell_snapshots`

## Orphan Cleanup

`purge-orphans` should remove supported local data for:

- threads whose `state_5.sqlite.threads.rollout_path` points to a missing session or archived session file
- logs-only thread ids that exist in `logs_2.sqlite.logs` but no longer exist in `state_5.sqlite.threads`

Logs-only orphan cleanup should remove only matching `logs_2.sqlite.logs` rows because the full thread metadata is already missing.

Branch relationships must not expand cleanup scope. A parent or child thread should be removed only when that thread is independently classified as orphaned.

## Preserve

- authentication files such as `auth.json`
- user config such as `config.toml`
- plugin, skill, and browser configuration
- unrelated conversations
- unrelated shell snapshots
- unrelated logs

## Explicitly Not Guaranteed

- OpenAI or Codex server-side records
- crash reports
- OS backups
- APFS snapshots
- Time Machine backups
- terminal scrollback
- user-created copies of transcripts
- immediate SQLite database file size reduction after row deletion

## Verification

After purge, the tool should verify:

- target thread id is absent from supported SQLite stores
- target thread id is absent from supported JSON and JSONL stores
- target rollout path no longer exists
- target shell snapshots no longer exist
- logs-only orphan ids no longer exist in supported logs tables

The tool should report any remaining references with file paths, not silently ignore them.

Verification should scan supported stores only. It should not recursively search the entire home directory by default.
