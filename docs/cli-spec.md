# CLI Spec

## Principles

- Human-readable output is the default.
- Destructive commands require target confirmation by default.
- Machine-readable JSON output should be available with `--json`.
- `purge-orphans` is human-readable only and does not support JSON output.
- Search may be broad; purge resolution must be a unique full id or short id prefix.
- Any command that cannot validate the Codex data model must fail closed.

## Global Options

```bash
codex-history --help
codex-history --version
codex-history --codex-home <path>
codex-history --json
```

Defaults:

- `--codex-home` defaults to `~/.codex`
- output defaults to text

## `doctor`

```bash
codex-history doctor
codex-history doctor --json
```

Checks:

- Codex home directory exists
- supported SQLite files exist
- required tables and columns exist
- supported JSON files parse
- session index parses as JSONL

Exit codes:

- `0`: supported
- `1`: unsupported or invalid

## `list`

```bash
codex-history list
codex-history list --limit 20
codex-history list --all
codex-history list --archived
codex-history list --cwd /path/to/project
codex-history list --grep "keyword"
codex-history list --pretty=oneline
codex-history list --pretty=medium
codex-history list --pretty=full
codex-history list --json
```

Default behavior:

- show non-archived local threads
- sort by `updated_at` descending
- show one-line rows
- read all rows unless `--limit` is provided
- filter by thread id, title, and cwd when `--grep` is provided
- use pager in an interactive terminal when no limit is provided
- skip pager automatically when output is piped or redirected

`oneline` columns:

- short id
- title

`medium` adds:

- full id
- updated time
- cwd

`full` adds:

- created time
- archive state
- rollout status

`--grep` fields:

- thread id
- title
- cwd

`--grep` reads all rows before applying `--limit`, so a cap only limits displayed matches.

`--grep` is case-insensitive for ASCII text. Locale-sensitive fuzzy matching is not required in `0.1`.

Prompt bodies are not searched because this tool is meant to match Codex history list entries, not dump transcript content.

## `purge`

```bash
codex-history purge <thread_id>
codex-history purge <thread_id> --force
```

Default behavior:

- resolve the target to a unique full id or short id prefix
- print the target short id, title, full id, updated time, and cwd
- require the user to type the standard short id before deletion
- refuse non-interactive execution unless `--force` is provided

Execution behavior:

- requires a unique thread id or unique short id prefix
- refuses active threads
- runs verification after mutation

`--force` skips only interactive confirmation. It does not skip schema validation, active-thread checks, or verification.

`--json purge <thread_id>` requires `--force`, because interactive confirmation is text-only.

## `purge-orphans`

```bash
codex-history purge-orphans
codex-history purge-orphans --force
```

Default behavior:

- scan supported stores for orphaned local Codex data
- include threads whose `rollout_path` points to a missing session or archived session file
- include logs-only thread ids that exist in `logs_2.sqlite.logs` but not in `state_5.sqlite.threads`
- print orphan counts, affected SQLite rows, files to delete, and estimated local disk space affected
- require the user to type `purge-orphans` before deletion
- refuse non-interactive execution unless `--force` is provided

Execution behavior:

- does not support JSON output
- refuses active orphan thread targets when detectable
- does not recursively scan broad directories
- does not expand deletion to parent or child branches unless those threads are independently orphaned
- removes matching supported SQLite, JSON, JSONL, and shell snapshot references
- runs verification after mutation

`--force` skips only interactive confirmation. It does not skip schema validation, active-thread checks, or verification.

Space reporting is an estimate. SQLite database files may not shrink immediately after row deletion.

## Exit Codes

- `0`: success
- `1`: validation failure, unsupported data model, or verification failure
- `2`: invalid CLI arguments
- `3`: destructive command refused for safety
