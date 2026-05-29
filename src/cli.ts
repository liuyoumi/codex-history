#!/usr/bin/env node
import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { doctorCommand } from "./commands/doctor.js";
import { listCommand } from "./commands/list.js";
import { executePurgePlanCommand, planPurgeCommand } from "./commands/purge.js";
import { executePurgeOrphansPlanCommand, planPurgeOrphansCommand } from "./commands/purge-orphans.js";
import { CodexHistoryError, SafetyRefusalError, UsageError } from "./core/errors.js";
import type { PurgeExecutionReport } from "./core/executor.js";
import { hasPurgeOrphansWork, type PurgeOrphansExecutionReport, type PurgeOrphansPlan } from "./core/orphans.js";
import { formatDate, printOutput, shortId, type OutputMode } from "./core/output.js";
import { resolvePaths } from "./core/paths.js";
import type { PurgePlan } from "./core/planner.js";
import type { DoctorReport } from "./core/schema.js";
import type { ThreadSummary } from "./core/threads.js";

const TITLE_MAX_LENGTH = 80;
type PrettyFormat = "oneline" | "medium" | "full";
type ColorName = "dim" | "green" | "red" | "yellow";
const packageVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

const program = new Command();

program
  .name("codex-history")
  .description("Inspect and safely purge local Codex conversation history.")
  .version(packageVersion)
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
  .option("--grep <keyword>", "Filter by title, id, or cwd keyword")
  .option("--pretty <format>", "Output format: oneline, medium, full", parsePretty, "oneline")
  .action((options) =>
    runCommand(() =>
      formatThreads(
        listCommand(currentPaths(), {
          limit: options.limit,
          all: options.all,
          archived: options.archived,
          cwd: options.cwd,
          grep: options.grep,
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

program
  .command("purge-orphans")
  .option("--force", "Skip interactive confirmation")
  .description("Purge orphaned local Codex data after target confirmation.")
  .action((options) =>
    runCommand(async () => {
      if (currentOutputModeIsJson()) {
        throw new UsageError("purge-orphans does not support JSON output.");
      }

      const paths = currentPaths();
      const plan = planPurgeOrphansCommand(paths);
      const force = Boolean(options.force);

      if (!hasPurgeOrphansWork(plan)) {
        return formatPurgeOrphansPlan(plan);
      }

      if (!force) {
        await confirmPurgeOrphans(plan);
      }

      return formatPurgeOrphansResult(executePurgeOrphansPlanCommand(paths, plan));
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
      console.error(`${colorizeError("red", "Error:")} ${message}`);
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

function shouldUsePager(options: { limit?: number }): boolean {
  return Boolean(options.limit === undefined && process.stdout.isTTY && !currentOutputModeIsJson());
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
    const answer = await readline.question(`Type ${colorize("yellow", expected)} to confirm: `);
    if (answer.trim() !== expected) {
      throw new SafetyRefusalError("Confirmation did not match. No local Codex data was modified.");
    }
  } finally {
    readline.close();
  }
}

async function confirmPurgeOrphans(plan: PurgeOrphansPlan): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new SafetyRefusalError("purge-orphans requires an interactive terminal. Use --force to skip confirmation.");
  }

  const expected = "purge-orphans";
  process.stdout.write(formatPurgeOrphansConfirmation(plan));

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await readline.question(`Type ${colorize("yellow", expected)} to confirm: `);
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
    `${colorize("dim", "Codex home:")} ${colorize("dim", report.codexHome)}`,
    `${colorize("dim", "Supported:")} ${report.supported ? colorize("green", "yes") : colorize("red", "no")}`,
    "",
    ...report.checks.map(
      (check) => `${formatCheckStatus(check.status)} ${check.name}: ${check.detail}`,
    ),
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
  const header = `${colorize("yellow", shortId(thread.id))}  ${displayTitle(thread.title)}`;

  if (pretty === "oneline") {
    return header;
  }

  const mediumLines = [
    header,
    `  ${colorize("dim", "id:")} ${colorize("yellow", thread.id)}`,
    `  ${colorize("dim", "updated:")} ${formatDate(thread.updatedAtMs)}`,
    `  ${colorize("dim", "cwd:")} ${colorize("dim", thread.cwd)}`,
  ];

  if (pretty === "medium") {
    return mediumLines.join("\n");
  }

  return [
    ...mediumLines,
    `  ${colorize("dim", "created:")} ${formatDate(thread.createdAtMs)}`,
    `  ${colorize("dim", "archived:")} ${thread.archived}`,
    `  ${colorize("dim", "rollout:")} ${colorize("dim", thread.rolloutPath)}`,
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
    colorize("green", "Purge executed."),
    "",
    `Target: ${displayTitle(result.plan.target.title)}`,
    `Thread id: ${result.plan.target.id}`,
    "",
    "SQLite changes:",
    ...result.sqlite.map((change) => `- ${change.store}: ${change.changedRows} row(s)`),
    "",
    "JSON changes:",
    ...result.json.map((change) => `- ${change.changed ? "changed" : "unchanged"}: ${colorize("dim", change.path)}`),
    "",
    "File changes:",
    ...result.files.map((change) => `- ${change.deleted ? "deleted" : "missing"}: ${colorize("dim", change.path)}`),
    "",
    `Verification: ${result.verification.success ? colorize("green", "passed") : colorize("red", "failed")}`,
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

function formatPurgeOrphansPlan(plan: PurgeOrphansPlan): string {
  if (!hasPurgeOrphansWork(plan)) {
    return "No orphaned local Codex data found.";
  }

  return formatPurgeOrphansConfirmation(plan).trimEnd();
}

function formatPurgeOrphansResult(result: PurgeOrphansExecutionReport): string {
  const sqliteChanges = aggregateOrphanSqliteChanges(result);
  const filesDeleted = result.purgeReports.flatMap((report) => report.files).filter((file) => file.deleted).length;
  const jsonChanged = result.purgeReports
    .flatMap((report) => report.json)
    .filter((change) => change.changed).length;
  const lines = [
    colorize("green", "Purge-orphans executed."),
    "",
    "Summary:",
    `- Orphaned threads purged: ${result.plan.orphanThreads.length}`,
    `- Logs-only orphan thread ids cleaned: ${result.plan.logsOnlyOrphans.length}`,
    `- SQLite row changes: ${sqliteChanges.reduce((sum, change) => sum + change.rows, 0)}`,
    `- JSON/JSONL file changes: ${jsonChanged}`,
    `- Files deleted: ${filesDeleted}`,
    `- Estimated local disk space affected: ${formatNullableBytes(result.plan.impact.estimatedLocalDiskBytesAffected)}`,
    "",
    "SQLite changes:",
    ...formatSqliteRows(sqliteChanges),
    "",
    colorize("dim", "SQLite database files may not shrink until vacuumed by Codex or another SQLite maintenance step."),
    "",
    `Verification: ${result.verification.success ? colorize("green", "passed") : colorize("red", "failed")}`,
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
    `title: ${displayTitle(plan.target.title)}`,
    `id: ${plan.target.id}`,
    `cwd: ${colorize("dim", plan.target.cwd)}`,
    `updated: ${formatDate(plan.target.updatedAtMs)}`,
    "",
    colorize("dim", "This cannot be undone."),
    "",
  ].join("\n");
}

function formatPurgeOrphansConfirmation(plan: PurgeOrphansPlan): string {
  return [
    "About to purge orphaned local Codex data:",
    "",
    `Orphaned threads: ${plan.orphanThreads.length}`,
    `Logs-only orphan thread ids: ${plan.logsOnlyOrphans.length}`,
    "",
    "SQLite row changes:",
    ...formatSqliteRows(plan.impact.sqlite),
    "",
    "Files:",
    `- files to delete: ${plan.impact.filesToDelete}`,
    `- file bytes to delete: ${formatBytes(plan.impact.fileBytesToDelete)}`,
    "",
    "Estimated cleanup impact:",
    `- estimated log payload affected: ${formatNullableBytes(plan.impact.estimatedLogPayloadBytes)}`,
    `- estimated local disk space affected: ${formatNullableBytes(plan.impact.estimatedLocalDiskBytesAffected)}`,
    "",
    ...formatOrphanExamples(plan),
    colorize("dim", "SQLite database files may not shrink until vacuumed by Codex or another SQLite maintenance step."),
    colorize("dim", "This cannot be undone."),
    "",
  ].join("\n");
}

function formatOrphanExamples(plan: PurgeOrphansPlan): string[] {
  const examples = [
    ...plan.orphanThreads.slice(0, 5).map(
      (thread) => `- ${shortId(thread.id)}  ${displayTitle(thread.title)}  ${colorize("dim", thread.cwd)}`,
    ),
    ...plan.logsOnlyOrphans.slice(0, Math.max(0, 5 - Math.min(plan.orphanThreads.length, 5))).map(
      (orphan) => `- logs-only: ${shortId(orphan.threadId)} (${orphan.rows} row(s))`,
    ),
  ];

  if (examples.length === 0) {
    return [];
  }

  const total = plan.orphanThreads.length + plan.logsOnlyOrphans.length;
  const lines = ["Examples:", ...examples, ""];
  if (total > examples.length) {
    lines.push(`Showing ${examples.length} of ${total} orphan candidate(s).`, "");
  }

  return lines;
}

function aggregateOrphanSqliteChanges(result: PurgeOrphansExecutionReport): Array<{ store: string; rows: number }> {
  const changes = new Map<string, number>();
  for (const report of result.purgeReports) {
    for (const change of report.sqlite) {
      changes.set(change.store, (changes.get(change.store) ?? 0) + change.changedRows);
    }
  }

  changes.set(result.logsOnly.store, (changes.get(result.logsOnly.store) ?? 0) + result.logsOnly.changedRows);

  return [...changes.entries()]
    .filter(([, rows]) => rows > 0)
    .map(([store, rows]) => ({ store, rows }))
    .sort((a, b) => a.store.localeCompare(b.store));
}

function formatSqliteRows(rows: Array<{ store: string; rows: number }>): string[] {
  if (rows.length === 0) {
    return ["- none"];
  }

  return rows.map((row) => `- ${row.store}: ${row.rows} row(s)`);
}

function formatNullableBytes(value: number | null): string {
  return value === null ? "unavailable" : formatBytes(value);
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatCheckStatus(status: string): string {
  const label = status.toUpperCase().padEnd(7);
  if (status === "ok") {
    return colorize("green", label);
  }
  if (status === "warning") {
    return colorize("yellow", label);
  }
  if (status === "error") {
    return colorize("red", label);
  }

  return label;
}

function colorize(color: ColorName, value: string): string {
  return applyColor(color, value, colorsEnabled());
}

function colorizeError(color: ColorName, value: string): string {
  return applyColor(color, value, errorColorsEnabled());
}

function applyColor(color: ColorName, value: string, enabled: boolean): string {
  if (!enabled) {
    return value;
  }

  const codes: Record<ColorName, [number, number]> = {
    dim: [2, 22],
    green: [32, 39],
    red: [31, 39],
    yellow: [33, 39],
  };
  const [open, close] = codes[color];

  return `\u001B[${open}m${value}\u001B[${close}m`;
}

function colorsEnabled(): boolean {
  return streamColorsEnabled(process.stdout);
}

function errorColorsEnabled(): boolean {
  return streamColorsEnabled(process.stderr);
}

function streamColorsEnabled(stream: NodeJS.WriteStream): boolean {
  return !currentOutputModeIsJson() && !("NO_COLOR" in process.env) && Boolean(stream.isTTY);
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
