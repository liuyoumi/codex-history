# Release Plan

## Branches

- `chore/project-foundation`: initial project scaffold
- `docs/finalize-spec`: reviewed product and technical specification
- `feat/history-cli-mvp`: list, doctor, and purge planning
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
- acceptance criteria reviewed
- implementation plan reviewed

## Milestone 2: Non-Destructive CLI

Required features:

- `doctor`
- `list`
- `list --grep`
- purge plan builder
- JSON output
- fixture test harness
- `--codex-home` support

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
- interactive short-id confirmation with `--force` for non-interactive execution

Exit criteria:

- [x] destructive tests use fixtures only
- [x] active-thread protection exists
- [x] `purge` requires exact unique target
- [x] verification failures exit non-zero
- [ ] macOS manual verification against a disposable Codex home

## Milestone 4: First Release

Required features:

- npm package metadata
- README install and usage
- risk disclaimer
- changelog
- macOS manual verification notes

Version:

- `0.1.0`

Status:

- [x] npm package metadata
- [x] README install and usage
- [x] risk disclaimer
- [x] changelog
- [x] macOS manual verification notes
- [x] final verification commands
