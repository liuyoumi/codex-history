import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ResolvedPaths } from "../core/paths.js";
import type { PurgePlan } from "../core/planner.js";

export type BackupEntry = {
  originalPath: string;
  backupPath: string;
  size: number;
  mtimeMs: number;
};

export type BackupManifest = {
  threadId: string;
  createdAt: string;
  backupDir: string;
  entries: BackupEntry[];
};

export function createBackup(paths: ResolvedPaths, plan: PurgePlan): BackupManifest {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const backupDir = path.join(paths.backupHome, `${timestamp}-${plan.target.id}`);
  mkdirSync(backupDir, { recursive: true });

  const candidates = new Set<string>();
  candidates.add(paths.stateDb);
  addIfPresent(candidates, `${paths.stateDb}-wal`);
  addIfPresent(candidates, `${paths.stateDb}-shm`);
  addIfPresent(candidates, paths.logsDb);
  addIfPresent(candidates, `${paths.logsDb}-wal`);
  addIfPresent(candidates, `${paths.logsDb}-shm`);
  addIfPresent(candidates, paths.goalsDb);
  addIfPresent(candidates, `${paths.goalsDb}-wal`);
  addIfPresent(candidates, `${paths.goalsDb}-shm`);
  addIfPresent(candidates, paths.sessionIndex);
  addIfPresent(candidates, paths.globalState);
  addIfPresent(candidates, paths.globalStateBackup);
  addIfPresent(candidates, plan.target.rolloutPath);

  for (const store of plan.stores) {
    if (store.store === "shell_snapshot") {
      addIfPresent(candidates, store.path);
    }
  }

  const entries: BackupEntry[] = [];
  for (const originalPath of candidates) {
    if (!existsSync(originalPath)) {
      continue;
    }

    const backupPath = uniqueBackupPath(backupDir, originalPath);
    mkdirSync(path.dirname(backupPath), { recursive: true });
    copyFileSync(originalPath, backupPath);
    const stats = statSync(originalPath);
    entries.push({
      originalPath,
      backupPath,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
    });
  }

  const manifest: BackupManifest = {
    threadId: plan.target.id,
    createdAt: new Date().toISOString(),
    backupDir,
    entries,
  };

  writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function addIfPresent(paths: Set<string>, filePath: string): void {
  if (existsSync(filePath)) {
    paths.add(filePath);
  }
}

function uniqueBackupPath(backupDir: string, originalPath: string): string {
  const parsed = path.parse(originalPath);
  const safeBase = `${parsed.name}${parsed.ext}`.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
  const hash = Buffer.from(originalPath).toString("base64url").slice(0, 12);
  return path.join(backupDir, `${hash}-${safeBase}`);
}

