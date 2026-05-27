# Review Notes

## Review 1: Product Requirements

Status: draft updated

Questions:

- Are `list`, `search`, `doctor`, and `purge` enough for `0.1`?
- Should `archive` be kept out of `0.1`?
- Should backup be mandatory for `0.1`?

Draft decisions:

- Include `doctor` in `0.1`.
- Keep `archive` out of `0.1`.
- Make backup mandatory in `0.1`.
- Permit exact-title purge only when it resolves to one thread.
- Refuse fuzzy destructive purge.

## Review 2: Technical Design

Status: draft updated

Questions:

- Is direct SQLite mutation acceptable for this tool?
- Should `logs_2.sqlite` cleanup be default?
- Should `VACUUM` be excluded from `0.1`?

Draft decisions:

- Use direct SQLite mutation because there is no official delete API.
- Clean `logs_2.sqlite` by default because the goal is local trace removal.
- Require WAL checkpointing.
- Exclude automatic `VACUUM` from `0.1`; consider explicit option later.

## Review 3: Safety

Status: draft updated

Questions:

- What should count as an active thread?
- Should purge by title require exact title only?
- Should fuzzy matching be search-only and never delete directly?

Draft decisions:

- Treat active-thread detection conservatively.
- Use exact-title matching only for destructive title resolution.
- Keep fuzzy matching search-only in `0.1`.
- Refuse purge if backup cannot be created.
