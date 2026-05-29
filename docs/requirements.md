# Requirements

## Goal

Build a terminal tool that helps users inspect and safely remove local Codex conversation history from their own machine.

The tool should satisfy users who want a conversation to stop appearing in Codex Desktop or CLI history and who also want related local traces removed as completely as practical.

## Project Identity

- Project name: `codex-history`
- npm package: `@liuyoumi/codex-history`
- CLI command: `codex-history`
- Repository: `git@github.com:liuyoumi/codex-history.git`

## Supported Platforms

Version `0.1` supports macOS, Windows, and Linux.

The implementation keeps path handling portable and defaults to the local Codex home unless `--codex-home` is provided.

## Core Commands

```bash
codex-history list
codex-history list --grep "keyword"
codex-history purge <thread_id>
codex-history purge <thread_id> <thread_id>
codex-history purge --cwd /path/to/project
codex-history purge --grep "keyword"
codex-history purge --archived
codex-history purge <thread_id> --force
codex-history purge-orphans
codex-history purge-orphans --force
codex-history doctor
```

Single-thread deletion must internally resolve to exactly one Codex thread id before modifying local data.

Multi-thread deletion must resolve every provided id or short id prefix before modifying local data. If any target is missing, ambiguous, or active, the whole batch must fail before mutation.

Filtered deletion must use explicit purge filters such as `--cwd`, `--grep`, and `--archived`. Filters combine as an intersection, cannot be combined with explicit ids, and must build a full batch plan before modifying local data. `--cwd` matches working-directory path fragments. `--grep` matches conversation text fields such as title, first user message, and preview; it must not match thread ids or cwd values.

Orphan cleanup must build a complete cleanup plan before modifying local data. It should target threads whose rollout files are missing and logs-only thread ids that no longer exist in `state_5.sqlite.threads`.

`doctor` checks whether the local Codex data model is supported by the installed tool version.

## User Workflow

1. User lists or filters conversations.
2. Tool displays candidate thread id, title, updated time, cwd, and rollout path.
3. User runs `purge <id>`.
4. Tool displays the resolved target title, full id, updated time, and cwd.
5. User types the standard short id to confirm deletion.
6. Tool executes purge and verifies that the target thread id is no longer present in supported local Codex data stores.

For explicit multi-target purge:

1. User runs `purge <id> <id> ...`.
2. Tool resolves all provided ids or short id prefixes.
3. Tool displays the unique target count, skipped duplicate input count, target examples, and affected row counts.
4. User types `purge-selected` to confirm deletion.
5. Tool executes purge for each unique target and verifies supported local Codex data stores.

For filtered purge:

1. User runs `purge --cwd <path>`, `purge --grep <keyword>`, `purge --archived`, or a supported combination.
2. Tool lists matching regular conversations from supported local stores.
3. Tool displays the filter selection, unique target count, matched cwd values when relevant, target examples, and affected row counts.
4. User types `purge-selected` to confirm deletion.
5. Tool executes purge for each selected target and verifies supported local Codex data stores.

For orphan cleanup:

1. User runs `purge-orphans`.
2. Tool displays orphan thread counts, logs-only orphan counts, affected SQLite rows, files to delete, and estimated local disk space affected.
3. User types `purge-orphans` to confirm cleanup.
4. Tool executes cleanup and verifies supported local Codex data stores.

## Non-Goals

- Do not claim to delete server-side OpenAI or Codex service data.
- Do not claim physical secure erase from SSD/APFS snapshots or Time Machine backups.
- Do not purge an active thread.
- Do not implement destructive behavior before the requirements and technical design are reviewed and accepted.
- Do not support destructive deletion without explicit ids or explicit purge filters.
- Do not allow destructive filter mode without at least one explicit purge filter.
- Do not mutate global Codex files when schema validation fails.
- Do not expand orphan cleanup across parent or child branch relationships unless that related thread is independently orphaned.

## First Release Scope

Version `0.1` should support:

- list local threads from `~/.codex/state_5.sqlite`
- filter by displayed title, first user message, and preview with `list --grep`
- filter by working-directory path fragment with `list --cwd`
- purge by one or more unique thread ids
- purge regular conversations selected by `--cwd`, `--grep`, and `--archived` filters
- purge orphaned local data whose rollout files are missing
- purge logs-only orphan records without treating them as full threads
- remove related local records from supported Codex stores
- `doctor` command for data model checks
- fixture-based tests for purge planning and purge execution
- README installation instructions for npm

## Deletion UX Rules

The tool must make destructive behavior intentionally boring and hard to trigger by accident.

- `purge` must show the resolved thread id before deletion.
- interactive purge requires typing the standard short id before deletion.
- interactive multi-target purge requires typing `purge-selected` before deletion.
- interactive filtered purge requires typing `purge-selected` before deletion.
- non-interactive purge requires `--force`.
- `--force` skips only interactive confirmation.
- successful purge must print a verification summary.
- `purge-orphans` must show a cleanup plan before deletion.
- interactive orphan cleanup requires typing `purge-orphans` before deletion.
- orphan cleanup must report estimated local disk space affected without promising that SQLite database files immediately shrink.

## Recovery Requirements

Default behavior:

- do not create tool-owned backups before destructive purge
- describe purge as permanent local deletion
- rely on explicit target confirmation, active-thread protection, and post-purge verification for safety

## Failure Policy

The tool should fail closed.

Fail without modifying data when:

- required SQLite schema is missing or unknown
- required files cannot be parsed
- selected thread cannot be resolved uniquely
- selected thread appears active
- any selected batch target cannot be resolved uniquely or appears active
- filtered purge has no filter, mixes filters with ids, or contains an active selected target
- purge plan cannot account for a supported store
- orphan cleanup cannot build a complete supported-store plan

If purge starts and a later step fails, the tool must report partial work and verification failures clearly.
