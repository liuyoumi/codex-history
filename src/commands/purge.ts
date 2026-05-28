import type { ResolvedPaths } from "../core/paths.js";
import { executePurge } from "../core/executor.js";
import { buildDryRunPurgePlan, resolvePurgeTarget } from "../core/planner.js";
import { validateSupportedDataModel } from "../core/schema.js";

export function purgeCommand(paths: ResolvedPaths, threadId: string, execute: boolean) {
  validateSupportedDataModel(paths, { requireBackupHome: execute });
  const target = resolvePurgeTarget(paths, threadId);
  const plan = buildDryRunPurgePlan(paths, target);

  if (execute) {
    return executePurge(paths, plan);
  }

  return plan;
}
