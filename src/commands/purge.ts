import type { ResolvedPaths } from "../core/paths.js";
import { SafetyRefusalError } from "../core/errors.js";
import { buildDryRunPurgePlan, resolvePurgeTarget, type PurgeTargetInput } from "../core/planner.js";
import { validateSupportedDataModel } from "../core/schema.js";

export function purgeCommand(paths: ResolvedPaths, input: PurgeTargetInput, execute: boolean) {
  validateSupportedDataModel(paths);
  const target = resolvePurgeTarget(paths, input);

  if ("kind" in target) {
    if (execute) {
      throw new SafetyRefusalError("--contains is search-only in v0.1 and cannot execute purge.");
    }

    return target;
  }

  const plan = buildDryRunPurgePlan(paths, target);

  if (execute) {
    throw new SafetyRefusalError("purge --yes is blocked until feat/purge-safety.");
  }

  return plan;
}
