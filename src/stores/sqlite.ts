import Database from "better-sqlite3";
import { existsSync } from "node:fs";

export function openReadonlyDatabase(filePath: string): Database.Database {
  return new Database(filePath, {
    readonly: true,
    fileMustExist: true,
  });
}

export function sqliteFileExists(filePath: string): boolean {
  return existsSync(filePath);
}

export function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("select 1 as ok from sqlite_master where type = 'table' and name = ?")
    .get(tableName) as { ok: number } | undefined;

  return row?.ok === 1;
}

export function tableColumns(db: Database.Database, tableName: string): string[] {
  const rows = db.prepare(`pragma table_info(${quoteIdentifier(tableName)})`).all() as Array<{
    name: string;
  }>;

  return rows.map((row) => row.name);
}

export function countWhereThreadId(
  db: Database.Database,
  tableName: string,
  columnName: string,
  threadId: string,
): number | null {
  if (!tableExists(db, tableName)) {
    return null;
  }

  const columns = tableColumns(db, tableName);
  if (!columns.includes(columnName)) {
    return null;
  }

  const row = db
    .prepare(
      `select count(*) as count from ${quoteIdentifier(tableName)} where ${quoteIdentifier(
        columnName,
      )} = ?`,
    )
    .get(threadId) as { count: number };

  return row.count;
}

export function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

