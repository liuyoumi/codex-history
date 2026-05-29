import type { ResolvedPaths } from "../core/paths.js";
import { executePurge, type PurgeExecutionReport } from "../core/executor.js";
import { UsageError } from "../core/errors.js";
import { buildPurgePlan, resolvePurgeTarget, type PurgePlan } from "../core/planner.js";
import { validateSupportedDataModel } from "../core/schema.js";
import { listThreads, type ListThreadsOptions } from "../core/threads.js";
import { assertThreadIsNotActive, type ActiveThreadCheck } from "../safety/active-thread.js";
import type { VerificationReport } from "../safety/verify.js";

export type PurgeFilterOptions = {
  cwd?: string;
  grep?: string;
  archived?: boolean;
};

export type BatchPurgePlan = {
  mode: "planned";
  source: "explicit" | "filtered";
  requestedCount: number;
  plans: PurgePlan[];
  filters?: PurgeFilterOptions;
  duplicateInputs: Array<{
    input: string;
    targetId: string;
  }>;
};

export type BatchPurgeExecutionReport = {
  mode: "executed";
  plan: BatchPurgePlan;
  activeThreadChecks: ActiveThreadCheck[];
  purgeReports: PurgeExecutionReport[];
  verification: VerificationReport;
};

export function planPurgeCommand(paths: ResolvedPaths, threadId: string): PurgePlan {
  validateSupportedDataModel(paths);
  const target = resolvePurgeTarget(paths, threadId);
  return buildPurgePlan(paths, target);
}

export function planBatchPurgeCommand(paths: ResolvedPaths, threadIds: string[]): BatchPurgePlan {
  validateSupportedDataModel(paths);

  const plans: PurgePlan[] = [];
  const seenTargets = new Set<string>();
  const duplicateInputs: BatchPurgePlan["duplicateInputs"] = [];

  for (const threadId of threadIds) {
    const target = resolvePurgeTarget(paths, threadId);
    if (seenTargets.has(target.id)) {
      duplicateInputs.push({ input: threadId, targetId: target.id });
      continue;
    }

    seenTargets.add(target.id);
    plans.push(buildPurgePlan(paths, target));
  }

  return {
    mode: "planned",
    source: "explicit",
    requestedCount: threadIds.length,
    plans,
    duplicateInputs,
  };
}

export function planFilteredPurgeCommand(paths: ResolvedPaths, filters: PurgeFilterOptions): BatchPurgePlan {
  validateSupportedDataModel(paths);

  if (!hasPurgeFilter(filters)) {
    throw new UsageError("Provide thread id(s) or at least one filter such as --cwd, --grep, or --archived.");
  }

  const listOptions: ListThreadsOptions = {
    cwd: filters.cwd,
    grep: filters.grep,
    archived: filters.archived,
  };
  const targets = listThreads(paths, listOptions);

  return {
    mode: "planned",
    source: "filtered",
    requestedCount: targets.length,
    plans: targets.map((target) => buildPurgePlan(paths, target)),
    filters,
    duplicateInputs: [],
  };
}

export function hasPurgeFilter(filters: PurgeFilterOptions): boolean {
  return Boolean(filters.cwd || filters.grep || filters.archived);
}

export function executePurgePlanCommand(paths: ResolvedPaths, plan: PurgePlan) {
  validateSupportedDataModel(paths);
  return executePurge(paths, plan);
}

export function executeBatchPurgePlanCommand(paths: ResolvedPaths, plan: BatchPurgePlan): BatchPurgeExecutionReport {
  validateSupportedDataModel(paths);

  const activeThreadChecks = plan.plans.flatMap((item) => assertThreadIsNotActive(item.target));
  const purgeReports = plan.plans.map((item) => executePurge(paths, item, { skipActiveThreadCheck: true }));
  const remainingReferences = purgeReports.flatMap((report) => report.verification.remainingReferences);

  return {
    mode: "executed",
    plan,
    activeThreadChecks,
    purgeReports,
    verification: {
      success: remainingReferences.length === 0,
      remainingReferences,
    },
  };
}

export function purgeCommand(paths: ResolvedPaths, threadId: string) {
  const plan = planPurgeCommand(paths, threadId);
  return executePurgePlanCommand(paths, plan);
}
