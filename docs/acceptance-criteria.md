# Acceptance Criteria

## v0.1 Documentation Gate

The specification is ready for implementation when:

- requirements define user workflow and non-goals
- CLI spec defines command behavior and exit codes
- technical design defines supported stores and mutation strategy
- deletion scope defines what is removed and what is not guaranteed
- safety checklist defines purge guards
- review notes mark product, technical, and safety reviews accepted

Current status: accepted for non-destructive implementation.

## Non-Destructive MVP Gate

The `feat/history-cli-mvp` milestone is complete when:

- `codex-history doctor` validates a fixture Codex home
- `codex-history list` reads threads from a fixture `state_5.sqlite`
- `codex-history search` matches title, id, first user message, preview, and cwd
- `codex-history purge --id <id>` prints a dry-run plan without modifying data
- `codex-history purge --title <title>` refuses duplicate exact-title matches
- `codex-history purge --contains <keyword> --yes` refuses destructive execution
- `--codex-home <path>` works for all commands
- `--json` returns machine-readable output for supported commands
- tests do not read or write the developer's real `~/.codex`
- `npm run typecheck`, `npm run build`, and `npm test` pass

## Purge Safety Gate

The `feat/purge-safety` milestone is complete when:

- [x] `purge --yes` requires a unique target
- [x] backup is mandatory and includes a manifest
- [x] schema validation runs before mutation
- [x] active-thread protection runs before mutation
- [x] SQLite mutations use transactions
- [x] JSON mutations use structural parsing
- [x] WAL checkpointing runs after SQLite mutation
- [x] verification runs after purge
- [x] verification failure exits non-zero
- [x] destructive tests run only against temporary fixtures

Current status: implemented in `feat/purge-safety`; pending broader manual verification before release.

## Release Gate

The `release/v0.1.0` milestone is complete when:

- README documents install, usage, and risks
- CHANGELOG includes the first release notes
- package metadata is ready for npm
- macOS manual verification is recorded
- GitHub repository has a release branch
