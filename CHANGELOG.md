# Changelog

## 0.1.0 - 2026-05-27

Initial release candidate.

### Added

- `doctor` command for local Codex data model checks.
- `list` command for local conversation discovery.
- `search` command for title, id, prompt, preview, and cwd matching.
- `purge` dry-run planning by id or exact title.
- Guarded `purge --yes` execution with mandatory backups.
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

