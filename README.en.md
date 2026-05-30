<h1 align="center">Codex History</h1>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@liuyoumi/codex-history?style=flat-square&color=cb9b27" />
  <img alt="platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-2ea043?style=flat-square" />
  <img alt="local only" src="https://img.shields.io/badge/local%20data-only-6e7681?style=flat-square" />
  <img alt="confirm" src="https://img.shields.io/badge/confirm-before%20purge-0969da?style=flat-square" />
  <img alt="license" src="https://img.shields.io/npm/l/@liuyoumi/codex-history?style=flat-square" />
</p>

<p align="center">
  <a href="README.md">中文</a> | <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/liuyoumi/codex-history/main/assets/cover.png" alt="codex-history cover" width="100%" />
</p>

A small CLI for finding and removing local Codex conversation history.

`codex-history` works on local Codex data files on your machine. It lists conversations using the same short titles shown by Codex when available, lets you narrow the list with `--grep`, and deletes resolved conversations or orphaned data only after confirmation.

## Install

```bash
npm install -g @liuyoumi/codex-history
```

Or run it without installing:

```bash
npx @liuyoumi/codex-history doctor
```

## Supported Platforms

`codex-history` has been checked on macOS, Windows, and Linux for install, `doctor`, `list` / `--grep`, and guarded `purge` workflows with confirmation.

| Platform | Status |
| --- | --- |
| macOS | Ready for everyday local history management |
| Windows | Ready for everyday local history management |
| Linux | Ready for everyday local history management |

Codex local data layouts may change between Codex releases. After updating Codex, run `codex-history doctor` before purging conversations.

## Quick Start

```bash
codex-history doctor
codex-history list
codex-history list --grep "Astro"
codex-history purge 019e6885
codex-history purge 019e6885 019e6874
codex-history purge --cwd /Users/me/Projects/example
codex-history purge --grep "Astro"
codex-history purge-orphans
```

`purge` prints the resolved conversation and asks you to type the standard short id before it deletes anything:

```text
About to purge this local Codex conversation:

title: Implement Astro blog visual audit
id: 019e6885-b5ae-7ae0-a50d-ce5f75b0ac08
cwd: /Users/me/Projects/example
updated: 2026-05-28T03:16:01.959Z

This cannot be undone.
Type 019e6885 to confirm:
```

## Commands

| Command | Description |
| --- | --- |
| `codex-history doctor` | Check whether the local Codex data layout is supported. |
| `codex-history list` | List local conversations. |
| `codex-history list --grep <keyword>` | Filter conversations by title, first user message, or preview. |
| `codex-history purge <id...>` | Remove one or more resolved local conversations after confirmation. |
| `codex-history purge --cwd <path>` | Remove local conversations whose working directory contains the path fragment after confirmation. |
| `codex-history purge --grep <keyword>` | Remove local conversations matching title, first user message, or preview after confirmation. |
| `codex-history purge-orphans` | Remove orphaned local data after confirmation. |

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

`--grep` filters by displayed title, first user message, and preview. It does not match thread ids or cwd values, and it does not search or print full transcript bodies.

`--cwd` filters by a working-directory path fragment, so you can provide either a full path or a project name / partial path:

```bash
codex-history list --cwd codex-history
```

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

Remove one or more local Codex conversations by full id or unique short id prefix.

```bash
codex-history purge 019e6885
codex-history purge 019e6885 019e6874
```

When multiple targets are provided, the tool resolves all targets and prints a batch plan before deletion. If any id is missing, ambiguous, or active, the whole batch is refused before mutation. Interactive batch purge requires typing `purge-selected`.

You can also select local conversations with filters:

```bash
codex-history purge --cwd /Users/me/Projects/example
codex-history purge --grep "Astro"
codex-history purge --archived
codex-history purge --cwd /Users/me/Projects/example --grep "Astro"
```

`--cwd`, `--grep`, and `--archived` can be combined. Combined filters delete only conversations that match every provided condition. `--cwd` matches working-directory path fragments, while `--grep` matches only title, first user message, and preview. By default, filter mode matches non-archived conversations only; use `--archived` to target archived conversations. Filtered purge prints a batch plan and matched cwd values, then requires typing `purge-selected`. Filters cannot be combined with explicit ids.

For scripts or non-interactive shells, use `--force`:

```bash
codex-history purge 019e6885 --force
codex-history purge 019e6885 019e6874 --force
codex-history purge --cwd /Users/me/Projects/example --force
```

`--force` skips only interactive confirmation. It still keeps schema validation, active-thread protection, and post-purge verification.

During deletion, `.codex-global-state.json` and `.codex-global-state.json.bak` are structurally rewritten to remove global-state keys that contain the target thread id, such as composer draft keys stored as `local:<threadId>`.

### `purge-orphans`

Remove orphaned local data: conversations whose `state_5.sqlite.threads.rollout_path` points to a missing session or archived session file, and logs-only records that remain in `logs_2.sqlite.logs` without a matching thread in the `threads` table.

```bash
codex-history purge-orphans
```

The command first prints a cleanup plan, affected SQLite row counts, files to delete, and an estimated local disk space impact. You must type `purge-orphans` before it executes.

For scripts or non-interactive shells, use `--force`:

```bash
codex-history purge-orphans --force
```

`--force` skips only interactive confirmation. It still keeps schema validation, active-thread protection, and post-purge verification.

Space reporting is an estimate. After SQLite rows are deleted, database files may not shrink until Codex or another SQLite maintenance step runs vacuum.

## Options

```bash
codex-history --codex-home /path/to/.codex list
```

- `--codex-home` defaults to `~/.codex`.
- Color is enabled only in interactive terminals and respects `NO_COLOR`.

## Safety

Before deleting, `codex-history`:

- validates the supported Codex data model
- resolves the target to exactly one conversation
- refuses the currently active thread when detectable
- removes known references from supported local Codex stores
- verifies supported stores after mutation

This tool only changes local Codex data. It does not delete server-side OpenAI/Codex records, OS backups, terminal scrollback, crash reports, or user-created transcript copies.

If Codex Desktop is already showing the conversation you purge, quit or restart Codex before using it again. A running Codex process may still hold the old conversation in memory, and continuing to chat in that old window can write new local data for the same thread.

## Q&A

### Does this delete server-side Codex data?

No. It only modifies supported local files on your machine.

### Can I recover a purged conversation?

Not with this tool. Treat `purge` as destructive.

### Do I need to restart Codex after purging?

Recommended, especially for Codex Desktop. `purge` updates local files on disk, but a running Codex process may not refresh its in-memory conversation list immediately. Restart Codex before continuing work.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT
