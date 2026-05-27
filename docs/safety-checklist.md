# Safety Checklist

## Before Purge

- [ ] Resolve user input to exactly one thread id.
- [ ] Show title, cwd, updated time, and rollout path.
- [ ] Default to dry-run.
- [ ] Require `--yes` for destructive execution.
- [ ] Refuse to purge active thread.
- [ ] Refuse fuzzy destructive deletion.
- [ ] Validate SQLite schema.
- [ ] Validate JSON file shapes.
- [ ] Build complete purge plan before changing anything.
- [ ] Create backup.
- [ ] Refuse purge when backup creation fails.

## During Purge

- [ ] Use SQLite transactions.
- [ ] Avoid broad recursive deletion.
- [ ] Use structural JSON parsing and writing.
- [ ] Stop on unexpected schema or parse failure.
- [ ] Keep a machine-readable operation report.
- [ ] Checkpoint SQLite WAL files after mutation.

## After Purge

- [ ] Run WAL checkpoints.
- [ ] Optionally run `VACUUM`.
- [ ] Verify supported stores no longer reference the target thread id.
- [ ] Print any remaining references.
- [ ] Exit non-zero if verification fails.

## Release Gate

- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Tests pass against fixtures.
- [ ] README includes risk disclaimer.
- [ ] README documents that server-side deletion is not guaranteed.
- [ ] macOS manual verification notes are recorded.
