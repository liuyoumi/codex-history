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
codex-history search "keyword"
codex-history purge --id <thread_id> --dry-run
codex-history purge --id <thread_id> --yes
```

`purge --yes` is destructive. It creates a backup first, refuses active-thread matches, mutates supported local Codex stores, and verifies remaining supported references.

`list` and `search` show compact one-line titles. Long Codex titles are truncated with `...`; prompt bodies are not printed.

## Typical Workflow

```bash
codex-history doctor
codex-history search "conversation title"
codex-history purge --id <thread_id>
codex-history purge --id <thread_id> --yes
```

`purge` without `--yes` is a dry run.

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
