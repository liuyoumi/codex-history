import type { ResolvedPaths } from "../core/paths.js";
import { runDoctor } from "../core/schema.js";

export function doctorCommand(paths: ResolvedPaths) {
  return runDoctor(paths);
}
