# Safety Checklist

## Before Purge

- [x] Resolve user input to exactly one thread id.
- [x] Show title, full id, cwd, and updated time before confirmation.
- [x] Require interactive short-id confirmation unless `--force` is used.
- [x] Refuse to purge active thread.
- [x] Refuse fuzzy destructive deletion.
- [x] Validate SQLite schema.
- [x] Validate JSON file shapes.
- [x] Build complete purge plan before changing anything.
- [x] Create backup.
- [x] Refuse purge when backup creation fails.

## During Purge

- [x] Use SQLite transactions.
- [x] Avoid broad recursive deletion.
- [x] Use structural JSON parsing and writing.
- [x] Stop on unexpected schema or parse failure.
- [x] Keep a machine-readable operation report.
- [x] Checkpoint SQLite WAL files after mutation.

## After Purge

- [x] Run WAL checkpoints.
- [x] Skip automatic `VACUUM` in v0.1 by design.
- [x] Verify supported stores no longer reference the target thread id.
- [x] Print any remaining references.
- [x] Exit non-zero if verification fails.

## Release Gate

- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.
- [x] Tests pass against fixtures.
- [x] README includes risk disclaimer.
- [x] README documents that server-side deletion is not guaranteed.
- [x] macOS manual verification notes are recorded.
