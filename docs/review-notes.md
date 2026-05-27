# Review Notes

## Review 1: Product Requirements

Status: accepted for v0.1

Questions:

- Are `list`, `search`, `doctor`, and `purge` enough for `0.1`?
- Should `archive` be kept out of `0.1`?
- Should backup be mandatory for `0.1`?

Decisions:

- Include `doctor` in `0.1`.
- Keep `archive` out of `0.1`.
- Make backup mandatory in `0.1`.
- Permit exact-title purge only when it resolves to one thread.
- Refuse fuzzy destructive purge.
- Support npm global install and `npx` usage.
- Target macOS for verified `0.1` behavior.

## Review 2: Technical Design

Status: accepted for v0.1

Questions:

- Is direct SQLite mutation acceptable for this tool?
- Should `logs_2.sqlite` cleanup be default?
- Should `VACUUM` be excluded from `0.1`?

Decisions:

- Use direct SQLite mutation because there is no official delete API.
- Clean `logs_2.sqlite` by default because the goal is local trace removal.
- Require WAL checkpointing.
- Exclude automatic `VACUUM` from `0.1`; consider explicit option later.
- Treat `state_5.sqlite.threads` as the canonical thread discovery source.
- Keep all destructive tests fixture-based.

## Review 3: Safety

Status: accepted for v0.1

Questions:

- What should count as an active thread?
- Should purge by title require exact title only?
- Should fuzzy matching be search-only and never delete directly?

Decisions:

- Treat active-thread detection conservatively.
- Use exact-title matching only for destructive title resolution.
- Keep fuzzy matching search-only in `0.1`.
- Refuse purge if backup cannot be created.
- Refuse purge if schema validation fails.
- Refuse purge if verification cannot run.

## Final v0.1 Spec Status

Status: ready for non-destructive implementation

Allowed next work:

- implement `doctor`
- implement `list`
- implement `search`
- implement dry-run purge planning
- add fixture tests

Still blocked:

- `purge --yes`
- SQLite mutation against real Codex stores
- JSON/JSONL mutation against real Codex stores
- rollout file deletion
