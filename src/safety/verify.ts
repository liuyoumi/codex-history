import { existsSync, readFileSync } from "node:fs";
import type { ResolvedPaths } from "../core/paths.js";
import type { PurgePlan } from "../core/planner.js";
import { openReadonlyDatabase, tableExists, tableColumns, quoteIdentifier } from "../stores/sqlite.js";

export type VerificationReport = {
  success: boolean;
  remainingReferences: Array<{
    store: string;
    path: string;
    detail: string;
  }>;
};

export function verifyPurge(paths: ResolvedPaths, plan: PurgePlan): VerificationReport {
  const remainingReferences: VerificationReport["remainingReferences"] = [];
  const threadId = plan.target.id;

  checkSqlite(paths.stateDb, "state_db", threadId, remainingReferences);
  checkSqlite(paths.logsDb, "logs_db", threadId, remainingReferences);
  checkSqlite(paths.goalsDb, "goals_db", threadId, remainingReferences);
  checkTextFile(paths.sessionIndex, "session_index", threadId, remainingReferences);
  checkTextFile(paths.globalState, "global_state", threadId, remainingReferences);
  checkTextFile(paths.globalStateBackup, "global_state_backup", threadId, remainingReferences);

  if (existsSync(plan.target.rolloutPath)) {
    remainingReferences.push({
      store: "rollout_jsonl",
      path: plan.target.rolloutPath,
      detail: "rollout file still exists",
    });
  }

  for (const store of plan.stores) {
    if (store.store === "shell_snapshot" && existsSync(store.path)) {
      remainingReferences.push({
        store: "shell_snapshot",
        path: store.path,
        detail: "shell snapshot still exists",
      });
    }
  }

  return {
    success: remainingReferences.length === 0,
    remainingReferences,
  };
}

function checkSqlite(
  filePath: string,
  store: string,
  threadId: string,
  remainingReferences: VerificationReport["remainingReferences"],
): void {
  if (!existsSync(filePath)) {
    return;
  }

  const db = openReadonlyDatabase(filePath);
  try {
    const tables = db
      .prepare("select name from sqlite_master where type = 'table'")
      .all() as Array<{ name: string }>;

    for (const table of tables) {
      if (!tableExists(db, table.name)) {
        continue;
      }

      const columns = tableColumns(db, table.name);
      for (const column of columns) {
        if (!column.endsWith("thread_id") && column !== "id") {
          continue;
        }

        const row = db
          .prepare(
            `select count(*) as count from ${quoteIdentifier(table.name)} where ${quoteIdentifier(column)} = ?`,
          )
          .get(threadId) as { count: number };

        if (row.count > 0) {
          remainingReferences.push({
            store: `${store}.${table.name}`,
            path: filePath,
            detail: `${row.count} row(s) still reference ${column}`,
          });
        }
      }
    }
  } finally {
    db.close();
  }
}

function checkTextFile(
  filePath: string,
  store: string,
  threadId: string,
  remainingReferences: VerificationReport["remainingReferences"],
): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  if (content.includes(threadId)) {
    remainingReferences.push({
      store,
      path: filePath,
      detail: "text file still contains thread id",
    });
  }
}

