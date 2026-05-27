import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { doctorCommand } from "../src/commands/doctor.js";
import { listCommand } from "../src/commands/list.js";
import { purgeCommand } from "../src/commands/purge.js";
import { searchCommand } from "../src/commands/search.js";
import { SafetyRefusalError } from "../src/core/errors.js";
import { createCodexFixture } from "./helpers/fixture.js";

describe("mvp commands", () => {
  const originalThreadId = process.env.CODEX_THREAD_ID;

  afterEach(() => {
    if (originalThreadId === undefined) {
      delete process.env.CODEX_THREAD_ID;
    } else {
      process.env.CODEX_THREAD_ID = originalThreadId;
    }
  });

  it("doctor validates a supported fixture", () => {
    const fixture = createCodexFixture();
    const report = doctorCommand(fixture.paths);

    expect(report.supported).toBe(true);
    expect(report.checks.some((check) => check.name === "state_db" && check.status === "ok")).toBe(true);
  });

  it("lists non-archived threads", () => {
    const fixture = createCodexFixture();
    const threads = listCommand(fixture.paths, { limit: 10 });

    expect(threads).toHaveLength(3);
    expect(threads[0]?.id).toBe("thread-3");
  });

  it("searches thread title and prompt fields", () => {
    const fixture = createCodexFixture();
    const titleMatches = searchCommand(fixture.paths, "Keep", { all: true });
    const promptMatches = searchCommand(fixture.paths, "please delete", { all: true });

    expect(titleMatches.map((thread) => thread.id)).toEqual(["thread-2"]);
    expect(promptMatches.map((thread) => thread.id)).toContain("thread-1");
  });

  it("builds a dry-run purge plan by id", () => {
    const fixture = createCodexFixture();
    const plan = purgeCommand(fixture.paths, { id: "thread-1" }, false);

    expect("mode" in plan && plan.mode).toBe("dry-run");
    if ("mode" in plan && plan.mode === "dry-run") {
      expect(plan.target.id).toBe("thread-1");
      expect(plan.stores.some((store) => store.store === "state_db.thread_dynamic_tools" && store.count === 1)).toBe(true);
      expect(plan.stores.some((store) => store.store === "shell_snapshot" && store.exists)).toBe(true);
    }
  });

  it("refuses duplicate exact-title purge resolution", () => {
    const fixture = createCodexFixture();

    expect(() => purgeCommand(fixture.paths, { title: "Delete Me" }, false)).toThrow(SafetyRefusalError);
  });

  it("keeps contains matching search-only", () => {
    const fixture = createCodexFixture();
    const result = purgeCommand(fixture.paths, { contains: "delete" }, false);

    expect("kind" in result && result.kind).toBe("contains_matches");
    if ("kind" in result) {
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });

  it("refuses contains execution", () => {
    const fixture = createCodexFixture();

    expect(() => purgeCommand(fixture.paths, { contains: "delete" }, true)).toThrow(SafetyRefusalError);
  });

  it("executes purge with backup and verification in a fixture", () => {
    const fixture = createCodexFixture();
    const result = purgeCommand(fixture.paths, { id: "thread-1" }, true);

    expect("mode" in result && result.mode).toBe("executed");
    if (!("mode" in result) || result.mode !== "executed") {
      throw new Error("expected executed purge report");
    }

    expect(result.backup.entries.length).toBeGreaterThan(0);
    expect(existsSync(path.join(result.backup.backupDir, "manifest.json"))).toBe(true);
    expect(result.verification.success).toBe(true);
    expect(existsSync(result.plan.target.rolloutPath)).toBe(false);
    expect(existsSync(path.join(fixture.codexHome, "shell_snapshots", "thread-1.1.sh"))).toBe(false);
    expect(readFileSync(fixture.paths.sessionIndex, "utf8")).not.toContain("thread-1");
    expect(readFileSync(fixture.paths.globalState, "utf8")).not.toContain("thread-1");

    const stateDb = new Database(fixture.paths.stateDb, { readonly: true });
    try {
      const threadCount = stateDb.prepare("select count(*) as count from threads where id = ?").get("thread-1") as {
        count: number;
      };
      const toolCount = stateDb
        .prepare("select count(*) as count from thread_dynamic_tools where thread_id = ?")
        .get("thread-1") as { count: number };
      const assignedCount = stateDb
        .prepare("select count(*) as count from agent_job_items where assigned_thread_id = ?")
        .get("thread-1") as { count: number };

      expect(threadCount.count).toBe(0);
      expect(toolCount.count).toBe(0);
      expect(assignedCount.count).toBe(0);
    } finally {
      stateDb.close();
    }
  });

  it("refuses to purge the active thread", () => {
    const fixture = createCodexFixture();
    process.env.CODEX_THREAD_ID = "thread-1";

    expect(() => purgeCommand(fixture.paths, { id: "thread-1" }, true)).toThrow(SafetyRefusalError);
  });
});
