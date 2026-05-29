import Database from "better-sqlite3";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolvePaths } from "../../src/core/paths.js";

export type Fixture = {
  root: string;
  codexHome: string;
  paths: ReturnType<typeof resolvePaths>;
};

export type FixtureOptions = {
  includeOrphans?: boolean;
};

export function createCodexFixture(options: FixtureOptions = {}): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "codex-history-test-"));
  const codexHome = path.join(root, ".codex");
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(path.join(codexHome, "sessions", "2026", "05", "27"), { recursive: true });
  mkdirSync(path.join(codexHome, "shell_snapshots"), { recursive: true });

  const firstRollout = path.join(
    codexHome,
    "sessions",
    "2026",
    "05",
    "27",
    "rollout-2026-05-27T10-00-00-thread-1.jsonl",
  );
  const secondRollout = path.join(
    codexHome,
    "sessions",
    "2026",
    "05",
    "27",
    "rollout-2026-05-27T11-00-00-thread-2.jsonl",
  );

  writeFileSync(firstRollout, JSON.stringify({ type: "session_meta" }) + "\n");
  writeFileSync(secondRollout, JSON.stringify({ type: "session_meta" }) + "\n");
  writeFileSync(path.join(codexHome, "shell_snapshots", "thread-1.1.sh"), "pwd\n");
  writeFileSync(
    path.join(codexHome, "session_index.jsonl"),
    [
      JSON.stringify({ id: "thread-1", thread_name: "Delete Me", updated_at: "2026-05-27T10:00:00Z" }),
      JSON.stringify({ id: "thread-2", thread_name: "Keep Me", updated_at: "2026-05-27T11:00:00Z" }),
      JSON.stringify({ id: "thread-3", thread_name: "Delete Me", updated_at: "2026-05-27T12:00:00Z" }),
    ].join("\n") + "\n",
  );
  writeFileSync(
    path.join(codexHome, ".codex-global-state.json"),
    JSON.stringify({
      "electron-persisted-atom-state": {
        "prompt-history": {
          "thread-1": ["delete this"],
        },
      },
      "projectless-thread-ids": ["thread-1", "thread-2"],
    }),
  );
  writeFileSync(path.join(codexHome, ".codex-global-state.json.bak"), "{}");

  createStateDb(path.join(codexHome, "state_5.sqlite"), firstRollout, secondRollout);
  createLogsDb(path.join(codexHome, "logs_2.sqlite"));
  createGoalsDb(path.join(codexHome, "goals_1.sqlite"));

  if (options.includeOrphans) {
    addOrphanData(codexHome);
  }

  return {
    root,
    codexHome,
    paths: resolvePaths(codexHome),
  };
}

function createStateDb(filePath: string, firstRollout: string, secondRollout: string): void {
  const db = new Database(filePath);
  try {
    db.exec(`
      create table threads (
        id text primary key,
        rollout_path text not null,
        created_at integer not null,
        updated_at integer not null,
        source text not null default '',
        model_provider text not null default '',
        cwd text not null,
        title text not null,
        sandbox_policy text not null default '',
        approval_mode text not null default '',
        tokens_used integer not null default 0,
        has_user_event integer not null default 0,
        archived integer not null default 0,
        archived_at integer,
        git_sha text,
        git_branch text,
        git_origin_url text,
        cli_version text not null default '',
        first_user_message text not null default '',
        agent_nickname text,
        agent_role text,
        memory_mode text not null default 'enabled',
        model text,
        reasoning_effort text,
        agent_path text,
        created_at_ms integer,
        updated_at_ms integer,
        thread_source text,
        preview text not null default ''
      );
      create table thread_dynamic_tools (
        thread_id text not null,
        position integer not null,
        name text not null,
        description text not null,
        input_schema text not null,
        primary key(thread_id, position)
      );
      create table stage1_outputs (
        thread_id text primary key,
        source_updated_at integer not null,
        raw_memory text not null,
        rollout_summary text not null,
        generated_at integer not null
      );
      create table thread_spawn_edges (
        parent_thread_id text not null,
        child_thread_id text not null primary key,
        status text not null
      );
      create table agent_job_items (
        job_id text not null,
        item_id text not null,
        row_index integer not null,
        row_json text not null,
        status text not null,
        assigned_thread_id text,
        primary key(job_id, item_id)
      );
    `);

    const insert = db.prepare(`
      insert into threads (id, rollout_path, created_at, updated_at, cwd, title, first_user_message, preview, updated_at_ms, created_at_ms)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run("thread-1", firstRollout, 1779860000, 1779861000, "/tmp/project-a", "Delete Me", "please delete", "delete preview", 1779861000000, 1779860000000);
    insert.run(
      "thread-2",
      secondRollout,
      1779862000,
      1779863000,
      "/tmp/project-b",
      "This is a very long raw prompt title that should be hidden behind the session index name",
      "keep this",
      "keep preview",
      1779863000000,
      1779862000000,
    );
    insert.run(
      "thread-3",
      secondRollout,
      1779864000,
      1779865000,
      "/tmp/project-c",
      "This is a very long raw prompt title that should not be shown when session index has a shorter name",
      "duplicate title",
      "duplicate preview",
      1779865000000,
      1779864000000,
    );

    db.prepare("insert into thread_dynamic_tools values (?, ?, ?, ?, ?)").run("thread-1", 0, "tool", "desc", "{}");
    db.prepare("insert into stage1_outputs values (?, ?, ?, ?, ?)").run("thread-1", 1, "memory", "summary", 1);
    db.prepare("insert into thread_spawn_edges values (?, ?, ?)").run("thread-1", "child-1", "done");
    db.prepare("insert into agent_job_items values (?, ?, ?, ?, ?, ?)").run("job-1", "item-1", 0, "{}", "done", "thread-1");
  } finally {
    db.close();
  }
}

function addOrphanData(codexHome: string): void {
  const missingRollout = path.join(
    codexHome,
    "sessions",
    "2026",
    "05",
    "27",
    "rollout-2026-05-27T12-30-00-thread-orphan.jsonl",
  );
  const missingArchivedRollout = path.join(
    codexHome,
    "archived_sessions",
    "2026",
    "05",
    "27",
    "rollout-2026-05-27T09-00-00-thread-archived-orphan.jsonl",
  );

  writeFileSync(
    path.join(codexHome, "session_index.jsonl"),
    [
      JSON.stringify({ id: "thread-1", thread_name: "Delete Me", updated_at: "2026-05-27T10:00:00Z" }),
      JSON.stringify({ id: "thread-2", thread_name: "Keep Me", updated_at: "2026-05-27T11:00:00Z" }),
      JSON.stringify({ id: "thread-3", thread_name: "Delete Me", updated_at: "2026-05-27T12:00:00Z" }),
      JSON.stringify({ id: "thread-orphan", thread_name: "Missing Rollout", updated_at: "2026-05-27T12:30:00Z" }),
      JSON.stringify({
        id: "thread-archived-orphan",
        thread_name: "Archived Missing Rollout",
        updated_at: "2026-05-27T09:00:00Z",
      }),
    ].join("\n") + "\n",
  );

  writeFileSync(
    path.join(codexHome, ".codex-global-state.json"),
    JSON.stringify({
      "electron-persisted-atom-state": {
        "prompt-history": {
          "thread-1": ["delete this"],
          "thread-orphan": ["missing rollout"],
          "thread-archived-orphan": ["archived missing rollout"],
        },
      },
      "projectless-thread-ids": ["thread-1", "thread-2", "thread-orphan", "thread-archived-orphan"],
    }),
  );
  writeFileSync(path.join(codexHome, "shell_snapshots", "thread-orphan.1.sh"), "pwd\n");

  const stateDb = new Database(path.join(codexHome, "state_5.sqlite"));
  try {
    const insert = stateDb.prepare(`
      insert into threads (id, rollout_path, created_at, updated_at, cwd, title, first_user_message, preview, updated_at_ms, created_at_ms, archived)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      "thread-orphan",
      missingRollout,
      1779866000,
      1779867000,
      "/tmp/project-orphan",
      "Missing Rollout",
      "missing rollout",
      "missing rollout preview",
      1779867000000,
      1779866000000,
      0,
    );
    insert.run(
      "thread-archived-orphan",
      missingArchivedRollout,
      1779858000,
      1779859000,
      "/tmp/project-archived-orphan",
      "Archived Missing Rollout",
      "archived missing rollout",
      "archived missing rollout preview",
      1779859000000,
      1779858000000,
      1,
    );
    stateDb.prepare("insert into thread_dynamic_tools values (?, ?, ?, ?, ?)").run("thread-orphan", 0, "tool", "desc", "{}");
    stateDb.prepare("insert into stage1_outputs values (?, ?, ?, ?, ?)").run("thread-orphan", 1, "memory", "summary", 1);
    stateDb.prepare("insert into thread_spawn_edges values (?, ?, ?)").run("thread-orphan", "thread-2", "done");
  } finally {
    stateDb.close();
  }

  const logsDb = new Database(path.join(codexHome, "logs_2.sqlite"));
  try {
    const insert = logsDb.prepare(
      "insert into logs (ts, ts_nanos, level, target, thread_id, estimated_bytes) values (?, ?, ?, ?, ?, ?)",
    );
    insert.run(2, 1, "INFO", "test", "thread-orphan", 4096);
    insert.run(3, 1, "INFO", "test", "thread-archived-orphan", 1024);
    insert.run(4, 1, "INFO", "test", "thread-logs-only", 2048);
  } finally {
    logsDb.close();
  }

  const goalsDb = new Database(path.join(codexHome, "goals_1.sqlite"));
  try {
    goalsDb
      .prepare("insert into thread_goals values (?, ?, ?, ?, ?, ?)")
      .run("thread-orphan", "goal-orphan", "objective", "active", 1, 1);
  } finally {
    goalsDb.close();
  }
}

function createLogsDb(filePath: string): void {
  const db = new Database(filePath);
  try {
    db.exec(`
      create table logs (
        id integer primary key autoincrement,
        ts integer not null,
        ts_nanos integer not null,
        level text not null,
        target text not null,
        thread_id text,
        estimated_bytes integer not null default 0
      );
    `);
    db.prepare("insert into logs (ts, ts_nanos, level, target, thread_id) values (?, ?, ?, ?, ?)").run(1, 1, "INFO", "test", "thread-1");
  } finally {
    db.close();
  }
}

function createGoalsDb(filePath: string): void {
  const db = new Database(filePath);
  try {
    db.exec(`
      create table thread_goals (
        thread_id text primary key not null,
        goal_id text not null,
        objective text not null,
        status text not null,
        created_at_ms integer not null,
        updated_at_ms integer not null
      );
    `);
    db.prepare("insert into thread_goals values (?, ?, ?, ?, ?, ?)").run("thread-1", "goal-1", "objective", "active", 1, 1);
  } finally {
    db.close();
  }
}
