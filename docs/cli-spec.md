# CLI Spec

## Principles

- Human-readable output is the default.
- Destructive commands default to dry-run behavior.
- Machine-readable JSON output should be available with `--json`.
- Search may be fuzzy; purge resolution must be exact.
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
- backup directory can be created

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
codex-history list --json
```

Default behavior:

- show non-archived local threads
- sort by `updated_at` descending
- limit to 20 rows

Columns:

- short id
- title
- updated time
- cwd
- rollout status

## `search`

```bash
codex-history search "keyword"
codex-history search "keyword" --all
codex-history search "keyword" --json
```

Search fields:

- thread id
- title
- first user message
- preview
- cwd

Search is case-insensitive for ASCII text. Locale-sensitive fuzzy matching is not required in `0.1`.

## `purge`

```bash
codex-history purge --id <thread_id>
codex-history purge --id <thread_id> --yes
codex-history purge --title "exact title"
codex-history purge --title "exact title" --yes
```

Default behavior:

- build and print a dry-run plan
- do not modify local Codex data

Execution behavior:

- requires `--yes`
- requires a unique thread id
- requires backup creation
- refuses active threads
- runs verification after mutation

Unsupported in `0.1`:

```bash
codex-history purge --contains "keyword" --yes
```

`--contains` may print matching candidates, but must not execute purge in `0.1`.

## Exit Codes

- `0`: success
- `1`: validation failure, unsupported data model, or verification failure
- `2`: invalid CLI arguments
- `3`: destructive command refused for safety

