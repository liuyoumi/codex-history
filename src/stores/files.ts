import { existsSync, unlinkSync } from "node:fs";

export type FileDeletionResult = {
  path: string;
  deleted: boolean;
};

export function deleteFileIfExists(filePath: string): FileDeletionResult {
  if (!existsSync(filePath)) {
    return {
      path: filePath,
      deleted: false,
    };
  }

  unlinkSync(filePath);
  return {
    path: filePath,
    deleted: true,
  };
}

