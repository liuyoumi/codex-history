# codex-history

[English](README.md) | [简体中文](README.zh-CN.md)

A small CLI for finding and removing local Codex conversation history.

`codex-history` works on local Codex data files on your machine. It lists conversations using the same short titles shown by Codex when available, lets you narrow the list with `--grep`, and deletes one resolved conversation only after confirmation.

## Install

```bash
npm install -g @asjk/codex-history
```

Or run it without installing:

```bash
npx @asjk/codex-history doctor
```

## Supported Platforms

- macOS: verified for v0.1
- Windows/Linux: not verified yet

## Quick Start

```bash
codex-history doctor
codex-history list
codex-history list --grep "Astro"
codex-history purge 019e6885
```

`purge` prints the resolved conversation and asks you to type the standard short id before it deletes anything:

```text
About to purge this local Codex conversation:

019e6885  Implement Astro blog visual audit
id: 019e6885-b5ae-7ae0-a50d-ce5f75b0ac08
updated: 2026-05-28T03:16:01.959Z
cwd: /Users/me/Projects/example

A backup will be created before deletion.
Type 019e6885 to confirm:
```

## Commands

| Command | Description |
| --- | --- |
| `codex-history doctor` | Check whether the local Codex data layout is supported. |
| `codex-history list` | List local conversations. |
| `codex-history list --grep <keyword>` | Filter conversations by title, id, or cwd. |
| `codex-history purge <id>` | Remove one resolved local conversation after confirmation. |

### `doctor`

Check whether the local Codex data layout is supported by this version.

```bash
codex-history doctor
```

Run this first after installing, or after a Codex update. If the local data layout is not supported, destructive commands fail closed instead of guessing how to delete.

### `list`

List local Codex conversations.

```bash
codex-history list
codex-history list --grep "Astro"
codex-history list --limit 20
codex-history list --pretty=medium
codex-history list --pretty=full
```

Default output is one line per conversation:

```text
019e6885  Implement Astro blog visual audit
019e6874  Review Astro blog visual plan
```

`--grep` filters by displayed title, thread id, and cwd. It does not search or print prompt bodies.

Use the short id shown by `list`, or paste a full thread id, when running `purge`.

By default, `list` shows non-archived conversations. Use `--archived` for archived conversations only, or `--all` for both archived and non-archived conversations.

Wrap grep text in quotes when it contains spaces:

```bash
codex-history list --grep "Astro blog"
```

`--pretty` formats:

- `oneline`: short id and title
- `medium`: full id, updated time, and cwd
- `full`: `medium` plus created time, archive state, and rollout path

When `list` runs in an interactive terminal without `--limit`, output is sent through the system pager. Piped or redirected output skips the pager automatically.

### `purge`

Remove one local Codex conversation by full id or unique short id prefix.

```bash
codex-history purge 019e6885
```

For scripts or non-interactive shells, use `--force`:

```bash
codex-history purge 019e6885 --force
```

`--force` skips only the interactive short-id confirmation. It still keeps schema validation, mandatory backup, active-thread protection, and post-purge verification.

## Options

```bash
codex-history --codex-home /path/to/.codex list
codex-history --json list --grep "Astro"
codex-history --json purge 019e6885 --force
```

- `--codex-home` defaults to `~/.codex`.
- `--json` prints machine-readable output. For `purge`, JSON output requires `--force` because interactive confirmation is text-only.
- Color is enabled only in interactive terminals and respects `NO_COLOR`.

## Safety

Before deleting, `codex-history`:

- validates the supported Codex data model
- resolves the target to exactly one conversation
- refuses the currently active thread when detectable
- creates a mandatory backup under `~/.codex-history/backups`
- removes known references from supported local Codex stores
- verifies supported stores after mutation

This tool only changes local Codex data. It does not delete server-side OpenAI/Codex records, OS backups, terminal scrollback, crash reports, or user-created transcript copies.

## Q&A

### Does this delete server-side Codex data?

No. It only modifies supported local files on your machine.

### Where are backups stored?

Backups are written under `~/.codex-history/backups`.

### Can I recover a purged conversation?

The tool creates a backup before deletion, but v0.1 does not include an automatic restore command. Treat `purge` as destructive.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT
