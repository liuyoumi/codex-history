# codex-history

Terminal tool for inspecting and safely purging local Codex conversation history.

> Status: planning and foundation stage. The first implementation milestone is docs-first and macOS-focused.

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

## Project Rules

- Documentation must be finalized and reviewed before purge execution is implemented.
- `purge` must resolve candidates to a unique Codex thread id before modifying files.
- `dry-run` is the default behavior for destructive operations.
- Active threads must not be purged.
- macOS is the first supported and verified platform.

