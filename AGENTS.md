# AGENTS.md

## Language

- `README.md` is the default Chinese README.
- Keep `README.en.md` in sync when README content changes.
- Keep CLI output in English unless localization is explicitly added.

## Safety

- Never test destructive purge behavior against the real user `~/.codex`.
- Preserve the purge safety model documented in `docs/requirements.md`, `docs/cli-spec.md`, and `docs/safety-checklist.md`.

## Workflow

- For user-visible code changes, bug fixes, command behavior changes, safety-sensitive edits, or release preparation, follow `docs/agent-workflow.md`.

## Documentation

- When user-visible behavior changes, update `README.md`, `README.en.md`, and `CHANGELOG.md`.
- When command behavior, safety guarantees, or storage scope changes, also update the relevant files under `docs/`.

## Validation

- After code changes, run `npm run typecheck`, `npm test`, `npm run build`, and `npm pack --dry-run`.
- For documentation-only changes, run at least `npm pack --dry-run`.

## Packaging

- Keep npm package contents minimal: `dist`, `README.md`, `README.en.md`, `CHANGELOG.md`, and `LICENSE`.
- Do not publish internal `docs/` or large image assets unless explicitly requested.
