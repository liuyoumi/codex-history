# Manual Verification

## 2026-05-27 macOS Release Candidate Check

Scope:

- Verify package scripts.
- Verify CLI can run against the current local Codex home in read-only commands.
- Verify destructive purge behavior only against fixture-based tests.
- Do not purge the real `~/.codex` during release preparation.

Commands:

```bash
npm run typecheck
npm test
npm run build
NPM_CONFIG_CACHE=/private/tmp/codex-history-npm-cache npm pack --dry-run
node dist/cli.js doctor
node dist/cli.js list --limit 3
CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js doctor
CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js purge --id definitely-not-a-real-thread --yes
```

Expected:

- `typecheck`, `test`, and `build` pass.
- `doctor` reports the current local data model status. In a sandboxed environment, default backup directory creation may fail safely.
- `list --limit 3` prints recent local conversations.
- `CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js doctor` passes when the tool home is writable.
- `purge --id definitely-not-a-real-thread --yes` fails safely without mutating data.

Result:

- `npm run typecheck`: passed.
- `npm test`: passed, 9 tests.
- `npm run build`: passed.
- `NPM_CONFIG_CACHE=/private/tmp/codex-history-npm-cache npm pack --dry-run`: passed.
- `node dist/cli.js doctor`: failed safely because the current sandbox cannot create `/Users/lg/.codex-history`.
- `node dist/cli.js list --limit 3`: passed.
- `CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js doctor`: passed.
- `CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js purge --id definitely-not-a-real-thread --yes`: failed safely with "No Codex thread found".
