import type { ResolvedPaths } from "../core/paths.js";
import { validateSupportedDataModel } from "../core/schema.js";
import { searchThreads, type ListThreadsOptions } from "../core/threads.js";

export function searchCommand(paths: ResolvedPaths, keyword: string, options: ListThreadsOptions) {
  validateSupportedDataModel(paths);
  return searchThreads(paths, keyword, options);
}
