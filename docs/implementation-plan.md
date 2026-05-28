# Implementation Plan

## Order

1. Build shared path and schema validation modules.
2. Implement fixture builder for tests.
3. Implement `doctor`.
4. Implement thread repository reads.
5. Implement `list`.
6. Implement `list --grep`.
7. Implement thread resolution for purge planning.
8. Implement purge planner.
9. Add JSON output.
10. Start purge safety implementation only after MVP review.

## Proposed Source Layout

```text
src/
  cli.ts
  commands/
    doctor.ts
    list.ts
    purge.ts
  core/
    paths.ts
    schema.ts
    threads.ts
    planner.ts
    output.ts
  stores/
    sqlite.ts
    json-state.ts
    files.ts
  safety/
    active-thread.ts
    backup.ts
    verify.ts
test/
  fixtures/
  helpers/
```

## Commit Plan

For `feat/history-cli-mvp`:

```text
feat: add codex home path resolution
feat: add codex data model doctor
feat: add thread listing
feat: add thread filtering
feat: add purge planner
test: add fixture coverage for mvp commands
```

For `feat/purge-safety`:

```text
feat: add backup manifest creation
feat: add sqlite purge mutations
feat: add json state purge mutations
feat: add purge verification
test: add fixture coverage for purge execution
```

## Implementation Boundaries

`feat/history-cli-mvp` must not modify real Codex data.

`feat/purge-safety` may implement destructive behavior, but tests must use temporary fixtures and the command must require explicit confirmation or `--force`.
