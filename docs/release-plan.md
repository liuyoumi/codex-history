# Release Plan

## Branches

- `chore/project-foundation`: initial project scaffold
- `docs/finalize-spec`: reviewed product and technical specification
- `feat/history-cli-mvp`: non-destructive list, search, doctor, dry-run planning
- `feat/purge-safety`: destructive purge with backups and verification
- `release/v0.1.0`: npm packaging and release notes

## Milestone 1: Specification

Required commits:

- `docs: define cli behavior`
- `docs: finalize deletion scope`
- `docs: finalize technical safety model`

Exit criteria:

- requirements reviewed
- technical design reviewed
- CLI spec reviewed
- safety checklist reviewed

## Milestone 2: Non-Destructive CLI

Required features:

- `doctor`
- `list`
- `search`
- purge plan builder
- JSON output
- fixture test harness

Exit criteria:

- no command mutates `~/.codex`
- typecheck passes
- tests cover supported schema checks

## Milestone 3: Purge Execution

Required features:

- backup creation
- SQLite transactional mutations
- JSON and JSONL structural mutations
- rollout and shell snapshot deletion
- verification

Exit criteria:

- destructive tests use fixtures only
- active-thread protection exists
- `purge --yes` requires exact unique target
- verification failures exit non-zero

## Milestone 4: First Release

Required features:

- npm package metadata
- README install and usage
- risk disclaimer
- changelog
- macOS manual verification notes

Version:

- `0.1.0`

