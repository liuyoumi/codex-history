#!/usr/bin/env node
import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { doctorCommand } from "./commands/doctor.js";
import { listCommand } from "./commands/list.js";
import { executePurgePlanCommand, planPurgeCommand } from "./commands/purge.js";
import { searchCommand } from "./commands/search.js";
import { CodexHistoryError, SafetyRefusalError, UsageError } from "./core/errors.js";
import type { PurgeExecutionReport } from "./core/executor.js";
import { formatDate, printOutput, shortId, type OutputMode } from "./core/output.js";
import { resolvePaths } from "./core/paths.js";
import type { PurgePlan } from "./core/planner.js";
import type { DoctorReport } from "./core/schema.js";
import type { ThreadSummary } from "./core/threads.js";

const TITLE_MAX_LENGTH = 80;
type PrettyFormat = "oneline" | "medium" | "full";

const program = new Command();

program
  .name("codex-history")
  .description("Inspect and safely purge local Codex conversation history.")
  .version("0.1.0")
  .option("--codex-home <path>", "Path to Codex home directory", "~/.codex")
  .option("--json", "Print machine-readable JSON output");

program
  .command("doctor")
  .description("Check whether the local Codex data model is supported.")
  .action(() =>
    runCommand(() => {
      const report = doctorCommand(currentPaths());
      if (!report.supported) {
        process.exitCode = 1;
      }
      return formatDoctor(report);
    }),
  );

program
  .command("list")
  .description("List local Codex conversations.")
  .option("--limit <number>", "Maximum rows to show", parseInteger)
  .option("--all", "Include archived and non-archived threads")
  .option("--archived", "Show archived threads")
  .option("--cwd <path>", "Filter by exact working directory")
  .option("--pretty <format>", "Output format: oneline, medium, full", parsePretty, "oneline")
  .option("--no-pager", "Disable pager output")
  .action((options) =>
    runCommand(() =>
      formatThreads(
        listCommand(currentPaths(), {
          limit: options.limit,
          all: options.all,
          archived: options.archived,
          cwd: options.cwd,
        }),
        options.pretty,
        shouldUsePager(options),
      ),
    ),
  );

program
  .command("search")
  .argument("<keyword>", "Title, id, or cwd keyword to search for")
  .description("Search local Codex conversations.")
  .option("--limit <number>", "Maximum matching rows to show", parseInteger)
  .option("--all", "Include archived and non-archived threads")
  .option("--archived", "Show archived threads")
  .option("--pretty <format>", "Output format: oneline, medium, full", parsePretty, "oneline")
  .option("--no-pager", "Disable pager output")
  .action((keyword: string, options) =>
    runCommand(() =>
      formatThreads(
        searchCommand(currentPaths(), keyword, {
          limit: options.limit,
          all: options.all,
          archived: options.archived,
        }),
        options.pretty,
        shouldUsePager(options),
      ),
    ),
  );

program
  .command("purge")
  .argument("<threadId>", "Codex thread id or unique short id prefix to purge")
  .option("--force", "Skip interactive confirmation")
  .description("Purge one local Codex conversation after target confirmation.")
  .action((threadId: string, options) =>
    runCommand(async () => {
      const paths = currentPaths();
      const plan = planPurgeCommand(paths, threadId);
      const force = Boolean(options.force);

      if (currentOutputModeIsJson() && !force) {
        throw new UsageError("JSON purge output requires --force because interactive confirmation is text-only.");
      }

      if (!force) {
        await confirmPurge(plan);
      }

      return formatPurgeResult(executePurgePlanCommand(paths, plan));
    }),
  );

await program.parseAsync();

function currentOutputMode(): OutputMode {
  return program.opts().json ? "json" : "text";
}

function currentPaths() {
  return resolvePaths(program.opts().codexHome);
}

async function runCommand(produce: () => unknown | Promise<unknown>): Promise<void> {
  try {
    printOutput(await produce(), currentOutputMode());
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

function parsePretty(value: string): PrettyFormat {
  if (value === "oneline" || value === "medium" || value === "full") {
    return value;
  }

  throw new Error(`Expected pretty format oneline, medium, or full; got: ${value}`);
}

function shouldUsePager(options: { limit?: number; pager?: boolean }): boolean {
  return Boolean(options.pager && options.limit === undefined && process.stdout.isTTY && !currentOutputModeIsJson());
}

function currentOutputModeIsJson(): boolean {
  return currentOutputMode() === "json";
}

async function confirmPurge(plan: PurgePlan): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new SafetyRefusalError("Purge requires an interactive terminal. Use --force to skip confirmation.");
  }

  const expected = shortId(plan.target.id);
  process.stdout.write(formatPurgeConfirmation(plan));

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await readline.question(`Type ${expected} to confirm: `);
    if (answer.trim() !== expected) {
      throw new SafetyRefusalError("Confirmation did not match. No local Codex data was modified.");
    }
  } finally {
    readline.close();
  }
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

function formatThreads(threads: ThreadSummary[], pretty: PrettyFormat = "oneline", usePager = false): unknown {
  if (currentOutputMode() === "json") {
    return { count: threads.length, threads: threads.map(toPublicThread) };
  }

  if (threads.length === 0) {
    return "No Codex conversations found.";
  }

  const text = threads.map((thread) => formatThread(thread, pretty)).join(pretty === "oneline" ? "\n" : "\n\n");
  return usePager ? pageText(text) : text;
}

function formatThread(thread: ThreadSummary, pretty: PrettyFormat): string {
  const header = `${shortId(thread.id)}  ${displayTitle(thread.title)}`;

  if (pretty === "oneline") {
    return header;
  }

  const mediumLines = [
    header,
    `  id: ${thread.id}`,
    `  updated: ${formatDate(thread.updatedAtMs)}`,
    `  cwd: ${thread.cwd}`,
  ];

  if (pretty === "medium") {
    return mediumLines.join("\n");
  }

  return [
    ...mediumLines,
    `  created: ${formatDate(thread.createdAtMs)}`,
    `  archived: ${thread.archived}`,
    `  rollout: ${thread.rolloutPath}`,
  ].join("\n");
}

function pageText(text: string): string {
  const pagerCommand = process.env.PAGER || "less";
  const [pager, ...configuredArgs] = pagerCommand.split(/\s+/).filter(Boolean);
  const pagerArgs = configuredArgs.length === 0 && pager?.endsWith("less") ? ["-FRX"] : configuredArgs;

  if (!pager) {
    return text;
  }

  const result = spawnSync(pager, pagerArgs, {
    input: text,
    stdio: ["pipe", "inherit", "inherit"],
    encoding: "utf8",
  });

  if (result.error) {
    return text;
  }

  return "";
}

function formatPurgeResult(result: PurgeExecutionReport): unknown {
  if (currentOutputMode() === "json") {
    return sanitizePurgeResult(result);
  }

  const lines = [
    "Purge executed.",
    "",
    `Target: ${displayTitle(result.plan.target.title)}`,
    `Thread id: ${result.plan.target.id}`,
    `Backup: ${result.backup.backupDir}`,
    "",
    "SQLite changes:",
    ...result.sqlite.map((change) => `- ${change.store}: ${change.changedRows} row(s)`),
    "",
    "JSON changes:",
    ...result.json.map((change) => `- ${change.changed ? "changed" : "unchanged"}: ${change.path}`),
    "",
    "File changes:",
    ...result.files.map((change) => `- ${change.deleted ? "deleted" : "missing"}: ${change.path}`),
    "",
    `Verification: ${result.verification.success ? "passed" : "failed"}`,
  ];

  if (result.verification.remainingReferences.length > 0) {
    lines.push(
      "",
      "Remaining references:",
      ...result.verification.remainingReferences.map(
        (reference) => `- ${reference.store}: ${reference.path} (${reference.detail})`,
      ),
    );
    process.exitCode = 1;
  }

  return lines.join("\n");
}

function formatPurgeConfirmation(plan: PurgePlan): string {
  return [
    "About to purge this local Codex conversation:",
    "",
    `${shortId(plan.target.id)}  ${displayTitle(plan.target.title)}`,
    `id: ${plan.target.id}`,
    `updated: ${formatDate(plan.target.updatedAtMs)}`,
    `cwd: ${plan.target.cwd}`,
    "",
    "A backup will be created before deletion.",
    "",
  ].join("\n");
}

function displayTitle(title: string): string {
  const normalized = title.trim().replaceAll(/\s+/g, " ");
  if (!normalized) {
    return "(untitled)";
  }

  if (normalized.length <= TITLE_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, TITLE_MAX_LENGTH - 3)}...`;
}

function toPublicThread(thread: ThreadSummary) {
  return {
    id: thread.id,
    title: displayTitle(thread.title),
    titleTruncated: thread.title.trim().replaceAll(/\s+/g, " ").length > TITLE_MAX_LENGTH,
    rolloutPath: thread.rolloutPath,
    createdAtMs: thread.createdAtMs,
    updatedAtMs: thread.updatedAtMs,
    cwd: thread.cwd,
    archived: thread.archived,
  };
}

function sanitizePurgeResult(result: PurgeExecutionReport): unknown {
  return {
    ...result,
    plan: {
      ...result.plan,
      target: toPublicThread(result.plan.target),
    },
  };
}
