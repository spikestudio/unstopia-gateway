import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateSessionsSchema } from "../../registry.js";
import { SqliteSessionRepository } from "../SqliteSessionRepository.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      engine TEXT NOT NULL,
      engine_session_id TEXT,
      source TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      connector TEXT,
      session_key TEXT,
      reply_context TEXT,
      message_id TEXT,
      transport_meta TEXT,
      employee TEXT,
      model TEXT,
      title TEXT,
      parent_session_id TEXT,
      effort_level TEXT,
      status TEXT DEFAULT 'idle',
      total_cost REAL DEFAULT 0,
      total_turns INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      last_activity TEXT NOT NULL,
      last_error TEXT,
      portal_name TEXT,
      prompt TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);
  migrateSessionsSchema(db);
  return db;
}

describe("SqliteSessionRepository", () => {
  let repo: SqliteSessionRepository;

  beforeEach(() => {
    const db = makeDb();
    repo = new SqliteSessionRepository(db);
  });

  describe("createSession — optional field branches", () => {
    it("stores messageId when provided (line 94 left-hand ?? branch)", () => {
      const session = repo.createSession({
        engine: "claude",
        source: "web",
        sourceRef: "web:msg",
        messageId: "msg-001",
      });
      expect(session.messageId).toBe("msg-001");
    });

    it("stores null for messageId when not provided (line 94 right-hand null branch)", () => {
      const session = repo.createSession({
        engine: "claude",
        source: "web",
        sourceRef: "web:nomsg",
        // messageId not set
      });
      expect(session.messageId).toBeNull();
    });
  });

  describe("listSessions — filter branches (lines 210-219, 229)", () => {
    beforeEach(() => {
      const s1 = repo.createSession({ engine: "claude", source: "slack", sourceRef: "sk:1" });
      repo.updateSession(s1.id, { status: "running" });

      const s2 = repo.createSession({ engine: "codex", source: "web", sourceRef: "sk:2" });
      repo.updateSession(s2.id, { status: "idle" });

      repo.createSession({ engine: "gemini", source: "discord", sourceRef: "sk:3" });
    });

    it("filters by status (line 211-213 branch)", () => {
      const running = repo.listSessions({ status: "running" });
      expect(running).toHaveLength(1);
      expect(running[0].status).toBe("running");
    });

    it("filters by source (line 214-217 branch)", () => {
      const webSessions = repo.listSessions({ source: "web" });
      expect(webSessions).toHaveLength(1);
      expect(webSessions[0].source).toBe("web");
    });

    it("filters by engine (line 218-221 branch)", () => {
      const geminiSessions = repo.listSessions({ engine: "gemini" });
      expect(geminiSessions).toHaveLength(1);
      expect(geminiSessions[0].engine).toBe("gemini");
    });

    it("returns all sessions when no filter provided (line 229 rowToSession branch)", () => {
      const all = repo.listSessions();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });

    it("filters by multiple criteria combined", () => {
      const result = repo.listSessions({ status: "running", source: "slack" });
      expect(result).toHaveLength(1);
    });
  });

  describe("findById and findByKey", () => {
    it("findById returns session when found", () => {
      const s = repo.createSession({ engine: "claude", source: "web", sourceRef: "sk:find" });
      const result = repo.findById(s.id);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value?.id).toBe(s.id);
    });

    it("findById returns null when not found", () => {
      const result = repo.findById("nonexistent");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBeNull();
    });

    it("findByKey returns session when sessionKey matches", () => {
      repo.createSession({ engine: "claude", source: "web", sourceRef: "sk:bykey", sessionKey: "sk:bykey" });
      const result = repo.findByKey("sk:bykey");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value?.sessionKey).toBe("sk:bykey");
    });
  });

  describe("save and update Result-based methods", () => {
    it("save creates a session and returns Ok<Session>", () => {
      const result = repo.save({
        engine: "claude",
        source: "web",
        sourceRef: "sk:save",
        engineSessionId: null,
        connector: null,
        sessionKey: "sk:save",
        replyContext: null,
        messageId: null,
        transportMeta: null,
        employee: null,
        model: null,
        title: null,
        parentSessionId: null,
        effortLevel: null,
        status: "idle",
        totalCost: 0,
        totalTurns: 0,
        lastError: null,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.source).toBe("web");
    });

    it("update returns Ok<Session|null> when session exists", () => {
      const s = repo.createSession({ engine: "claude", source: "web", sourceRef: "sk:update" });
      const result = repo.update(s.id, { status: "running" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value?.status).toBe("running");
    });
  });
});

