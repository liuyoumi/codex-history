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
node dist/cli.js list --no-pager
node dist/cli.js list --limit 3
node dist/cli.js list --limit 3 --pretty=medium
node dist/cli.js list --limit 1 --pretty=full
node dist/cli.js search Astro --no-pager --limit 1
node dist/cli.js purge --help
node dist/cli.js purge 019e6885
node dist/cli.js purge 019e6885 # in a TTY, enter a wrong short id
CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js doctor
CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js purge definitely-not-a-real-thread --force
```

Expected:

- `typecheck`, `test`, and `build` pass.
- `doctor` reports the current local data model status. In a sandboxed environment, default backup directory creation may fail safely.
- `list --no-pager` prints all non-archived local conversations when no limit is provided.
- `list --limit 3` prints recent local conversations.
- `search Astro --no-pager --limit 1` prints one matching conversation.
- `purge --help` documents `--force` and no longer documents `--yes`.
- `purge 019e6885` refuses in a non-interactive shell before mutation.
- interactive `purge 019e6885` shows target title/id/updated/cwd and refuses when the confirmation input is wrong.
- `CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js doctor` passes when the tool home is writable.
- `purge definitely-not-a-real-thread --force` fails safely without mutating data.

Result:

- `npm run typecheck`: passed.
- `npm test`: passed, 9 tests.
- `npm run build`: passed.
- `NPM_CONFIG_CACHE=/private/tmp/codex-history-npm-cache npm pack --dry-run`: passed.
- `node dist/cli.js doctor`: failed safely because the current sandbox cannot create `/Users/lg/.codex-history`.
- `node dist/cli.js list --no-pager`: passed, 237 rows.
- `node dist/cli.js list --limit 3`: passed.
- `node dist/cli.js list --limit 3 --pretty=medium`: passed.
- `node dist/cli.js list --limit 1 --pretty=full`: passed.
- `node dist/cli.js search Astro --no-pager --limit 1`: passed.
- `node dist/cli.js purge --help`: passed.
- `node dist/cli.js purge 019e6885`: refused in non-interactive shell before mutation.
- interactive `node dist/cli.js purge 019e6885` with wrong confirmation: refused without mutation.
- `CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js doctor`: passed.
- `CODEX_HISTORY_HOME=/private/tmp/codex-history-home node dist/cli.js purge definitely-not-a-real-thread --force`: failed safely with "No Codex thread found".
