import { existsSync, readFileSync } from "node:fs";

export type SessionIndexEntry = {
  id: string;
  threadName: string;
  updatedAt?: string;
};

type RawSessionIndexEntry = {
  id?: unknown;
  thread_name?: unknown;
  updated_at?: unknown;
};

export function readSessionIndex(filePath: string): Map<string, SessionIndexEntry> {
  const entries = new Map<string, SessionIndexEntry>();

  if (!existsSync(filePath)) {
    return entries;
  }

  const lines = readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  for (const line of lines) {
    const raw = JSON.parse(line) as RawSessionIndexEntry;
    if (typeof raw.id !== "string" || typeof raw.thread_name !== "string") {
      continue;
    }

    entries.set(raw.id, {
      id: raw.id,
      threadName: raw.thread_name,
      updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
    });
  }

  return entries;
}

