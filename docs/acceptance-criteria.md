# Acceptance Criteria

## v0.1 Documentation Gate

The specification is ready for implementation when:

- requirements define user workflow and non-goals
- CLI spec defines command behavior and exit codes
- technical design defines supported stores and mutation strategy
- deletion scope defines what is removed and what is not guaranteed
- safety checklist defines purge guards
- review notes mark product, technical, and safety reviews accepted

Current status: implemented for the v0.1 release candidate.

## Non-Destructive MVP Gate

The `feat/history-cli-mvp` milestone is complete when:

- `codex-history doctor` validates a fixture Codex home
- `codex-history list` reads threads from a fixture `state_5.sqlite`
- `codex-history list --grep <keyword>` matches displayed title, id, and cwd
- `codex-history purge <id>` requires interactive short-id confirmation before mutation
- `codex-history purge <id> <id>` requires interactive batch confirmation before mutation
- `codex-history purge <id> --force` executes without interactive confirmation
- `--codex-home <path>` works for all commands
- tests do not read or write the developer's real `~/.codex`
- `npm run typecheck`, `npm run build`, and `npm test` pass

## Purge Safety Gate

The `feat/purge-safety` milestone is complete when:

- [x] `purge` requires a unique target
- [x] purge is permanent and does not create tool-owned backups
- [x] schema validation runs before mutation
- [x] active-thread protection runs before mutation
- [x] SQLite mutations use transactions
- [x] JSON mutations use structural parsing
- [x] WAL checkpointing runs after SQLite mutation
- [x] verification runs after purge
- [x] verification failure exits non-zero
- [x] destructive tests run only against temporary fixtures

Current status: implemented for the v0.1 release candidate.

## Release Gate

The `release/v0.1.0` milestone is complete when:

- [x] README documents install, usage, and risks
- [x] CHANGELOG includes the first release notes
- [x] package metadata is ready for npm
- [x] macOS manual verification is recorded
- [x] GitHub repository has a release branch
