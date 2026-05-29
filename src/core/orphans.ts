import { existsSync } from "node:fs";
import type { ActiveThreadCheck } from "../safety/active-thread.js";
import { assertThreadIsNotActive } from "../safety/active-thread.js";
import {
  checkpointWal,
  openReadonlyDatabase,
  openWritableDatabase,
  quoteIdentifier,
  tableColumns,
  tableExists,
} from "../stores/sqlite.js";
import { SafetyRefusalError } from "./errors.js";
import { executePurge, type PurgeExecutionReport } from "./executor.js";
import type { ResolvedPaths } from "./paths.js";
import { buildPurgePlan, type PurgePlan, type StorePlan } from "./planner.js";
import { validateSupportedDataModel } from "./schema.js";
import { listThreads, type ThreadSummary } from "./threads.js";

export type LogsOnlyOrphan = {
  threadId: string;
  rows: number;
  estimatedBytes: number | null;
};

export type SqlitePlanSummary = {
  store: string;
  rows: number;
};

export type OrphanCleanupImpact = {
  sqliteRowsAffected: number;
  sqlite: SqlitePlanSummary[];
  filesToDelete: number;
  fileBytesToDelete: number;
  estimatedLogPayloadBytes: number | null;
  estimatedLocalDiskBytesAffected: number | null;
};

export type PurgeOrphansPlan = {
  mode: "planned";
  orphanThreads: ThreadSummary[];
  threadPlans: PurgePlan[];
  logsOnlyOrphans: LogsOnlyOrphan[];
  impact: OrphanCleanupImpact;
  warnings: string[];
};

export type PurgeOrphansExecutionReport = {
  mode: "executed";
  plan: PurgeOrphansPlan;
  activeThreadChecks: ActiveThreadCheck[];
  purgeReports: PurgeExecutionReport[];
  logsOnly: {
    store: string;
    changedRows: number;
  };
  verification: {
    success: boolean;
    remainingReferences: Array<{
      store: string;
      path: string;
      detail: string;
    }>;
  };
};

export function buildPurgeOrphansPlan(paths: ResolvedPaths): PurgeOrphansPlan {
  validateSupportedDataModel(paths);

  const threads = listThreads(paths, { all: true });
  const threadIds = new Set(threads.map((thread) => thread.id));
  const orphanThreads = threads.filter((thread) => !existsSync(thread.rolloutPath));
  const threadPlans = orphanThreads.map((thread) => buildPurgePlan(paths, thread));
  const logThreadRows = readLogThreadRows(paths);
  const logsOnlyOrphans = findLogsOnlyOrphans(logThreadRows, threadIds);
  const impact = buildImpact(
    threadPlans,
    logsOnlyOrphans,
    new Set(orphanThreads.map((thread) => thread.id)),
    logThreadRows,
  );

  return {
    mode: "planned",
    orphanThreads,
    threadPlans,
    logsOnlyOrphans,
    impact,
    warnings: threadPlans.flatMap((plan) => plan.warnings),
  };
}

export function hasPurgeOrphansWork(plan: PurgeOrphansPlan): boolean {
  return plan.orphanThreads.length > 0 || plan.logsOnlyOrphans.length > 0;
}

export function executePurgeOrphans(paths: ResolvedPaths, plan: PurgeOrphansPlan): PurgeOrphansExecutionReport {
  validateSupportedDataModel(paths);

  for (const threadPlan of plan.threadPlans) {
    if (existsSync(threadPlan.target.rolloutPath)) {
      throw new SafetyRefusalError(
        `Refusing to purge orphan candidate because rollout file now exists: ${threadPlan.target.rolloutPath}`,
      );
    }
  }

  const activeThreadChecks = plan.threadPlans.flatMap((threadPlan) => assertThreadIsNotActive(threadPlan.target));
  const purgeReports = plan.threadPlans.map((threadPlan) =>
    executePurge(paths, threadPlan, { skipActiveThreadCheck: true }),
  );
  const logsOnly = purgeLogsOnlyOrphans(paths, plan.logsOnlyOrphans);
  checkpointWal(paths.logsDb);

  const remainingReferences = [
    ...purgeReports.flatMap((report) => report.verification.remainingReferences),
    ...verifyLogsOnlyOrphans(paths, plan.logsOnlyOrphans),
  ];

  return {
    mode: "executed",
    plan,
    activeThreadChecks,
    purgeReports,
    logsOnly,
    verification: {
      success: remainingReferences.length === 0,
      remainingReferences,
    },
  };
}

function findLogsOnlyOrphans(rows: LogsOnlyOrphan[], threadIds: Set<string>): LogsOnlyOrphan[] {
  return rows
    .filter((row) => !threadIds.has(row.threadId))
    .sort((a, b) => a.threadId.localeCompare(b.threadId));
}

function readLogThreadRows(paths: ResolvedPaths): LogsOnlyOrphan[] {
  if (!existsSync(paths.logsDb)) {
    return [];
  }

  const db = openReadonlyDatabase(paths.logsDb);
  try {
    if (!tableExists(db, "logs")) {
      return [];
    }

    const columns = tableColumns(db, "logs");
    if (!columns.includes("thread_id")) {
      return [];
    }

    const estimatedExpr = columns.includes("estimated_bytes")
      ? "coalesce(sum(estimated_bytes), 0) as estimatedBytes"
      : "null as estimatedBytes";
    const rows = db
      .prepare(
        `select thread_id as threadId, count(*) as rows, ${estimatedExpr}
         from logs
         where thread_id is not null and thread_id != ''
         group by thread_id`,
      )
      .all() as Array<{ threadId: string; rows: number; estimatedBytes: number | null }>;

    return rows.map((row) => ({
      threadId: row.threadId,
      rows: Number(row.rows),
      estimatedBytes: row.estimatedBytes === null ? null : Number(row.estimatedBytes),
    }));
  } finally {
    db.close();
  }
}

function buildImpact(
  threadPlans: PurgePlan[],
  logsOnlyOrphans: LogsOnlyOrphan[],
  orphanThreadIds: Set<string>,
  logThreadRows: LogsOnlyOrphan[],
): OrphanCleanupImpact {
  const sqliteRows = new Map<string, number>();
  let filesToDelete = 0;
  let fileBytesToDelete = 0;

  for (const plan of threadPlans) {
    for (const store of plan.stores) {
      if (isSqliteRowChange(store) && store.count && store.count > 0) {
        sqliteRows.set(store.store, (sqliteRows.get(store.store) ?? 0) + store.count);
      }

      if (store.action === "delete_file" && store.exists) {
        filesToDelete += 1;
        fileBytesToDelete += store.count ?? 0;
      }
    }
  }

  const logsOnlyRows = logsOnlyOrphans.reduce((sum, orphan) => sum + orphan.rows, 0);
  if (logsOnlyRows > 0) {
    sqliteRows.set("logs_db.logs", (sqliteRows.get("logs_db.logs") ?? 0) + logsOnlyRows);
  }

  const affectedLogRows = logThreadRows.filter(
    (row) => orphanThreadIds.has(row.threadId) || logsOnlyOrphans.some((orphan) => orphan.threadId === row.threadId),
  );
  const estimatedLogPayloadBytes = sumNullable(affectedLogRows.map((orphan) => orphan.estimatedBytes));
  const estimatedLocalDiskBytesAffected =
    estimatedLogPayloadBytes === null ? null : fileBytesToDelete + estimatedLogPayloadBytes;
  const sqlite = [...sqliteRows.entries()]
    .map(([store, rows]) => ({ store, rows }))
    .sort((a, b) => a.store.localeCompare(b.store));

  return {
    sqliteRowsAffected: sqlite.reduce((sum, item) => sum + item.rows, 0),
    sqlite,
    filesToDelete,
    fileBytesToDelete,
    estimatedLogPayloadBytes,
    estimatedLocalDiskBytesAffected,
  };
}

function isSqliteRowChange(store: StorePlan): boolean {
  if (store.action === "delete_rows") {
    return true;
  }

  return store.store === "state_db.agent_job_items";
}

function sumNullable(values: Array<number | null>): number | null {
  if (values.length === 0) {
    return 0;
  }
  if (values.some((value) => value === null)) {
    return null;
  }

  return (values as number[]).reduce((sum, value) => sum + value, 0);
}

function purgeLogsOnlyOrphans(
  paths: ResolvedPaths,
  logsOnlyOrphans: LogsOnlyOrphan[],
): PurgeOrphansExecutionReport["logsOnly"] {
  if (logsOnlyOrphans.length === 0 || !existsSync(paths.logsDb)) {
    return { store: "logs_db.logs", changedRows: 0 };
  }

  const db = openWritableDatabase(paths.logsDb);
  try {
    if (!tableExists(db, "logs") || !tableColumns(db, "logs").includes("thread_id")) {
      return { store: "logs_db.logs", changedRows: 0 };
    }

    let changedRows = 0;
    const transaction = db.transaction(() => {
      const statement = db.prepare(`delete from ${quoteIdentifier("logs")} where ${quoteIdentifier("thread_id")} = ?`);
      for (const orphan of logsOnlyOrphans) {
        const info = statement.run(orphan.threadId);
        changedRows += Number(info.changes);
      }
    });
    transaction();

    return { store: "logs_db.logs", changedRows };
  } finally {
    db.close();
  }
}

function verifyLogsOnlyOrphans(
  paths: ResolvedPaths,
  logsOnlyOrphans: LogsOnlyOrphan[],
): PurgeOrphansExecutionReport["verification"]["remainingReferences"] {
  if (logsOnlyOrphans.length === 0 || !existsSync(paths.logsDb)) {
    return [];
  }

  const db = openReadonlyDatabase(paths.logsDb);
  try {
    if (!tableExists(db, "logs") || !tableColumns(db, "logs").includes("thread_id")) {
      return [];
    }

    const statement = db.prepare(
      `select count(*) as count from ${quoteIdentifier("logs")} where ${quoteIdentifier("thread_id")} = ?`,
    );
    return logsOnlyOrphans.flatMap((orphan) => {
      const row = statement.get(orphan.threadId) as { count: number };
      if (row.count === 0) {
        return [];
      }

      return [
        {
          store: "logs_db.logs",
          path: paths.logsDb,
          detail: `${row.count} row(s) still reference logs-only orphan ${orphan.threadId}`,
        },
      ];
    });
  } finally {
    db.close();
  }
}
