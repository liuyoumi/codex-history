# codex-history

Terminal tool for inspecting and safely purging local Codex conversation history.

> Status: v0.1 implementation in progress. The CLI supports local discovery, dry-run planning, and guarded purge execution with mandatory backups.

## Package

```bash
npm install -g @asjk/codex-history
```

## CLI

```bash
codex-history list
codex-history search "keyword"
codex-history purge --id <thread_id> --dry-run
codex-history purge --id <thread_id> --yes
```

`purge --yes` is destructive. It creates a backup first, refuses active-thread matches, mutates supported local Codex stores, and verifies remaining supported references.

## Project Rules

- Documentation must be finalized and reviewed before purge execution is implemented.
- `purge` must resolve candidates to a unique Codex thread id before modifying files.
- `dry-run` is the default behavior for destructive operations.
- Active threads must not be purged.
- macOS is the first supported and verified platform.
- Backups are mandatory before purge execution.

## Planning Docs

- [Requirements](docs/requirements.md)
- [CLI Spec](docs/cli-spec.md)
- [Technical Design](docs/technical-design.md)
- [Deletion Scope](docs/deletion-scope.md)
- [Safety Checklist](docs/safety-checklist.md)
- [Release Plan](docs/release-plan.md)
- [Acceptance Criteria](docs/acceptance-criteria.md)
- [Implementation Plan](docs/implementation-plan.md)
