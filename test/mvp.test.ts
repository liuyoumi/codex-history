import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { doctorCommand } from "../src/commands/doctor.js";
import { listCommand } from "../src/commands/list.js";
import { planPurgeCommand, purgeCommand } from "../src/commands/purge.js";
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
    expect(threads.find((thread) => thread.id === "thread-2")?.title).toBe("Keep Me");
  });

  it("lists all matching threads when no limit is provided", () => {
    const fixture = createCodexFixture();
    const threads = listCommand(fixture.paths);

    expect(threads).toHaveLength(3);
  });

  it("greps displayed thread titles without matching prompt bodies", () => {
    const fixture = createCodexFixture();
    const titleMatches = listCommand(fixture.paths, { all: true, grep: "Keep" });
    const promptMatches = listCommand(fixture.paths, { all: true, grep: "please delete" });

    expect(titleMatches.map((thread) => thread.id)).toEqual(["thread-2"]);
    expect(promptMatches).toHaveLength(0);
  });

  it("applies list limits after grepping all displayed titles", () => {
    const fixture = createCodexFixture();
    const matches = listCommand(fixture.paths, { all: true, grep: "Keep", limit: 1 });

    expect(matches.map((thread) => thread.id)).toEqual(["thread-2"]);
  });

  it("builds a purge plan by id", () => {
    const fixture = createCodexFixture();
    const plan = planPurgeCommand(fixture.paths, "thread-1");

    expect(plan.mode).toBe("planned");
    expect(plan.target.id).toBe("thread-1");
    expect(plan.stores.some((store) => store.store === "state_db.thread_dynamic_tools" && store.count === 1)).toBe(true);
    expect(plan.stores.some((store) => store.store === "shell_snapshot" && store.exists)).toBe(true);
  });

  it("resolves a unique short id prefix for purge", () => {
    const fixture = createCodexFixture();
    const plan = planPurgeCommand(fixture.paths, "thread-1".slice(0, 8));

    expect(plan.mode).toBe("planned");
    expect(plan.target.id).toBe("thread-1");
  });

  it("executes purge with verification in a fixture", () => {
    const fixture = createCodexFixture();
    const result = purgeCommand(fixture.paths, "thread-1");

    expect("mode" in result && result.mode).toBe("executed");
    if (!("mode" in result) || result.mode !== "executed") {
      throw new Error("expected executed purge report");
    }

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

    expect(() => purgeCommand(fixture.paths, "thread-1")).toThrow(SafetyRefusalError);
  });
});
