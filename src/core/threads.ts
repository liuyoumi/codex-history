import type { ResolvedPaths } from "./paths.js";
import { openReadonlyDatabase, quoteIdentifier } from "../stores/sqlite.js";
import { readSessionIndex } from "../stores/session-index.js";

export type ThreadSummary = {
  id: string;
  title: string;
  sourceTitle: string;
  rolloutPath: string;
  createdAtMs: number;
  updatedAtMs: number;
  cwd: string;
  archived: boolean;
  firstUserMessage: string;
  preview: string;
};

export type ListThreadsOptions = {
  limit?: number;
  archived?: boolean;
  all?: boolean;
  cwd?: string;
};

type ThreadRow = {
  id: string;
  title: string;
  rollout_path: string;
  created_at: number;
  updated_at: number;
  created_at_ms: number | null;
  updated_at_ms: number | null;
  cwd: string;
  archived: number;
  first_user_message: string;
  preview: string;
};

export function listThreads(paths: ResolvedPaths, options: ListThreadsOptions = {}): ThreadSummary[] {
  const limit = options.limit;
  const where: string[] = [];
  const params: unknown[] = [];

  if (!options.all) {
    where.push(`${quoteIdentifier("archived")} = ?`);
    params.push(options.archived ? 1 : 0);
  } else if (options.archived) {
    where.push(`${quoteIdentifier("archived")} = ?`);
    params.push(1);
  }

  if (options.cwd) {
    where.push(`${quoteIdentifier("cwd")} = ?`);
    params.push(options.cwd);
  }

  const whereClause = where.length > 0 ? `where ${where.join(" and ")}` : "";
  const hasLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0;
  const limitClause = hasLimit ? "limit ?" : "";
  if (limitClause) {
    params.push(limit);
  }

  const sessionIndex = readSessionIndex(paths.sessionIndex);
  const db = openReadonlyDatabase(paths.stateDb);
  try {
    const rows = db
      .prepare(
        `select id, title, rollout_path, created_at, updated_at, created_at_ms, updated_at_ms, cwd, archived, first_user_message, preview
         from threads
         ${whereClause}
         order by coalesce(updated_at_ms, updated_at * 1000) desc, id desc
         ${limitClause}`,
      )
      .all(...params) as ThreadRow[];

    return rows.map((row) => mapThreadRow(row, sessionIndex));
  } finally {
    db.close();
  }
}

export function searchThreads(
  paths: ResolvedPaths,
  keyword: string,
  options: Omit<ListThreadsOptions, "limit"> & { limit?: number } = {},
): ThreadSummary[] {
  const normalizedKeyword = keyword.toLocaleLowerCase();
  const matches = listThreads(paths, { ...options, limit: undefined }).filter((thread) => {
    const haystack = [
      thread.id,
      thread.title,
      thread.cwd,
    ]
      .join("\n")
      .toLocaleLowerCase();

    return haystack.includes(normalizedKeyword);
  });

  const limit = options.limit;
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? matches.slice(0, limit) : matches;
}

export function getThreadById(paths: ResolvedPaths, threadId: string): ThreadSummary | null {
  const idMatches = getThreadsByIdPrefix(paths, threadId);
  if (idMatches.length !== 1) {
    return null;
  }

  return idMatches[0];
}

export function getThreadsByIdPrefix(paths: ResolvedPaths, idPrefix: string): ThreadSummary[] {
  const sessionIndex = readSessionIndex(paths.sessionIndex);
  const db = openReadonlyDatabase(paths.stateDb);
  try {
    const rows = db
      .prepare(
        `select id, title, rollout_path, created_at, updated_at, created_at_ms, updated_at_ms, cwd, archived, first_user_message, preview
         from threads
         where id like ?
         order by coalesce(updated_at_ms, updated_at * 1000) desc, id desc`,
      )
      .all(`${escapeLike(idPrefix)}%`) as ThreadRow[];

    return rows.map((row) => mapThreadRow(row, sessionIndex));
  } finally {
    db.close();
  }
}

function mapThreadRow(row: ThreadRow, sessionIndex: Map<string, { threadName: string }>): ThreadSummary {
  const sourceTitle = row.title;
  const displayTitle = sessionIndex.get(row.id)?.threadName || sourceTitle;

  return {
    id: row.id,
    title: displayTitle,
    sourceTitle,
    rolloutPath: row.rollout_path,
    createdAtMs: row.created_at_ms ?? row.created_at * 1000,
    updatedAtMs: row.updated_at_ms ?? row.updated_at * 1000,
    cwd: row.cwd,
    archived: row.archived === 1,
    firstUserMessage: row.first_user_message,
    preview: row.preview,
  };
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
