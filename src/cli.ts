#!/usr/bin/env node
import { Command } from "commander";
import { doctorCommand } from "./commands/doctor.js";
import { listCommand } from "./commands/list.js";
import { purgeCommand } from "./commands/purge.js";
import { searchCommand } from "./commands/search.js";
import { CodexHistoryError } from "./core/errors.js";
import { formatDate, printOutput, shortId, type OutputMode } from "./core/output.js";
import { resolvePaths } from "./core/paths.js";
import type { ContainsResolution, PurgePlan } from "./core/planner.js";
import type { DoctorReport } from "./core/schema.js";
import type { ThreadSummary } from "./core/threads.js";

const program = new Command();

program
  .name("codex-history")
  .description("Inspect and safely purge local Codex conversation history.")
  .version("0.0.0")
  .option("--codex-home <path>", "Path to Codex home directory", "~/.codex")
  .option("--json", "Print machine-readable JSON output");

program
  .command("doctor")
  .description("Check whether the local Codex data model is supported.")
  .action(() => runCommand(() => formatDoctor(doctorCommand(currentPaths()))));

program
  .command("list")
  .description("List local Codex conversations.")
  .option("--limit <number>", "Maximum rows to show", parseInteger, 20)
  .option("--all", "Include archived and non-archived threads")
  .option("--archived", "Show archived threads")
  .option("--cwd <path>", "Filter by exact working directory")
  .action((options) =>
    runCommand(() =>
      formatThreads(
        listCommand(currentPaths(), {
          limit: options.limit,
          all: options.all,
          archived: options.archived,
          cwd: options.cwd,
        }),
      ),
    ),
  );

program
  .command("search")
  .argument("<keyword>", "Title or prompt keyword to search for")
  .description("Search local Codex conversations.")
  .option("--limit <number>", "Maximum rows to scan/show", parseInteger, 200)
  .option("--all", "Include archived and non-archived threads")
  .option("--archived", "Show archived threads")
  .action((keyword: string, options) =>
    runCommand(() =>
      formatThreads(
        searchCommand(currentPaths(), keyword, {
          limit: options.limit,
          all: options.all,
          archived: options.archived,
        }),
      ),
    ),
  );

program
  .command("purge")
  .option("--id <threadId>", "Codex thread id to purge")
  .option("--title <title>", "Exact title to resolve before purge")
  .option("--contains <keyword>", "Title or first-message keyword to resolve before purge")
  .option("--dry-run", "Plan purge without modifying local Codex data", true)
  .option("--yes", "Execute purge after confirmation checks")
  .description("Plan a purge. Execution remains blocked until purge safety implementation.")
  .action((options) =>
    runCommand(() =>
      formatPurgeResult(
        purgeCommand(
          currentPaths(),
          {
            id: options.id,
            title: options.title,
            contains: options.contains,
          },
          Boolean(options.yes),
        ),
      ),
    ),
  );

program.parse();

function currentOutputMode(): OutputMode {
  return program.opts().json ? "json" : "text";
}

function currentPaths() {
  return resolvePaths(program.opts().codexHome);
}

function runCommand(produce: () => unknown): void {
  try {
    printOutput(produce(), currentOutputMode());
  } catch (error) {
    const exitCode = error instanceof CodexHistoryError ? error.exitCode : 1;
    const message = error instanceof Error ? error.message : String(error);

    if (currentOutputMode() === "json") {
      console.error(JSON.stringify({ error: message, exitCode }, null, 2));
    } else {
      console.error(`Error: ${message}`);
    }

    process.exitCode = exitCode;
  }
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected positive integer, got: ${value}`);
  }
  return parsed;
}

function formatDoctor(report: DoctorReport): unknown {
  if (currentOutputMode() === "json") {
    return report;
  }

  const lines = [
    `Codex home: ${report.codexHome}`,
    `Supported: ${report.supported ? "yes" : "no"}`,
    "",
    ...report.checks.map((check) => `${check.status.toUpperCase().padEnd(7)} ${check.name}: ${check.detail}`),
  ];

  return lines.join("\n");
}

function formatThreads(threads: ThreadSummary[]): unknown {
  if (currentOutputMode() === "json") {
    return { count: threads.length, threads };
  }

  if (threads.length === 0) {
    return "No Codex conversations found.";
  }

  return threads
    .map((thread) =>
      [
        `${shortId(thread.id)}  ${thread.title || "(untitled)"}`,
        `  id: ${thread.id}`,
        `  updated: ${formatDate(thread.updatedAtMs)}`,
        `  cwd: ${thread.cwd}`,
        `  rollout: ${thread.rolloutPath}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function formatPurgeResult(result: PurgePlan | ContainsResolution): unknown {
  if (currentOutputMode() === "json") {
    return result;
  }

  if ("kind" in result) {
    return [
      "--contains is search-only in v0.1. Matching candidates:",
      "",
      formatThreads(result.matches),
    ].join("\n");
  }

  const lines = [
    "Dry-run purge plan. No local Codex data was modified.",
    "",
    `Target: ${result.target.title || "(untitled)"}`,
    `Thread id: ${result.target.id}`,
    `Updated: ${formatDate(result.target.updatedAtMs)}`,
    `CWD: ${result.target.cwd}`,
    "",
    "Planned store operations:",
    ...result.stores.map((store) => {
      const count = store.count === undefined ? "" : ` count=${store.count}`;
      const exists = store.exists === undefined ? "" : ` exists=${store.exists ? "yes" : "no"}`;
      return `- ${store.action} ${store.store}${count}${exists}: ${store.path} (${store.detail})`;
    }),
  ];

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join("\n");
}
