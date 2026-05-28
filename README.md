# codex-history

Terminal tool for inspecting and safely purging local Codex conversation history.

> Status: v0.1 release candidate. The CLI supports local discovery, dry-run planning, and guarded purge execution with mandatory backups.

## Package

```bash
npm install -g @asjk/codex-history
```

Or run without installing:

```bash
npx @asjk/codex-history doctor
```

## CLI

```bash
codex-history doctor
codex-history list
codex-history list --pretty=medium
codex-history search "keyword"
codex-history purge --id <short_or_full_thread_id> --dry-run
codex-history purge --id <short_or_full_thread_id> --yes
```

`purge --yes` is destructive. It creates a backup first, refuses active-thread matches, mutates supported local Codex stores, and verifies remaining supported references.

`list` and `search` default to one-line output, similar to `git log --oneline`. They show the same compact conversation names Codex uses in its history list when available. Long fallback titles are truncated with `...`; prompt bodies are not printed.

## Typical Workflow

```bash
codex-history doctor
codex-history search "conversation title"
codex-history purge --id <thread_id>
codex-history purge --id <thread_id> --yes
```

`purge` without `--yes` is a dry run.

Short ids from `list` can be used with `purge` as long as the prefix uniquely identifies one thread.

## Output Formats

```bash
codex-history list --pretty=oneline
codex-history list --pretty=medium
codex-history list --pretty=full
```

`oneline` is the default. `medium` adds full id, update time, and cwd. `full` also adds creation time, archive state, and rollout path.

When `list` or `search` runs in an interactive terminal without `--limit`, the command reads all matching conversations and sends output through the system pager. Use `--limit` to cap rows or `--no-pager` to disable paging.

## Targeting a Custom Codex Home

Use `--codex-home` for testing against a disposable copy:

```bash
codex-history --codex-home /tmp/codex-home doctor
codex-history --codex-home /tmp/codex-home purge --id <thread_id> --yes
```

## JSON Output

```bash
codex-history --json list
codex-history --json purge --id <thread_id>
```

## Safety and Limits

This tool only works on local Codex data stores on your machine.

It does not claim to delete:

- OpenAI or Codex server-side records
- OS backups, APFS snapshots, or Time Machine backups
- terminal scrollback
- user-created transcript copies
- crash reports or unrelated app caches

Before executing purge, the tool:

- validates the local Codex data model
- resolves the target to exactly one thread
- creates a mandatory backup under `~/.codex-history/backups`
- refuses the currently active thread when detectable
- verifies supported local stores after mutation

## Project Rules

- Documentation must be finalized and reviewed before purge execution is implemented.
- `purge` must resolve candidates to a unique Codex thread id before modifying files.
- `dry-run` is the default behavior for destructive operations.
- Active threads must not be purged.
- macOS is the first supported and verified platform.
- Backups are mandatory before purge execution.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Planning Docs

- [Requirements](docs/requirements.md)
- [CLI Spec](docs/cli-spec.md)
- [Technical Design](docs/technical-design.md)
- [Deletion Scope](docs/deletion-scope.md)
- [Safety Checklist](docs/safety-checklist.md)
- [Release Plan](docs/release-plan.md)
- [Acceptance Criteria](docs/acceptance-criteria.md)
- [Implementation Plan](docs/implementation-plan.md)
