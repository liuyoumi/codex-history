import { existsSync } from "node:fs";
import type { ResolvedPaths } from "./paths.js";
import type { PurgePlan } from "./planner.js";
import type { BackupManifest } from "../safety/backup.js";
import { assertThreadIsNotActive, type ActiveThreadCheck } from "../safety/active-thread.js";
import { createBackup } from "../safety/backup.js";
import { verifyPurge, type VerificationReport } from "../safety/verify.js";
import { deleteFileIfExists, type FileDeletionResult } from "../stores/files.js";
import {
  removeThreadFromGlobalState,
  removeThreadFromSessionIndex,
  type JsonMutationResult,
} from "../stores/json-state.js";
import { checkpointWal, openWritableDatabase, tableExists } from "../stores/sqlite.js";

export type PurgeExecutionReport = {
  mode: "executed";
  plan: PurgePlan;
  activeThreadChecks: ActiveThreadCheck[];
  backup: BackupManifest;
  sqlite: Array<{ store: string; changedRows: number }>;
  json: JsonMutationResult[];
  files: FileDeletionResult[];
  verification: VerificationReport;
};

export function executePurge(paths: ResolvedPaths, plan: PurgePlan): PurgeExecutionReport {
  const activeThreadChecks = assertThreadIsNotActive(plan.target);
  const backup = createBackup(paths, plan);
  const sqlite = purgeSqlite(paths, plan.target.id);
  const json = [
    removeThreadFromSessionIndex(paths.sessionIndex, plan.target.id),
    removeThreadFromGlobalState(paths.globalState, plan.target.id),
    removeThreadFromGlobalState(paths.globalStateBackup, plan.target.id),
  ];
  const files = purgeFiles(plan);

  checkpointWal(paths.stateDb);
  checkpointWal(paths.logsDb);
  checkpointWal(paths.goalsDb);

  const verification = verifyPurge(paths, plan);

  return {
    mode: "executed",
    plan,
    activeThreadChecks,
    backup,
    sqlite,
    json,
    files,
    verification,
  };
}

function purgeSqlite(paths: ResolvedPaths, threadId: string): PurgeExecutionReport["sqlite"] {
  const results: PurgeExecutionReport["sqlite"] = [];

  if (existsSync(paths.stateDb)) {
    const db = openWritableDatabase(paths.stateDb);
    try {
      const transaction = db.transaction(() => {
        results.push(deleteRows(db, "thread_dynamic_tools", "thread_id", threadId, "state_db.thread_dynamic_tools"));
        results.push(deleteRows(db, "stage1_outputs", "thread_id", threadId, "state_db.stage1_outputs"));

        if (tableExists(db, "thread_spawn_edges")) {
          const info = db
            .prepare("delete from thread_spawn_edges where parent_thread_id = ? or child_thread_id = ?")
            .run(threadId, threadId);
          results.push({ store: "state_db.thread_spawn_edges", changedRows: Number(info.changes) });
        }

        if (tableExists(db, "agent_job_items")) {
          const info = db
            .prepare("update agent_job_items set assigned_thread_id = null where assigned_thread_id = ?")
            .run(threadId);
          results.push({ store: "state_db.agent_job_items", changedRows: Number(info.changes) });
        }

        results.push(deleteRows(db, "threads", "id", threadId, "state_db.threads"));
      });
      transaction();
    } finally {
      db.close();
    }
  }

  if (existsSync(paths.logsDb)) {
    const db = openWritableDatabase(paths.logsDb);
    try {
      const transaction = db.transaction(() => {
        results.push(deleteRows(db, "logs", "thread_id", threadId, "logs_db.logs"));
      });
      transaction();
    } finally {
      db.close();
    }
  }

  if (existsSync(paths.goalsDb)) {
    const db = openWritableDatabase(paths.goalsDb);
    try {
      const transaction = db.transaction(() => {
        results.push(deleteRows(db, "thread_goals", "thread_id", threadId, "goals_db.thread_goals"));
      });
      transaction();
    } finally {
      db.close();
    }
  }

  return results;
}

function deleteRows(
  db: import("better-sqlite3").Database,
  tableName: string,
  columnName: string,
  threadId: string,
  store: string,
): { store: string; changedRows: number } {
  if (!tableExists(db, tableName)) {
    return { store, changedRows: 0 };
  }

  const info = db.prepare(`delete from "${tableName}" where "${columnName}" = ?`).run(threadId);
  return {
    store,
    changedRows: Number(info.changes),
  };
}

function purgeFiles(plan: PurgePlan): FileDeletionResult[] {
  const results: FileDeletionResult[] = [];
  results.push(deleteFileIfExists(plan.target.rolloutPath));

  for (const store of plan.stores) {
    if (store.store === "shell_snapshot") {
      results.push(deleteFileIfExists(store.path));
    }
  }

  return results;
}

