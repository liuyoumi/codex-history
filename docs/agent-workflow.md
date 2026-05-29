# Agent Workflow

This workflow is for Codex or other AI agents working in this repository. It expands the workflow rule in `AGENTS.md`; it is an internal implementation discipline, not a requirement for the user to review every intermediate step.

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

## Branching

Use a lightweight topic-branch workflow for non-trivial work.

- Start user-visible code changes, bug fixes, command behavior changes, safety-sensitive edits, and release preparation from a topic branch.
- Keep `main` as the stable integration branch.
- Small documentation wording edits, badge updates, cover image refreshes, and formatting-only changes may be committed directly when the work is low risk.
- Prefer clear branch names such as `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, or `release/<version>`.
- For GitHub issue work, include the issue number in the branch name when practical, and link the pull request back to the issue with `Refs #<number>` or `Closes #<number>`.
- Before merging back to `main`, run the required validation and inspect the final diff.

## Implementation

- Keep changes scoped to the reviewed plan.
- Prefer existing project patterns over new abstractions.
- For purge behavior, preserve the documented safety guarantees: unique id resolution, confirmation unless `--force`, permanent deletion warning, active-thread protection, and verification.
- Validate purge behavior only with fixtures or an explicit temporary `--codex-home`.
- Add or update durable tests when behavior changes.
- Temporary scripts, notes, or exploratory fixtures may be used, but must be removed before commit.

## Release Preparation

For npm releases, the agent should complete every preparation step except the final publish unless the user explicitly delegates publishing.

Agent-owned release steps:

- confirm the latest npm version and choose the next package version
- update `package.json`, `package-lock.json`, and `CHANGELOG.md`
- refresh build artifacts
- run typecheck, tests, build, `npm pack --dry-run`, and any targeted version checks
- confirm the tarball contains only the intended package files
- create the release commit and tag
- push the release commit and tag to GitHub

The user normally runs `npm publish` manually. Publishing may require browser OAuth, account switching, OTP, or npm trust prompts, and it mutates the public registry. The agent may run `npm publish` only when the user explicitly asks for it and the correct npm credentials are already configured in the environment.

## Final Checks

Before committing:

- Remove temporary implementation notes and temporary validation files.
- Apply the documentation and validation rules from `AGENTS.md`.
- Inspect `git status` and the final diff to ensure only durable project files remain.
