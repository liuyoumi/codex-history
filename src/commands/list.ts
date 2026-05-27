import type { ResolvedPaths } from "../core/paths.js";
import { validateSupportedDataModel } from "../core/schema.js";
import { listThreads, type ListThreadsOptions } from "../core/threads.js";

export function listCommand(paths: ResolvedPaths, options: ListThreadsOptions) {
  validateSupportedDataModel(paths);
  return listThreads(paths, options);
}
