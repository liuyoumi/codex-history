import type { ResolvedPaths } from "../core/paths.js";
import { buildPurgeOrphansPlan, executePurgeOrphans, type PurgeOrphansPlan } from "../core/orphans.js";

export function planPurgeOrphansCommand(paths: ResolvedPaths): PurgeOrphansPlan {
  return buildPurgeOrphansPlan(paths);
}

export function executePurgeOrphansPlanCommand(paths: ResolvedPaths, plan: PurgeOrphansPlan) {
  return executePurgeOrphans(paths, plan);
}
