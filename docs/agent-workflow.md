# Agent Workflow

This workflow is for Codex or other AI agents working in this repository. It is an internal implementation discipline, not a requirement for the user to review every intermediate step.

## When To Use

Use this workflow before implementation when a task changes:

- user-visible CLI behavior
- command arguments, output, or exit behavior
- purge, safety, storage, or deletion logic
- install, release, or packaging behavior
- tests for any of the above

Small documentation wording edits, badge updates, cover image changes, and formatting-only changes do not usually need the full workflow.

## Temporary Planning

Before editing durable code for an applicable task, create a temporary implementation note. Keep it outside the final committed changes.

The note should cover:

- goal and expected user-visible behavior
- non-goals and boundaries
- files or modules likely to change
- safety risks and failure modes
- test and validation plan
- documentation that may need updates

Review the note internally at least twice before coding:

- Review for product fit, CLI ergonomics, and user-visible behavior.
- Review for implementation boundaries, safety, data integrity, and test coverage.

Revise the note until the implementation path is specific enough to follow. Ask the user only when a product decision, destructive-risk decision, or ambiguous requirement cannot be resolved safely.

## Implementation

- Keep changes scoped to the reviewed plan.
- Prefer existing project patterns over new abstractions.
- For purge behavior, use fixtures or an explicit temporary `--codex-home`; never validate against the real user `~/.codex`.
- Add or update durable tests when behavior changes.
- Temporary scripts, notes, or exploratory fixtures may be used, but must be removed before commit.

## Final Checks

Before committing:

- Remove temporary implementation notes and temporary validation files.
- Update `README.md`, `README.en.md`, `CHANGELOG.md`, and relevant `docs/` files when behavior changes.
- Run the validation commands required by `AGENTS.md`.
- Inspect `git status` and the final diff to ensure only durable project files remain.
