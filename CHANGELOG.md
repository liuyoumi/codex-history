# Changelog

## 0.5.0 - 2026-05-29

### Changed

- Narrow `--grep` matching to conversation text fields and let `--cwd` match working-directory path fragments.

## 0.4.0 - 2026-05-29

### Added

- Allow `purge` to select regular conversations with `--cwd`, `--grep`, and `--archived` filters.

## 0.3.0 - 2026-05-29

### Added

- Allow `purge` to accept multiple thread ids or unique short id prefixes in one guarded batch.

## 0.2.0 - 2026-05-29

### Removed

- Remove the public `--json` output mode so the CLI stays focused on human-reviewed cleanup workflows.

## 0.1.4 - 2026-05-29

### Added

- Add `purge-orphans` for guarded cleanup of missing-rollout threads and logs-only orphan records.
- Report estimated local disk space affected by orphan cleanup.

## 0.1.3 - 2026-05-29

### Changed

- Remove purge backup creation and document `purge` as a permanent local deletion flow.
- Report the CLI version from `package.json` instead of a stale hard-coded value.

### Documentation

- Refresh the README cover image to show only the terminal window.
- Add agent workflow guidance for future implementation work.
- Clarify the boundary between `AGENTS.md` and `docs/agent-workflow.md`.

## 0.1.2 - 2026-05-28

### Documentation

- Use Chinese as the default README language.
- Add an English README translation.
- Add README badges and clearer macOS, Windows, and Linux support notes.

## 0.1.1 - 2026-05-28

### Documentation

- Document that Codex Desktop should be restarted after purging a conversation.
- Warn that continuing to chat in an already-open purged conversation can write new local data for the same thread.

## 0.1.0 - 2026-05-27

Initial release candidate.

### Added

- `doctor` command for local Codex data model checks.
- `list` command for local conversation discovery.
- `list --grep` filtering for displayed title, id, and cwd matching.
- `purge <id>` execution by full id or unique short id prefix.
- Interactive purge confirmation by typing the standard short id.
- `purge <id> --force` for non-interactive execution.
- Guarded purge execution with explicit confirmation.
- SQLite cleanup for supported Codex stores.
- JSON and JSONL state cleanup for supported Codex files.
- Rollout jsonl and shell snapshot deletion.
- WAL checkpointing after SQLite mutation.
- Post-purge verification with non-zero exit on remaining supported references.
- Fixture-based tests that do not read or modify a real `~/.codex`.

### Notes

- v0.1.0 is macOS-first.
- Server-side deletion is not supported or claimed.
- Physical secure erase from SSDs, APFS snapshots, or Time Machine backups is not supported.
