import type { ResolvedPaths } from "./paths.js";
import { openReadonlyDatabase, quoteIdentifier } from "../stores/sqlite.js";

export type ThreadSummary = {
  id: string;
  title: string;
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
  const limit = options.limit ?? 20;
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
  const limitClause = Number.isFinite(limit) && limit > 0 ? "limit ?" : "";
  if (limitClause) {
    params.push(limit);
  }

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

    return rows.map(mapThreadRow);
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
  return listThreads(paths, { ...options, limit: options.limit ?? 200 }).filter((thread) => {
    const haystack = [
      thread.id,
      thread.title,
      thread.firstUserMessage,
      thread.preview,
      thread.cwd,
    ]
      .join("\n")
      .toLocaleLowerCase();

    return haystack.includes(normalizedKeyword);
  });
}

export function getThreadById(paths: ResolvedPaths, threadId: string): ThreadSummary | null {
  const db = openReadonlyDatabase(paths.stateDb);
  try {
    const row = db
      .prepare(
        `select id, title, rollout_path, created_at, updated_at, created_at_ms, updated_at_ms, cwd, archived, first_user_message, preview
         from threads
         where id = ?`,
      )
      .get(threadId) as ThreadRow | undefined;

    return row ? mapThreadRow(row) : null;
  } finally {
    db.close();
  }
}

export function getThreadsByExactTitle(paths: ResolvedPaths, title: string): ThreadSummary[] {
  const db = openReadonlyDatabase(paths.stateDb);
  try {
    const rows = db
      .prepare(
        `select id, title, rollout_path, created_at, updated_at, created_at_ms, updated_at_ms, cwd, archived, first_user_message, preview
         from threads
         where title = ?
         order by coalesce(updated_at_ms, updated_at * 1000) desc, id desc`,
      )
      .all(title) as ThreadRow[];

    return rows.map(mapThreadRow);
  } finally {
    db.close();
  }
}

function mapThreadRow(row: ThreadRow): ThreadSummary {
  return {
    id: row.id,
    title: row.title,
    rolloutPath: row.rollout_path,
    createdAtMs: row.created_at_ms ?? row.created_at * 1000,
    updatedAtMs: row.updated_at_ms ?? row.updated_at * 1000,
    cwd: row.cwd,
    archived: row.archived === 1,
    firstUserMessage: row.first_user_message,
    preview: row.preview,
  };
}
