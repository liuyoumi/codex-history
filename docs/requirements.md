# Requirements

## Goal

Build a terminal tool that helps users inspect and safely remove local Codex conversation history from their own machine.

The tool should satisfy users who want a conversation to stop appearing in Codex Desktop or CLI history and who also want related local traces removed as completely as practical.

## Project Identity

- Project name: `codex-history`
- npm package: `@asjk/codex-history`
- CLI command: `codex-history`
- Repository: `git@github.com:liuyoumi/codex-history.git`
- Local path: `/Users/lg/Projects/codex-history`

## Initial Platform

Version `0.1` targets macOS first.

The implementation should keep path handling portable enough for future Windows and Linux support, but macOS is the only platform that must be verified before the first release.

## Core Commands

```bash
codex-history list
codex-history search "keyword"
codex-history purge --id <thread_id> --dry-run
codex-history purge --id <thread_id> --yes
codex-history doctor
```

Planned resolution helpers:

```bash
codex-history purge --title "exact title"
codex-history purge --contains "keyword"
```

Deletion must internally resolve to exactly one Codex thread id before modifying local data.

`doctor` checks whether the local Codex data model is supported by the installed tool version.

## User Workflow

1. User lists or searches conversations.
2. Tool displays candidate thread id, title, updated time, cwd, and rollout path.
3. User runs a dry-run purge.
4. Tool reports every planned file and database mutation.
5. User reruns with `--yes` to execute.
6. Tool verifies that the target thread id is no longer present in supported local Codex data stores.

## Non-Goals

- Do not claim to delete server-side OpenAI or Codex service data.
- Do not claim physical secure erase from SSD/APFS snapshots or Time Machine backups.
- Do not purge an active thread.
- Do not implement destructive behavior before the requirements and technical design are reviewed and accepted.
- Do not support fuzzy-match destructive deletion in `0.1`.
- Do not mutate global Codex files when schema validation fails.

## First Release Scope

Version `0.1` should support:

- list local threads from `~/.codex/state_5.sqlite`
- search by title and first-message preview
- dry-run purge planning
- purge by unique thread id
- exact-title purge only when it resolves to one thread
- keyword search that prints candidates but does not delete directly
- remove related local records from supported Codex stores
- `doctor` command for data model checks
- fixture-based tests for purge planning and purge execution
- README installation instructions for npm

## Deletion UX Rules

The tool must make destructive behavior intentionally boring and hard to trigger by accident.

- `purge` without `--yes` is always a dry run.
- `purge --contains` is search-only in `0.1` and must refuse execution.
- `purge --title` requires exact title match.
- exact title matches that return more than one thread must refuse execution.
- every purge plan must show the resolved thread id before deletion.
- every purge plan must show all known stores that will be touched.
- successful purge must print a verification summary.

## Backup Requirements

Default behavior:

- create a timestamped backup before destructive purge
- store backups under `~/.codex-history/backups`
- include changed SQLite databases, JSON/JSONL state files, rollout file, and shell snapshots
- print the backup path in the final report

Options:

- `--no-backup` may be supported later, but should not be included in `0.1`
- backup restore can be documented manually in `0.1`; a `restore` command is not required for first release

## Failure Policy

The tool should fail closed.

Fail without modifying data when:

- required SQLite schema is missing or unknown
- required files cannot be parsed
- selected thread cannot be resolved uniquely
- selected thread appears active
- backup creation fails
- dry-run plan cannot account for a supported store

If purge starts and a later step fails, the tool must report partial work and verification failures clearly.
