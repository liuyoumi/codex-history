# Requirements

## Goal

Build a terminal tool that helps users inspect and safely remove local Codex conversation history from their own machine.

The tool should satisfy users who want a conversation to stop appearing in Codex Desktop or CLI history and who also want related local traces removed as completely as practical.

## Project Identity

- Project name: `codex-history`
- npm package: `@asjk/codex-history`
- CLI command: `codex-history`
- Repository: `git@github.com:liuyoumi/codex-history.git`
- Local path: `/Users/lg/Projects/codex-history`

## Initial Platform

Version `0.1` targets macOS first.

The implementation should keep path handling portable enough for future Windows and Linux support, but macOS is the only platform that must be verified before the first release.

## Core Commands

```bash
codex-history list
codex-history search "keyword"
codex-history purge --id <thread_id> --dry-run
codex-history purge --id <thread_id> --yes
```

Planned resolution helpers:

```bash
codex-history purge --title "exact title"
codex-history purge --contains "keyword"
```

Deletion must internally resolve to exactly one Codex thread id before modifying local data.

## User Workflow

1. User lists or searches conversations.
2. Tool displays candidate thread id, title, updated time, cwd, and rollout path.
3. User runs a dry-run purge.
4. Tool reports every planned file and database mutation.
5. User reruns with `--yes` to execute.
6. Tool verifies that the target thread id is no longer present in supported local Codex data stores.

## Non-Goals

- Do not claim to delete server-side OpenAI or Codex service data.
- Do not claim physical secure erase from SSD/APFS snapshots or Time Machine backups.
- Do not purge an active thread.
- Do not implement destructive behavior before the requirements and technical design are reviewed and accepted.

## First Release Scope

Version `0.1` should support:

- list local threads from `~/.codex/state_5.sqlite`
- search by title and first-message preview
- dry-run purge planning
- purge by unique thread id
- remove related local records from supported Codex stores
- fixture-based tests for purge planning and purge execution
- README installation instructions for npm

