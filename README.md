# codex-history

Terminal tool for inspecting and safely purging local Codex conversation history.

> Status: v0.1 release candidate. The CLI supports local discovery and guarded purge execution with mandatory backups.

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
codex-history purge <short_or_full_thread_id>
codex-history purge <short_or_full_thread_id> --force
```

`purge` is destructive after confirmation. It creates a backup first, refuses active-thread matches, mutates supported local Codex stores, and verifies remaining supported references.

`list` and `search` default to one-line output, similar to `git log --oneline`. They show the same compact conversation names Codex uses in its history list when available. Long fallback titles are truncated with `...`; prompt bodies are not printed.

## Typical Workflow

```bash
codex-history doctor
codex-history search "conversation title"
codex-history purge <thread_id>
```

`purge` shows the resolved target and asks you to type the standard short id before deleting. Use `--force` only when you intentionally want to skip interactive confirmation.

Short ids from `list` can be used with `purge` as long as the prefix uniquely identifies one thread.

Interactive confirmation looks like this:

```text
About to purge this local Codex conversation:

019e6885  Example conversation title
id: 019e6885-b5ae-7ae0-a50d-ce5f75b0ac08
updated: 2026-05-28T03:16:01.959Z
cwd: /Users/me/Projects/example

A backup will be created before deletion.
Type 019e6885 to confirm:
```

## Output Formats

```bash
codex-history list --pretty=oneline
codex-history list --pretty=medium
codex-history list --pretty=full
```

`oneline` is the default. `medium` adds full id, update time, and cwd. `full` also adds creation time, archive state, and rollout path.

When `list` or `search` runs in an interactive terminal without `--limit`, the command reads all matching conversations and sends output through the system pager. Use `--limit` to cap rows. Piped or redirected output skips the pager automatically.

## Targeting a Custom Codex Home

Use `--codex-home` for testing against a disposable copy:

```bash
codex-history --codex-home /tmp/codex-home doctor
codex-history --codex-home /tmp/codex-home purge <thread_id> --force
```

## JSON Output

```bash
codex-history --json list
codex-history --json purge <thread_id> --force
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
- Interactive purge requires typing the standard short id before deletion unless `--force` is used.
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
