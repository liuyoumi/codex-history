import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ResolvedPaths } from "./paths.js";
import { fileStatus } from "./paths.js";
import { openReadonlyDatabase, sqliteFileExists, tableColumns, tableExists } from "../stores/sqlite.js";

export type CheckStatus = "ok" | "warning" | "error";

export type DoctorCheck = {
  name: string;
  status: CheckStatus;
  detail: string;
};

export type DoctorReport = {
  supported: boolean;
  codexHome: string;
  checks: DoctorCheck[];
};

const REQUIRED_THREAD_COLUMNS = [
  "id",
  "title",
  "rollout_path",
  "created_at",
  "updated_at",
  "cwd",
  "archived",
  "first_user_message",
  "preview",
];

export function runDoctor(paths: ResolvedPaths): DoctorReport {
  const checks: DoctorCheck[] = [];

  checks.push({
    name: "codex_home",
    status: fileStatus(paths.codexHome) === "present" ? "ok" : "error",
    detail: paths.codexHome,
  });

  checks.push(checkStateDatabase(paths.stateDb));
  checks.push(checkOptionalSqlite(paths.logsDb, "logs_db"));
  checks.push(checkOptionalSqlite(paths.goalsDb, "goals_db"));
  checks.push(checkJsonFile(paths.globalState, "global_state"));
  checks.push(checkJsonFile(paths.globalStateBackup, "global_state_backup"));
  checks.push(checkJsonlFile(paths.sessionIndex, "session_index"));
  checks.push(checkBackupHome(paths.backupHome));

  return {
    supported: !checks.some((check) => check.status === "error"),
    codexHome: paths.codexHome,
    checks,
  };
}

export function validateSupportedDataModel(
  paths: ResolvedPaths,
  options: { requireBackupHome?: boolean } = {},
): void {
  const report = runDoctor(paths);
  const errors = report.checks.filter(
    (check) => check.status === "error" && (options.requireBackupHome || check.name !== "backup_home"),
  );

  if (errors.length > 0) {
    const details = errors.map((check) => `${check.name}: ${check.detail}`).join("; ");
    throw new Error(`Unsupported Codex data model: ${details}`);
  }
}

function checkStateDatabase(filePath: string): DoctorCheck {
  if (!sqliteFileExists(filePath)) {
    return {
      name: "state_db",
      status: "error",
      detail: `${filePath} is missing`,
    };
  }

  try {
    const db = openReadonlyDatabase(filePath);
    try {
      if (!tableExists(db, "threads")) {
        return {
          name: "state_db",
          status: "error",
          detail: "missing threads table",
        };
      }

      const columns = tableColumns(db, "threads");
      const missingColumns = REQUIRED_THREAD_COLUMNS.filter((column) => !columns.includes(column));
      if (missingColumns.length > 0) {
        return {
          name: "state_db",
          status: "error",
          detail: `missing threads columns: ${missingColumns.join(", ")}`,
        };
      }

      return {
        name: "state_db",
        status: "ok",
        detail: filePath,
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return {
      name: "state_db",
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkOptionalSqlite(filePath: string, name: string): DoctorCheck {
  if (!sqliteFileExists(filePath)) {
    return {
      name,
      status: "warning",
      detail: `${filePath} is missing`,
    };
  }

  try {
    const db = openReadonlyDatabase(filePath);
    db.close();
    return {
      name,
      status: "ok",
      detail: filePath,
    };
  } catch (error) {
    return {
      name,
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkJsonFile(filePath: string, name: string): DoctorCheck {
  if (fileStatus(filePath) === "missing") {
    return {
      name,
      status: "warning",
      detail: `${filePath} is missing`,
    };
  }

  try {
    JSON.parse(readFileSync(filePath, "utf8"));
    return {
      name,
      status: "ok",
      detail: filePath,
    };
  } catch (error) {
    return {
      name,
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkJsonlFile(filePath: string, name: string): DoctorCheck {
  if (fileStatus(filePath) === "missing") {
    return {
      name,
      status: "warning",
      detail: `${filePath} is missing`,
    };
  }

  try {
    const lines = readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0);

    for (const line of lines) {
      JSON.parse(line);
    }

    return {
      name,
      status: "ok",
      detail: `${filePath} (${lines.length} entries)`,
    };
  } catch (error) {
    return {
      name,
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkBackupHome(backupHome: string): DoctorCheck {
  try {
    mkdirSync(dirname(backupHome), { recursive: true });
    mkdirSync(backupHome, { recursive: true });
    return {
      name: "backup_home",
      status: "ok",
      detail: backupHome,
    };
  } catch (error) {
    return {
      name: "backup_home",
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
