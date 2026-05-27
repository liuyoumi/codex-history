# Review Notes

## Review 1: Product Requirements

Status: pending

Questions:

- Are `list`, `search`, and `purge` enough for `0.1`?
- Should `archive` be included in `0.1`, or kept for a later release?
- Should backup be mandatory for `0.1`?

## Review 2: Technical Design

Status: pending

Questions:

- Is direct SQLite mutation acceptable for this tool?
- Should `logs_2.sqlite` cleanup be default or optional?
- Should `VACUUM` be default or explicit?

## Review 3: Safety

Status: pending

Questions:

- What should count as an active thread?
- Should purge by title require exact title only?
- Should fuzzy matching be search-only and never delete directly?

