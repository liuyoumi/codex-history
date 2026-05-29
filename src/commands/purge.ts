import type { ResolvedPaths } from "../core/paths.js";
import { executePurge } from "../core/executor.js";
import { buildPurgePlan, resolvePurgeTarget, type PurgePlan } from "../core/planner.js";
import { validateSupportedDataModel } from "../core/schema.js";

export function planPurgeCommand(paths: ResolvedPaths, threadId: string): PurgePlan {
  validateSupportedDataModel(paths);
  const target = resolvePurgeTarget(paths, threadId);
  return buildPurgePlan(paths, target);
}

export function executePurgePlanCommand(paths: ResolvedPaths, plan: PurgePlan) {
  validateSupportedDataModel(paths);
  return executePurge(paths, plan);
}

export function purgeCommand(paths: ResolvedPaths, threadId: string) {
  const plan = planPurgeCommand(paths, threadId);
  return executePurgePlanCommand(paths, plan);
}
