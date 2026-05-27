import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type ResolvedPaths = {
  codexHome: string;
  toolHome: string;
  backupHome: string;
  stateDb: string;
  logsDb: string;
  goalsDb: string;
  sessionIndex: string;
  globalState: string;
  globalStateBackup: string;
  shellSnapshotsDir: string;
};

export function expandHome(input: string): string {
  if (input === "~") {
    return homedir();
  }

  if (input.startsWith("~/")) {
    return path.join(homedir(), input.slice(2));
  }

  return input;
}

export function resolvePaths(codexHomeInput?: string, toolHomeInput?: string): ResolvedPaths {
  const codexHome = path.resolve(expandHome(codexHomeInput ?? "~/.codex"));
  const toolHome = path.resolve(expandHome(toolHomeInput ?? process.env.CODEX_HISTORY_HOME ?? "~/.codex-history"));

  return {
    codexHome,
    toolHome,
    backupHome: path.join(toolHome, "backups"),
    stateDb: path.join(codexHome, "state_5.sqlite"),
    logsDb: path.join(codexHome, "logs_2.sqlite"),
    goalsDb: path.join(codexHome, "goals_1.sqlite"),
    sessionIndex: path.join(codexHome, "session_index.jsonl"),
    globalState: path.join(codexHome, ".codex-global-state.json"),
    globalStateBackup: path.join(codexHome, ".codex-global-state.json.bak"),
    shellSnapshotsDir: path.join(codexHome, "shell_snapshots"),
  };
}

export function fileStatus(filePath: string): "present" | "missing" {
  return existsSync(filePath) ? "present" : "missing";
}
