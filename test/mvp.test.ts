import { describe, expect, it } from "vitest";
import { doctorCommand } from "../src/commands/doctor.js";
import { listCommand } from "../src/commands/list.js";
import { purgeCommand } from "../src/commands/purge.js";
import { searchCommand } from "../src/commands/search.js";
import { SafetyRefusalError } from "../src/core/errors.js";
import { createCodexFixture } from "./helpers/fixture.js";

describe("mvp commands", () => {
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
    if ("mode" in plan) {
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
});

