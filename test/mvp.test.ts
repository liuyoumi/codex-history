import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { doctorCommand } from "../src/commands/doctor.js";
import { listCommand } from "../src/commands/list.js";
import {
  executeBatchPurgePlanCommand,
  hasPurgeFilter,
  planBatchPurgeCommand,
  planFilteredPurgeCommand,
  planPurgeCommand,
  purgeCommand,
} from "../src/commands/purge.js";
import { executePurgeOrphansPlanCommand, planPurgeOrphansCommand } from "../src/commands/purge-orphans.js";
import { SafetyRefusalError, UsageError } from "../src/core/errors.js";
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

  it("greps readable conversation text without matching ids or cwd", () => {
    const fixture = createCodexFixture();
    const titleMatches = listCommand(fixture.paths, { all: true, grep: "Keep" });
    const firstUserMatches = listCommand(fixture.paths, { all: true, grep: "please delete" });
    const previewMatches = listCommand(fixture.paths, { all: true, grep: "duplicate preview" });
    const idMatches = listCommand(fixture.paths, { all: true, grep: "thread-1" });
    const cwdMatches = listCommand(fixture.paths, { all: true, grep: "project-a" });

    expect(titleMatches.map((thread) => thread.id)).toEqual(["thread-2"]);
    expect(firstUserMatches.map((thread) => thread.id)).toEqual(["thread-1"]);
    expect(previewMatches.map((thread) => thread.id)).toEqual(["thread-3"]);
    expect(idMatches).toHaveLength(0);
    expect(cwdMatches).toHaveLength(0);
  });

  it("applies list limits after grepping all displayed titles", () => {
    const fixture = createCodexFixture();
    const matches = listCommand(fixture.paths, { all: true, grep: "Keep", limit: 1 });

    expect(matches.map((thread) => thread.id)).toEqual(["thread-2"]);
  });

  it("matches cwd by path fragment", () => {
    const fixture = createCodexFixture();
    const exactMatches = listCommand(fixture.paths, { cwd: "/tmp/project-a" });
    const fragmentMatches = listCommand(fixture.paths, { cwd: "project" });

    expect(exactMatches.map((thread) => thread.id)).toEqual(["thread-1"]);
    expect(fragmentMatches.map((thread) => thread.id)).toEqual(["thread-3", "thread-2", "thread-1"]);
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

  it("removes prefixed thread id keys from global state during purge", () => {
    const fixture = createCodexFixture();

    for (const filePath of [fixture.paths.globalState, fixture.paths.globalStateBackup]) {
      const state = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
      state["composer-prompt-drafts-v1"] = {
        "local:thread-1": "draft text",
        "local:thread-2": "kept draft",
      };
      writeFileSync(filePath, JSON.stringify(state, null, 2) + "\n");
    }

    const result = purgeCommand(fixture.paths, "thread-1");

    expect("mode" in result && result.mode).toBe("executed");
    if (!("mode" in result) || result.mode !== "executed") {
      throw new Error("expected executed purge report");
    }

    expect(result.verification.success).toBe(true);
    expect(readFileSync(fixture.paths.globalState, "utf8")).not.toContain("thread-1");
    expect(readFileSync(fixture.paths.globalStateBackup, "utf8")).not.toContain("thread-1");
    expect(readFileSync(fixture.paths.globalState, "utf8")).toContain("local:thread-2");
    expect(readFileSync(fixture.paths.globalStateBackup, "utf8")).toContain("local:thread-2");
  });

  it("plans batch purge with duplicate target inputs deduplicated", () => {
    const fixture = createCodexFixture();
    const plan = planBatchPurgeCommand(fixture.paths, ["thread-1", "thread-1"]);

    expect(plan.mode).toBe("planned");
    expect(plan.requestedCount).toBe(2);
    expect(plan.plans.map((item) => item.target.id)).toEqual(["thread-1"]);
    expect(plan.duplicateInputs).toEqual([{ input: "thread-1", targetId: "thread-1" }]);
  });

  it("executes batch purge for multiple explicit targets", () => {
    const fixture = createCodexFixture({ includeOrphans: true });
    const plan = planBatchPurgeCommand(fixture.paths, ["thread-1", "thread-orphan"]);
    const result = executeBatchPurgePlanCommand(fixture.paths, plan);

    expect(result.mode).toBe("executed");
    expect(result.verification.success).toBe(true);
    expect(result.purgeReports).toHaveLength(2);

    const stateDb = new Database(fixture.paths.stateDb, { readonly: true });
    const logsDb = new Database(fixture.paths.logsDb, { readonly: true });
    try {
      const threadRows = stateDb
        .prepare("select count(*) as count from threads where id in (?, ?)")
        .get("thread-1", "thread-orphan") as { count: number };
      const logRows = logsDb
        .prepare("select count(*) as count from logs where thread_id in (?, ?)")
        .get("thread-1", "thread-orphan") as { count: number };

      expect(threadRows.count).toBe(0);
      expect(logRows.count).toBe(0);
    } finally {
      stateDb.close();
      logsDb.close();
    }
  });

  it("plans filtered purge by cwd", () => {
    const fixture = createCodexFixture();
    const plan = planFilteredPurgeCommand(fixture.paths, { cwd: "project-a" });

    expect(plan.source).toBe("filtered");
    expect(plan.plans.map((item) => item.target.id)).toEqual(["thread-1"]);
    expect(plan.filters).toEqual({ cwd: "project-a" });
  });

  it("plans filtered purge by cwd fragment", () => {
    const fixture = createCodexFixture();
    const plan = planFilteredPurgeCommand(fixture.paths, { cwd: "project" });

    expect(plan.plans.map((item) => item.target.id)).toEqual(["thread-3", "thread-2", "thread-1"]);
  });

  it("plans filtered purge with combined archived and cwd filters", () => {
    const fixture = createCodexFixture();
    const plan = planFilteredPurgeCommand(fixture.paths, { cwd: "/tmp/project-a", archived: true });

    expect(plan.plans.map((item) => item.target.id)).toEqual(["thread-archived"]);
  });

  it("executes filtered purge for matching conversations", () => {
    const fixture = createCodexFixture();
    const plan = planFilteredPurgeCommand(fixture.paths, { cwd: "/tmp/project-a" });
    const result = executeBatchPurgePlanCommand(fixture.paths, plan);

    expect(result.verification.success).toBe(true);
    expect(result.purgeReports).toHaveLength(1);

    const stateDb = new Database(fixture.paths.stateDb, { readonly: true });
    try {
      const deleted = stateDb.prepare("select count(*) as count from threads where id = ?").get("thread-1") as {
        count: number;
      };
      const keptArchived = stateDb
        .prepare("select count(*) as count from threads where id = ?")
        .get("thread-archived") as { count: number };

      expect(deleted.count).toBe(0);
      expect(keptArchived.count).toBe(1);
    } finally {
      stateDb.close();
    }
  });

  it("refuses filtered purge before mutation when any target is active", () => {
    const fixture = createCodexFixture();
    process.env.CODEX_THREAD_ID = "thread-1";
    const plan = planFilteredPurgeCommand(fixture.paths, { cwd: "/tmp/project-a" });

    expect(() => executeBatchPurgePlanCommand(fixture.paths, plan)).toThrow(SafetyRefusalError);

    const stateDb = new Database(fixture.paths.stateDb, { readonly: true });
    try {
      const row = stateDb.prepare("select count(*) as count from threads where id = ?").get("thread-1") as {
        count: number;
      };
      expect(row.count).toBe(1);
    } finally {
      stateDb.close();
    }
  });

  it("requires at least one purge filter for filtered purge planning", () => {
    const fixture = createCodexFixture();

    expect(hasPurgeFilter({})).toBe(false);
    expect(() => planFilteredPurgeCommand(fixture.paths, {})).toThrow(UsageError);
  });

  it("refuses batch purge before mutation when any target is active", () => {
    const fixture = createCodexFixture();
    process.env.CODEX_THREAD_ID = "thread-2";
    const plan = planBatchPurgeCommand(fixture.paths, ["thread-1", "thread-2"]);

    expect(() => executeBatchPurgePlanCommand(fixture.paths, plan)).toThrow(SafetyRefusalError);

    const stateDb = new Database(fixture.paths.stateDb, { readonly: true });
    try {
      const row = stateDb.prepare("select count(*) as count from threads where id = ?").get("thread-1") as {
        count: number;
      };
      expect(row.count).toBe(1);
    } finally {
      stateDb.close();
    }
  });

  it("plans orphan purge without mutating data", () => {
    const fixture = createCodexFixture({ includeOrphans: true });
    const plan = planPurgeOrphansCommand(fixture.paths);

    expect(plan.mode).toBe("planned");
    expect(plan.orphanThreads.map((thread) => thread.id).sort()).toEqual([
      "thread-archived-orphan",
      "thread-orphan",
    ]);
    expect(plan.logsOnlyOrphans.map((orphan) => orphan.threadId)).toEqual(["thread-logs-only"]);
    expect(plan.impact.sqlite.find((item) => item.store === "logs_db.logs")?.rows).toBe(3);
    expect(plan.impact.filesToDelete).toBe(1);
    expect(plan.impact.estimatedLogPayloadBytes).toBe(7168);

    const stateDb = new Database(fixture.paths.stateDb, { readonly: true });
    try {
      const row = stateDb.prepare("select count(*) as count from threads where id = ?").get("thread-orphan") as {
        count: number;
      };
      expect(row.count).toBe(1);
    } finally {
      stateDb.close();
    }
  });

  it("executes orphan purge without expanding branch deletion", () => {
    const fixture = createCodexFixture({ includeOrphans: true });
    const plan = planPurgeOrphansCommand(fixture.paths);
    const result = executePurgeOrphansPlanCommand(fixture.paths, plan);

    expect(result.mode).toBe("executed");
    expect(result.verification.success).toBe(true);
    expect(result.logsOnly.changedRows).toBe(1);
    expect(existsSync(path.join(fixture.codexHome, "shell_snapshots", "thread-orphan.1.sh"))).toBe(false);
    expect(readFileSync(fixture.paths.sessionIndex, "utf8")).not.toContain("thread-orphan");
    expect(readFileSync(fixture.paths.globalState, "utf8")).not.toContain("thread-orphan");

    const stateDb = new Database(fixture.paths.stateDb, { readonly: true });
    const logsDb = new Database(fixture.paths.logsDb, { readonly: true });
    const goalsDb = new Database(fixture.paths.goalsDb, { readonly: true });
    try {
      const orphanThreadRows = stateDb
        .prepare("select count(*) as count from threads where id in (?, ?)")
        .get("thread-orphan", "thread-archived-orphan") as { count: number };
      const keptThreadRows = stateDb.prepare("select count(*) as count from threads where id = ?").get("thread-2") as {
        count: number;
      };
      const edgeRows = stateDb
        .prepare("select count(*) as count from thread_spawn_edges where parent_thread_id = ? or child_thread_id = ?")
        .get("thread-orphan", "thread-orphan") as { count: number };
      const logRows = logsDb
        .prepare("select count(*) as count from logs where thread_id in (?, ?, ?)")
        .get("thread-orphan", "thread-archived-orphan", "thread-logs-only") as { count: number };
      const goalRows = goalsDb
        .prepare("select count(*) as count from thread_goals where thread_id = ?")
        .get("thread-orphan") as { count: number };

      expect(orphanThreadRows.count).toBe(0);
      expect(keptThreadRows.count).toBe(1);
      expect(edgeRows.count).toBe(0);
      expect(logRows.count).toBe(0);
      expect(goalRows.count).toBe(0);
    } finally {
      stateDb.close();
      logsDb.close();
      goalsDb.close();
    }
  });

  it("refuses orphan purge when an orphan target is active", () => {
    const fixture = createCodexFixture({ includeOrphans: true });
    process.env.CODEX_THREAD_ID = "thread-orphan";
    const plan = planPurgeOrphansCommand(fixture.paths);

    expect(() => executePurgeOrphansPlanCommand(fixture.paths, plan)).toThrow(SafetyRefusalError);
  });

  it("refuses orphan purge when a planned missing rollout reappears", () => {
    const fixture = createCodexFixture({ includeOrphans: true });
    const plan = planPurgeOrphansCommand(fixture.paths);
    const target = plan.threadPlans.find((threadPlan) => threadPlan.target.id === "thread-orphan");

    if (!target) {
      throw new Error("expected orphan thread plan");
    }

    writeFileSync(target.target.rolloutPath, JSON.stringify({ type: "session_meta" }) + "\n");

    expect(() => executePurgeOrphansPlanCommand(fixture.paths, plan)).toThrow(SafetyRefusalError);
  });

  it("refuses to purge the active thread", () => {
    const fixture = createCodexFixture();
    process.env.CODEX_THREAD_ID = "thread-1";

    expect(() => purgeCommand(fixture.paths, "thread-1")).toThrow(SafetyRefusalError);
  });
});
