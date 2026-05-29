# Deletion Scope

## Must Remove

- row in `state_5.sqlite.threads`
- dependent rows in supported `state_5.sqlite` tables
- rollout jsonl file referenced by `threads.rollout_path`
- matching line in `session_index.jsonl`
- matching prompt history and thread state in `.codex-global-state.json`
- matching prompt history and thread state in `.codex-global-state.json.bak`

## Should Remove

- matching rows in `logs_2.sqlite.logs`
- matching rows in `goals_1.sqlite.thread_goals`
- matching shell snapshots in `~/.codex/shell_snapshots`

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

## Verification

After purge, the tool should verify:

- target thread id is absent from supported SQLite stores
- target thread id is absent from supported JSON and JSONL stores
- target rollout path no longer exists
- target shell snapshots no longer exist

The tool should report any remaining references with file paths, not silently ignore them.

Verification should scan supported stores only. It should not recursively search the entire home directory by default.
