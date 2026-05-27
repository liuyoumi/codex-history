import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { SafetyRefusalError, UsageError } from "./errors.js";
import type { ResolvedPaths } from "./paths.js";
import type { ThreadSummary } from "./threads.js";
import { getThreadById, getThreadsByExactTitle, searchThreads } from "./threads.js";
import { countWhereThreadId, openReadonlyDatabase, tableExists } from "../stores/sqlite.js";

export type PurgeTargetInput = {
  id?: string;
  title?: string;
  contains?: string;
};

export type StorePlan = {
  store: string;
  path: string;
  action: "delete_rows" | "rewrite" | "delete_file" | "inspect" | "refuse";
  detail: string;
  count?: number;
  exists?: boolean;
};

export type PurgePlan = {
  mode: "dry-run";
  target: ThreadSummary;
  stores: StorePlan[];
  warnings: string[];
};

export type ContainsResolution = {
  kind: "contains_matches";
  matches: ThreadSummary[];
};

export function resolvePurgeTarget(
  paths: ResolvedPaths,
  input: PurgeTargetInput,
): ThreadSummary | ContainsResolution {
  const selectors = [input.id, input.title, input.contains].filter(Boolean);
  if (selectors.length !== 1) {
    throw new UsageError("Provide exactly one target selector: --id, --title, or --contains.");
  }

  if (input.contains) {
    return {
      kind: "contains_matches",
      matches: searchThreads(paths, input.contains, { all: true, limit: 200 }),
    };
  }

  if (input.id) {
    const thread = getThreadById(paths, input.id);
    if (!thread) {
      throw new UsageError(`No Codex thread found for id: ${input.id}`);
    }
    return thread;
  }

  if (input.title) {
    const matches = getThreadsByExactTitle(paths, input.title);
    if (matches.length === 0) {
      throw new UsageError(`No Codex thread found for exact title: ${input.title}`);
    }
    if (matches.length > 1) {
      throw new SafetyRefusalError(
        `Exact title matched ${matches.length} threads. Use --id after running search/list.`,
      );
    }
    return matches[0];
  }

  throw new UsageError("No purge target provided.");
}

export function buildDryRunPurgePlan(paths: ResolvedPaths, target: ThreadSummary): PurgePlan {
  const stores: StorePlan[] = [];
  const warnings: string[] = [];

  stores.push(...planStateDb(paths.stateDb, target.id));
  stores.push(...planLogsDb(paths.logsDb, target.id));
  stores.push(...planGoalsDb(paths.goalsDb, target.id));
  stores.push(planRewrite(paths.sessionIndex, "session_index", "remove matching JSONL entry"));
  stores.push(planRewrite(paths.globalState, "global_state", "remove known thread references"));
  stores.push(planRewrite(paths.globalStateBackup, "global_state_backup", "remove known thread references"));
  stores.push(planDeleteFile(target.rolloutPath, "rollout_jsonl"));

  for (const snapshot of findShellSnapshots(paths.shellSnapshotsDir, target.id)) {
    stores.push(planDeleteFile(snapshot, "shell_snapshot"));
  }

  if (!existsSync(target.rolloutPath)) {
    warnings.push(`rollout file is missing: ${target.rolloutPath}`);
  }

  return {
    mode: "dry-run",
    target,
    stores,
    warnings,
  };
}

function planStateDb(filePath: string, threadId: string): StorePlan[] {
  if (!existsSync(filePath)) {
    return [missingStore("state_db", filePath)];
  }

  const db = openReadonlyDatabase(filePath);
  try {
    const plans: StorePlan[] = [];
    plans.push(countPlan("state_db.threads", filePath, 1, "delete target thread row"));
    plans.push(countTable(db, filePath, "thread_dynamic_tools", "thread_id", threadId));
    plans.push(countTable(db, filePath, "stage1_outputs", "thread_id", threadId));

    if (tableExists(db, "thread_spawn_edges")) {
      const row = db
        .prepare(
          "select count(*) as count from thread_spawn_edges where parent_thread_id = ? or child_thread_id = ?",
        )
        .get(threadId, threadId) as { count: number };
      plans.push(countPlan("state_db.thread_spawn_edges", filePath, row.count, "delete parent/child edges"));
    }

    if (tableExists(db, "agent_job_items")) {
      const row = db
        .prepare("select count(*) as count from agent_job_items where assigned_thread_id = ?")
        .get(threadId) as { count: number };
      plans.push(
        countPlan(
          "state_db.agent_job_items",
          filePath,
          row.count,
          "inspect assigned thread references before purge execution",
          "inspect",
        ),
      );
    }

    return plans;
  } finally {
    db.close();
  }
}

function planLogsDb(filePath: string, threadId: string): StorePlan[] {
  if (!existsSync(filePath)) {
    return [missingStore("logs_db", filePath)];
  }

  const db = openReadonlyDatabase(filePath);
  try {
    return [countTable(db, filePath, "logs", "thread_id", threadId, "logs_db.logs")];
  } finally {
    db.close();
  }
}

function planGoalsDb(filePath: string, threadId: string): StorePlan[] {
  if (!existsSync(filePath)) {
    return [missingStore("goals_db", filePath)];
  }

  const db = openReadonlyDatabase(filePath);
  try {
    return [countTable(db, filePath, "thread_goals", "thread_id", threadId, "goals_db.thread_goals")];
  } finally {
    db.close();
  }
}

function countTable(
  db: import("better-sqlite3").Database,
  filePath: string,
  tableName: string,
  columnName: string,
  threadId: string,
  storeName?: string,
): StorePlan {
  const count = countWhereThreadId(db, tableName, columnName, threadId);
  if (count === null) {
    return {
      store: storeName ?? `state_db.${tableName}`,
      path: filePath,
      action: "inspect",
      detail: `table or column unavailable: ${tableName}.${columnName}`,
      exists: existsSync(filePath),
    };
  }

  return countPlan(storeName ?? `state_db.${tableName}`, filePath, count, "delete matching rows");
}

function countPlan(
  store: string,
  filePath: string,
  count: number,
  detail: string,
  action: StorePlan["action"] = "delete_rows",
): StorePlan {
  return {
    store,
    path: filePath,
    action,
    detail,
    count,
    exists: true,
  };
}

function planRewrite(filePath: string, store: string, detail: string): StorePlan {
  return {
    store,
    path: filePath,
    action: "rewrite",
    detail,
    exists: existsSync(filePath),
  };
}

function planDeleteFile(filePath: string, store: string): StorePlan {
  return {
    store,
    path: filePath,
    action: "delete_file",
    detail: "delete file",
    exists: existsSync(filePath),
    count: existsSync(filePath) ? statSync(filePath).size : 0,
  };
}

function missingStore(store: string, filePath: string): StorePlan {
  return {
    store,
    path: filePath,
    action: "inspect",
    detail: "store is missing",
    exists: false,
  };
}

function findShellSnapshots(shellSnapshotsDir: string, threadId: string): string[] {
  if (!existsSync(shellSnapshotsDir)) {
    return [];
  }

  return readdirSync(shellSnapshotsDir)
    .filter((entry) => entry.startsWith(`${threadId}.`) && entry.endsWith(".sh"))
    .map((entry) => path.join(shellSnapshotsDir, entry));
}
