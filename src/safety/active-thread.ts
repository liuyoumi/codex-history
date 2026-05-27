import { existsSync, statSync } from "node:fs";
import { SafetyRefusalError } from "../core/errors.js";
import type { ThreadSummary } from "../core/threads.js";

export type ActiveThreadCheck = {
  status: "ok" | "warning";
  detail: string;
};

export function assertThreadIsNotActive(target: ThreadSummary): ActiveThreadCheck[] {
  const checks: ActiveThreadCheck[] = [];
  const currentThreadId = process.env.CODEX_THREAD_ID;

  if (currentThreadId && currentThreadId === target.id) {
    throw new SafetyRefusalError(`Refusing to purge active Codex thread: ${target.id}`);
  }

  checks.push({
    status: "ok",
    detail: "CODEX_THREAD_ID does not match target thread",
  });

  if (existsSync(target.rolloutPath)) {
    const before = statSync(target.rolloutPath).mtimeMs;
    const after = statSync(target.rolloutPath).mtimeMs;
    if (before !== after) {
      throw new SafetyRefusalError(`Refusing to purge a changing rollout file: ${target.rolloutPath}`);
    }

    checks.push({
      status: "ok",
      detail: "rollout file does not appear to be changing",
    });
  } else {
    checks.push({
      status: "warning",
      detail: `rollout file is missing: ${target.rolloutPath}`,
    });
  }

  return checks;
}

