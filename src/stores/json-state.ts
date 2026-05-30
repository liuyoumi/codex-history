import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type JsonMutationResult = {
  path: string;
  changed: boolean;
};

export function removeThreadFromSessionIndex(filePath: string, threadId: string): JsonMutationResult {
  if (!existsSync(filePath)) {
    return { path: filePath, changed: false };
  }

  const original = readFileSync(filePath, "utf8");
  const lines = original.split("\n");
  const kept = lines.filter((line) => {
    if (line.trim().length === 0) {
      return false;
    }

    const parsed = JSON.parse(line) as { id?: string };
    return parsed.id !== threadId;
  });
  const next = kept.length > 0 ? `${kept.join("\n")}\n` : "";
  const changed = next !== original;

  if (changed) {
    writeFileSync(filePath, next);
  }

  return { path: filePath, changed };
}

export function removeThreadFromGlobalState(filePath: string, threadId: string): JsonMutationResult {
  if (!existsSync(filePath)) {
    return { path: filePath, changed: false };
  }

  const original = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(original) as unknown;
  const nextValue = removeThreadReferences(parsed, threadId);
  const next = JSON.stringify(nextValue.value, null, 2) + "\n";

  if (nextValue.changed) {
    writeFileSync(filePath, next);
  }

  return {
    path: filePath,
    changed: nextValue.changed,
  };
}

function removeThreadReferences(value: unknown, threadId: string): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const next = [];

    for (const item of value) {
      if (item === threadId) {
        changed = true;
        continue;
      }

      const result = removeThreadReferences(item, threadId);
      changed ||= result.changed;
      next.push(result.value);
    }

    return { value: next, changed };
  }

  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
      if (key.includes(threadId)) {
        changed = true;
        continue;
      }

      const result = removeThreadReferences(child, threadId);
      changed ||= result.changed;
      next[key] = result.value;
    }

    return { value: next, changed };
  }

  return { value, changed: false };
}
