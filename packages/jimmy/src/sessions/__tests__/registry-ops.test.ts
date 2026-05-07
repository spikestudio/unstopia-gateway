/**
 * registry-ops.test.ts — tests for registry CRUD operations using an in-memory DB.
 *
 * The registry module uses a module-level `db` variable initialized lazily.
 * We mock SESSIONS_DB to ":memory:" and reset the module between each test
 * to get a fresh database for each test group.
 */
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Point SESSIONS_DB to an in-memory SQLite database
vi.mock("../../shared/paths.js", () => ({
  SESSIONS_DB: ":memory:",
  GATEWAY_HOME: path.join(os.tmpdir(), ".gateway-test"),
  CONFIG_PATH: path.join(os.tmpdir(), ".gateway-test", "config.yaml"),
  CRON_JOBS: path.join(os.tmpdir(), ".gateway-test", "cron", "jobs.json"),
  CRON_RUNS: path.join(os.tmpdir(), ".gateway-test", "cron", "runs"),
  ORG_DIR: path.join(os.tmpdir(), ".gateway-test", "org"),
  SKILLS_DIR: path.join(os.tmpdir(), ".gateway-test", "skills"),
  DOCS_DIR: path.join(os.tmpdir(), ".gateway-test", "docs"),
  LOGS_DIR: path.join(os.tmpdir(), ".gateway-test", "logs"),
  TMP_DIR: path.join(os.tmpdir(), ".gateway-test", "tmp"),
  MODELS_DIR: path.join(os.tmpdir(), ".gateway-test", "models"),
  STT_MODELS_DIR: path.join(os.tmpdir(), ".gateway-test", "models", "whisper"),
  PID_FILE: path.join(os.tmpdir(), ".gateway-test", "gateway.pid"),
  CLAUDE_SKILLS_DIR: path.join(os.tmpdir(), ".gateway-test", ".claude", "skills"),
  AGENTS_SKILLS_DIR: path.join(os.tmpdir(), ".gateway-test", ".agents", "skills"),
  TEMPLATE_DIR: path.join(os.tmpdir(), ".gateway-test", "template"),
  FILES_DIR: path.join(os.tmpdir(), ".gateway-test", "files"),
  MIGRATIONS_DIR: path.join(os.tmpdir(), ".gateway-test", "migrations"),
  TEMPLATE_MIGRATIONS_DIR: path.join(os.tmpdir(), ".gateway-test", "template", "migrations"),
  INSTANCES_REGISTRY: path.join(os.tmpdir(), ".gateway-test", "instances.json"),
}));

import type { Result } from "../../shared/result.js";
import {
  accumulateSessionCost,
  cancelAllPendingQueueItems,
  cancelQueueItem,
  createSession,
  deleteFile,
  deleteSession,
  deleteSessions,
  duplicateSession,
  enqueueQueueItem,
  getFile,
  getInterruptedSessions,
  getMessages,
  getQueueItems,
  getSession,
  getSessionBySessionKey,
  getSessionBySourceRef,
  initDb,
  insertFile,
  insertMessage,
  listAllPendingQueueItems,
  listFiles,
  listSessions,
  markQueueItemCompleted,
  markQueueItemRunning,
  recoverStaleQueueItems,
  recoverStaleSessions,
  updateSession,
} from "../registry.js";

/** テスト用ヘルパー: Result から値を取り出す。Err/null の場合は undefined を返す */
function unwrap<T, E>(result: Result<T | null, E>): T | undefined {
  return result.ok ? (result.value ?? undefined) : undefined;
}

describe("AC-E003-03: registry — initDb", () => {
  it("initializes the database and returns a Database instance", () => {
    const db = initDb();
    expect(db).toBeDefined();
    // Calling initDb again returns the same instance
    const db2 = initDb();
    expect(db2).toBe(db);
  });
});

describe("AC-E003-03: registry — createSession and getSession", () => {
  it("creates a session and retrieves it by ID", () => {
    const session = createSession({
      engine: "claude",
      source: "slack",
      sourceRef: "slack:C123",
    });

    expect(session.id).toBeDefined();
    expect(session.engine).toBe("claude");
    expect(session.source).toBe("slack");
    expect(session.status).toBe("idle");
    expect(session.totalCost).toBe(0);
    expect(session.totalTurns).toBe(0);

    const fetched = unwrap(getSession(session.id));
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(session.id);
    expect(fetched?.engine).toBe("claude");
  });

  it("returns undefined for a non-existent session ID", () => {
    expect(unwrap(getSession("nonexistent-id"))).toBeUndefined();
  });

  it("uses title when provided", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:sess1",
      title: "My Custom Title",
    });
    expect(session.title).toBe("My Custom Title");
  });

  it("generates a title from prompt when no title provided", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:sess2",
      prompt: "Help me with this task",
    });
    expect(session.title).toContain("Help me with this task");
  });

  it("stores employee and model when provided", () => {
    const session = createSession({
      engine: "claude",
      source: "slack",
      sourceRef: "slack:C999",
      employee: "alice",
      model: "opus",
    });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.employee).toBe("alice");
    expect(fetched?.model).toBe("opus");
  });

  it("stores parentSessionId when provided", () => {
    const parent = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:parent",
    });
    const child = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:child",
      parentSessionId: parent.id,
    });
    const fetched = unwrap(getSession(child.id));
    expect(fetched?.parentSessionId).toBe(parent.id);
  });

  it("stores replyContext as JSON and retrieves it", () => {
    const replyContext = { channel: "C123", thread: "T456" };
    const session = createSession({
      engine: "claude",
      source: "slack",
      sourceRef: "slack:C123",
      replyContext,
    });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.replyContext).toEqual(replyContext);
  });
});

describe("AC-E003-03: registry — getSessionBySessionKey and getSessionBySourceRef", () => {
  it("finds session by session key", () => {
    const session = createSession({
      engine: "claude",
      source: "slack",
      sourceRef: "slack:C-lookup",
    });
    const found = unwrap(getSessionBySessionKey("slack:C-lookup"));
    expect(found?.id).toBe(session.id);
  });

  it("returns undefined when session key not found", () => {
    expect(unwrap(getSessionBySessionKey("unknown-key"))).toBeUndefined();
  });

  it("getSessionBySourceRef delegates to getSessionBySessionKey", () => {
    const session = createSession({
      engine: "claude",
      source: "slack",
      sourceRef: "slack:C-sourceref",
    });
    const found = unwrap(getSessionBySourceRef("slack:C-sourceref"));
    expect(found?.id).toBe(session.id);
  });
});

describe("AC-E003-03: registry — updateSession", () => {
  it("updates session status", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:update1",
    });
    const updated = unwrap(updateSession(session.id, { status: "running" }));
    expect(updated?.status).toBe("running");
  });

  it("updates engineSessionId", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:update2",
    });
    updateSession(session.id, { engineSessionId: "claude-session-abc" });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.engineSessionId).toBe("claude-session-abc");
  });

  it("updates lastError", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:update3",
    });
    updateSession(session.id, { status: "error", lastError: "Something went wrong" });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.lastError).toBe("Something went wrong");
  });

  it("returns the session unchanged when no updates are provided", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:update4",
    });
    const result = unwrap(updateSession(session.id, {}));
    expect(result?.id).toBe(session.id);
    expect(result?.status).toBe("idle");
  });

  it("updates title", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:update5",
    });
    updateSession(session.id, { title: "New Title" });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.title).toBe("New Title");
  });

  it("clears engineSessionId when set to null", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:update6",
    });
    updateSession(session.id, { engineSessionId: "some-session" });
    updateSession(session.id, { engineSessionId: null });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.engineSessionId).toBeNull();
  });

  it("updates model", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:update7" });
    updateSession(session.id, { model: "haiku" });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.model).toBe("haiku");
  });

  it("updates replyContext to null", () => {
    const session = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:update8",
      replyContext: { channel: "C1" },
    });
    updateSession(session.id, { replyContext: null });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.replyContext).toBeNull();
  });

  it("updates messageId", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:update9" });
    updateSession(session.id, { messageId: "msg-001" });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.messageId).toBe("msg-001");
  });

  it("updates transportMeta", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:update10" });
    updateSession(session.id, { transportMeta: { key: "value" } });
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.transportMeta).toEqual({ key: "value" });
  });
});

describe("AC-E003-03: registry — listSessions", () => {
  it("lists all sessions", () => {
    const before = listSessions().length;
    createSession({ engine: "claude", source: "web", sourceRef: "web:list1" });
    createSession({ engine: "codex", source: "slack", sourceRef: "slack:list2" });
    const after = listSessions();
    expect(after.length).toBe(before + 2);
  });

  it("filters sessions by status", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:status-filter" });
    updateSession(session.id, { status: "running" });
    const running = listSessions({ status: "running" });
    expect(running.some((s) => s.id === session.id)).toBe(true);
    const idle = listSessions({ status: "idle" });
    expect(idle.some((s) => s.id === session.id)).toBe(false);
  });

  it("filters sessions by source", () => {
    createSession({ engine: "claude", source: "discord", sourceRef: "discord:source-filter" });
    const discord = listSessions({ source: "discord" });
    expect(discord.every((s) => s.source === "discord")).toBe(true);
  });

  it("filters sessions by engine", () => {
    createSession({ engine: "gemini", source: "web", sourceRef: "web:engine-filter" });
    const gemini = listSessions({ engine: "gemini" });
    expect(gemini.every((s) => s.engine === "gemini")).toBe(true);
  });
});

describe("AC-E003-03: registry — recoverStaleSessions and getInterruptedSessions", () => {
  it("marks running sessions as interrupted on recovery", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:stale" });
    updateSession(session.id, { status: "running" });

    const count = recoverStaleSessions();
    expect(count).toBeGreaterThanOrEqual(1);

    const fetched = unwrap(getSession(session.id));
    expect(fetched?.status).toBe("interrupted");
  });

  it("getInterruptedSessions returns sessions with engine_session_id that are interrupted", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:interrupted" });
    updateSession(session.id, { status: "running", engineSessionId: "claude-abc" });
    recoverStaleSessions();

    const interrupted = getInterruptedSessions();
    expect(interrupted.some((s) => s.id === session.id)).toBe(true);
  });
});

describe("AC-E003-03: registry — insertMessage and getMessages", () => {
  it("inserts a message for a session", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:msg" });
    expect(() => {
      insertMessage(session.id, "user", "Hello, world!");
    }).not.toThrow();
  });

  it("inserts messages with different roles", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:msg2" });
    expect(() => {
      insertMessage(session.id, "user", "User message");
      insertMessage(session.id, "assistant", "Assistant response");
      insertMessage(session.id, "notification", "System notification");
    }).not.toThrow();
  });

  it("getMessages returns messages for a session in order", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:msg3" });
    insertMessage(session.id, "user", "First");
    insertMessage(session.id, "assistant", "Second");
    const messages = getMessages(session.id);
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("First");
    expect(messages[1].role).toBe("assistant");
  });

  it("getMessages returns empty array for session with no messages", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:msg4" });
    expect(getMessages(session.id)).toEqual([]);
  });
});

describe("AC-E003-03: registry — deleteSession and deleteSessions", () => {
  it("deleteSession removes the session and returns true", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:del1" });
    const result = deleteSession(session.id);
    expect(result).toBe(true);
    expect(unwrap(getSession(session.id))).toBeUndefined();
  });

  it("deleteSession also removes associated messages", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:del2" });
    insertMessage(session.id, "user", "A message");
    deleteSession(session.id);
    expect(getMessages(session.id)).toEqual([]);
  });

  it("deleteSession returns false for non-existent session", () => {
    expect(deleteSession("nonexistent-id")).toBe(false);
  });

  it("deleteSessions removes multiple sessions", () => {
    const s1 = createSession({ engine: "claude", source: "web", sourceRef: "web:bulk1" });
    const s2 = createSession({ engine: "claude", source: "web", sourceRef: "web:bulk2" });
    const count = deleteSessions([s1.id, s2.id]);
    expect(count).toBe(2);
    expect(unwrap(getSession(s1.id))).toBeUndefined();
    expect(unwrap(getSession(s2.id))).toBeUndefined();
  });

  it("deleteSessions returns 0 for empty array", () => {
    expect(deleteSessions([])).toBe(0);
  });
});

describe("AC-E003-03: registry — accumulateSessionCost", () => {
  it("adds cost and turns to a session", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:cost1" });
    accumulateSessionCost(session.id, 0.05, 3);
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.totalCost).toBeCloseTo(0.05);
    expect(fetched?.totalTurns).toBe(3);
  });

  it("accumulates cost across multiple calls", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:cost2" });
    accumulateSessionCost(session.id, 0.01, 1);
    accumulateSessionCost(session.id, 0.02, 2);
    const fetched = unwrap(getSession(session.id));
    expect(fetched?.totalCost).toBeCloseTo(0.03);
    expect(fetched?.totalTurns).toBe(3);
  });
});

describe("AC-E003-03: registry — duplicateSession", () => {
  it("duplicates a session with an engine session ID", () => {
    const original = createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:dup1",
      employee: "alice",
    });
    updateSession(original.id, { engineSessionId: "claude-session-dup" });
    insertMessage(original.id, "user", "Hello");
    insertMessage(original.id, "assistant", "World");

    const { session, messageCount } = duplicateSession(original.id, "Duplicate");
    expect(session.id).not.toBe(original.id);
    expect(session.engine).toBe("claude");
    expect(session.title).toBe("Duplicate");
    expect(messageCount).toBe(2);
    expect(session.engineSessionId).toBeNull(); // Duplication resets engineSessionId
  });

  it("throws when source session not found", () => {
    expect(() => duplicateSession("nonexistent-id")).toThrow("not found");
  });

  it("throws when source session has no engine session ID", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:dup2" });
    expect(() => duplicateSession(session.id)).toThrow("has no engine session ID");
  });
});

describe("AC-E003-03: registry — queue operations", () => {
  it("enqueueQueueItem creates a pending queue item", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:queue1" });
    const id = enqueueQueueItem(session.id, "web:queue1", "Do something");
    expect(id).toBeDefined();
    const items = getQueueItems("web:queue1");
    expect(items.length).toBe(1);
    expect(items[0].status).toBe("pending");
    expect(items[0].prompt).toBe("Do something");
  });

  it("multiple enqueues create sequential positions", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:queue2" });
    enqueueQueueItem(session.id, "web:queue2", "First");
    enqueueQueueItem(session.id, "web:queue2", "Second");
    const items = getQueueItems("web:queue2");
    expect(items.length).toBe(2);
    expect(items[0].position).toBeLessThan(items[1].position);
  });

  it("markQueueItemRunning sets status to running", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:queue3" });
    const id = enqueueQueueItem(session.id, "web:queue3", "Work");
    markQueueItemRunning(id);
    const items = getQueueItems("web:queue3");
    expect(items[0].status).toBe("running");
    expect(items[0].startedAt).not.toBeNull();
  });

  it("markQueueItemCompleted sets status to completed", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:queue4" });
    const id = enqueueQueueItem(session.id, "web:queue4", "Work");
    markQueueItemRunning(id);
    markQueueItemCompleted(id);
    // Completed items are not returned by getQueueItems (only pending/running)
    expect(getQueueItems("web:queue4")).toHaveLength(0);
  });

  it("cancelQueueItem cancels a pending item", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:queue5" });
    const id = enqueueQueueItem(session.id, "web:queue5", "Cancelable");
    const cancelled = cancelQueueItem(id);
    expect(cancelled).toBe(true);
    expect(getQueueItems("web:queue5")).toHaveLength(0);
  });

  it("cancelQueueItem returns false for non-existent item", () => {
    expect(cancelQueueItem("nonexistent")).toBe(false);
  });

  it("cancelAllPendingQueueItems cancels all pending items for a session key", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:queue6" });
    enqueueQueueItem(session.id, "web:queue6", "First");
    enqueueQueueItem(session.id, "web:queue6", "Second");
    const count = cancelAllPendingQueueItems("web:queue6");
    expect(count).toBe(2);
    expect(getQueueItems("web:queue6")).toHaveLength(0);
  });

  it("recoverStaleQueueItems resets running items to pending", () => {
    const session = createSession({ engine: "claude", source: "web", sourceRef: "web:queue7" });
    const id = enqueueQueueItem(session.id, "web:queue7", "Running work");
    markQueueItemRunning(id);
    const recovered = recoverStaleQueueItems();
    expect(recovered).toBeGreaterThanOrEqual(1);
    const items = getQueueItems("web:queue7");
    expect(items[0].status).toBe("pending");
    expect(items[0].startedAt).toBeNull();
  });

  it("listAllPendingQueueItems returns all pending items across sessions", () => {
    const s1 = createSession({ engine: "claude", source: "web", sourceRef: "web:pend1" });
    const s2 = createSession({ engine: "claude", source: "web", sourceRef: "web:pend2" });
    enqueueQueueItem(s1.id, "web:pend1", "Task 1");
    enqueueQueueItem(s2.id, "web:pend2", "Task 2");
    const all = listAllPendingQueueItems();
    const ourItems = all.filter((i) => i.sessionKey === "web:pend1" || i.sessionKey === "web:pend2");
    expect(ourItems.length).toBe(2);
  });
});

describe("AC-E003-03: registry — file management", () => {
  it("insertFile stores a file and getFile retrieves it", () => {
    const meta = {
      id: "file-001",
      filename: "test.png",
      size: 1024,
      mimetype: "image/png",
      path: "/tmp/test.png",
    };
    const stored = insertFile(meta);
    expect(stored.id).toBe("file-001");
    expect(stored.filename).toBe("test.png");

    const fetched = getFile("file-001");
    expect(fetched).toBeDefined();
    expect(fetched?.filename).toBe("test.png");
    expect(fetched?.size).toBe(1024);
    expect(fetched?.mimetype).toBe("image/png");
  });

  it("getFile returns undefined for non-existent ID", () => {
    expect(getFile("nonexistent-file")).toBeUndefined();
  });

  it("listFiles returns stored files", () => {
    const before = listFiles().length;
    insertFile({
      id: "file-list-001",
      filename: "list-test.txt",
      size: 512,
      mimetype: "text/plain",
      path: null,
    });
    const after = listFiles();
    expect(after.length).toBe(before + 1);
  });

  it("deleteFile removes the file and returns true", () => {
    insertFile({
      id: "file-del-001",
      filename: "delete-me.txt",
      size: 256,
      mimetype: null,
      path: null,
    });
    expect(deleteFile("file-del-001")).toBe(true);
    expect(getFile("file-del-001")).toBeUndefined();
  });

  it("deleteFile returns false for non-existent file", () => {
    expect(deleteFile("nonexistent-file")).toBe(false);
  });

  it("stores null mimetype and path correctly", () => {
    const stored = insertFile({
      id: "file-null-001",
      filename: "no-mime.bin",
      size: 100,
      mimetype: null,
      path: null,
    });
    expect(stored.mimetype).toBeNull();
    expect(stored.path).toBeNull();
    const fetched = getFile("file-null-001");
    expect(fetched?.mimetype).toBeNull();
    expect(fetched?.path).toBeNull();
  });
});
