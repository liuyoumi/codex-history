#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("codex-history")
  .description("Inspect and safely purge local Codex conversation history.")
  .version("0.0.0");

program
  .command("list")
  .description("List local Codex conversations. Implementation pending after docs review.")
  .action(() => {
    console.log("codex-history list: pending implementation");
  });

program
  .command("search")
  .argument("<keyword>", "Title or prompt keyword to search for")
  .description("Search local Codex conversations. Implementation pending after docs review.")
  .action((keyword: string) => {
    console.log(`codex-history search: pending implementation for "${keyword}"`);
  });

program
  .command("purge")
  .option("--id <threadId>", "Codex thread id to purge")
  .option("--title <title>", "Exact title to resolve before purge")
  .option("--contains <keyword>", "Title or first-message keyword to resolve before purge")
  .option("--dry-run", "Plan purge without modifying local Codex data", true)
  .option("--yes", "Execute purge after confirmation checks")
  .description("Plan or execute a purge. Execution is blocked until docs are finalized.")
  .action(() => {
    console.log("codex-history purge: blocked until requirements and technical design are finalized");
  });

program.parse();

