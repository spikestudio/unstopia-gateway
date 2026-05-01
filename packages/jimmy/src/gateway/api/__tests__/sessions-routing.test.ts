import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../../types.js";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../../sessions/registry.js", () => ({
  listSessions: vi.fn().mockReturnValue([]),
  createSession: vi.fn().mockReturnValue({
    id: "s1",
    engine: "claude",
    source: "web",
    sourceRef: "web:1",
    connector: "web",
    status: "idle",
    sessionKey: "sk1",
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  }),
  getSession: vi.fn().mockReturnValue({ ok: true, value: null }),
  deleteSessions: vi.fn().mockReturnValue(1),
  insertMessage: vi.fn(),
  updateSession: vi.fn().mockReturnValue({ ok: true, value: null }),
  enqueueQueueItem: vi.fn().mockReturnValue("qi1"),
  getInterruptedSessions: vi.fn().mockReturnValue([]),
}));
vi.mock("../../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../shared/types.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/types.js")>();
  return {
    ...actual,
    isInterruptibleEngine: vi.fn().mockReturnValue(false),
  };
});
vi.mock("../session-crud.js", () => ({
  defaultCrudDeps: {},
  getSessionHandler: vi.fn().mockResolvedValue(undefined),
  updateSessionHandler: vi.fn().mockResolvedValue(undefined),
  deleteSessionHandler: vi.fn(),
  stopSession: vi.fn(),
  resetSession: vi.fn(),
  duplicateSessionHandler: vi.fn().mockResolvedValue(undefined),
  getChildren: vi.fn(),
  getTranscript: vi.fn(),
}));
vi.mock("../session-message.js", () => ({
  basePostMessageDeps: {},
  handlePostMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../session-queue-handlers.js", () => ({
  defaultQueueHandlerDeps: {},
  handleGetQueue: vi.fn(),
  handleClearQueue: vi.fn(),
  handlePauseQueue: vi.fn(),
  handleResumeQueue: vi.fn(),
  handleCancelQueueItem: vi.fn(),
}));
vi.mock("../session-runner.js", () => ({
  dispatchWebSessionRun: vi.fn(),
}));
vi.mock("../session-resume.js", () => ({
  resumePendingWebQueueItemsImpl: vi.fn(),
}));
vi.mock("../utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils.js")>();
  return {
    ...actual,
    resolveAttachmentPaths: vi.fn().mockReturnValue([]),
  };
});

import { handleSessionsRequest } from "../sessions.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const makeRes = (): ServerResponse =>
  ({
    writeHead: vi.fn(),
    end: vi.fn(),
  }) as unknown as ServerResponse;

const makeReq = (bodyObj: unknown = {}): never => {
  const bodyStr = JSON.stringify(bodyObj);
  return {
    headers: { "content-type": "application/json" },
    on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
      if (event === "data") cb(Buffer.from(bodyStr));
      if (event === "end") cb();
    }),
  } as never;
};

const makeQueue = () => ({
  getPendingCount: vi.fn().mockReturnValue(0),
  getTransportState: vi.fn().mockReturnValue("idle"),
  clearQueue: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
});

const makeEngine = () => ({
  isAlive: vi.fn().mockReturnValue(false),
  kill: vi.fn(),
  run: vi.fn(),
});

const makeContext = (): ApiContext => ({
  config: {} as never,
  getConfig: vi.fn().mockReturnValue({
    engines: { default: "claude" },
    portal: { portalName: "TestPortal" },
  }),
  emit: vi.fn(),
  startTime: Date.now(),
  connectors: new Map(),
  sessionManager: {
    getEngine: vi.fn().mockReturnValue(null),
    getQueue: vi.fn().mockReturnValue(makeQueue()),
  } as never,
});

const getResponseBody = (res: ServerResponse): unknown => {
  const endMock = res.end as ReturnType<typeof vi.fn>;
  return JSON.parse(endMock.mock.calls[0][0]);
};

const getStatusCode = (res: ServerResponse): number => {
  const writeHeadMock = res.writeHead as ReturnType<typeof vi.fn>;
  return writeHeadMock.mock.calls[0][0];
};

// ── GET /api/sessions ──────────────────────────────────────────────────────

describe("GET /api/sessions", () => {
  it("returns empty array when no sessions", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/sessions",
      new URL("http://localhost/api/sessions"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res);
    expect(body).toEqual([]);
  });

  it("returns serialized sessions list", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([
      {
        id: "s1",
        engine: "claude",
        source: "web",
        sourceRef: "web:1",
        connector: "web",
        status: "idle",
        sessionKey: "sk1",
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      } as never,
    ]);
    const context = makeContext();
    const res = makeRes();
    await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/sessions",
      new URL("http://localhost/api/sessions"),
    );
    const body = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("s1");
  });
});

// ── GET /api/sessions/interrupted ─────────────────────────────────────────

describe("GET /api/sessions/interrupted", () => {
  it("returns interrupted sessions", async () => {
    const { getInterruptedSessions } = await import("../../../sessions/registry.js");
    vi.mocked(getInterruptedSessions).mockReturnValue([]);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/sessions/interrupted",
      new URL("http://localhost/api/sessions/interrupted"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res);
    expect(body).toEqual([]);
  });

  it("serializes interrupted sessions with queue info", async () => {
    const { getInterruptedSessions } = await import("../../../sessions/registry.js");
    vi.mocked(getInterruptedSessions).mockReturnValue([
      {
        id: "interrupted-1",
        engine: "claude",
        source: "web",
        sourceRef: "web:1",
        connector: "web",
        status: "idle",
        sessionKey: "sk1",
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      } as never,
    ]);
    const context = makeContext();
    const res = makeRes();
    await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/sessions/interrupted",
      new URL("http://localhost/api/sessions/interrupted"),
    );
    const body = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("interrupted-1");
  });
});

// ── POST /api/sessions/bulk-delete ────────────────────────────────────────

describe("POST /api/sessions/bulk-delete", () => {
  it("returns 400 when ids array is empty", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ ids: [] });
    const handled = await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/bulk-delete",
      new URL("http://localhost/api/sessions/bulk-delete"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(400);
  });

  it("returns 400 when ids is not an array", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ ids: "s1" });
    await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/bulk-delete",
      new URL("http://localhost/api/sessions/bulk-delete"),
    );
    expect(getStatusCode(res)).toBe(400);
  });

  it("deletes sessions and returns count", async () => {
    const { deleteSessions, getSession } = await import("../../../sessions/registry.js");
    vi.mocked(getSession).mockReturnValue({ ok: true, value: null });
    vi.mocked(deleteSessions).mockReturnValue(2);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ ids: ["s1", "s2"] });
    const handled = await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/bulk-delete",
      new URL("http://localhost/api/sessions/bulk-delete"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("deleted");
    expect(body.count).toBe(2);
  });

  it("kills engine process before deleting if session is alive", async () => {
    const { getSession, deleteSessions } = await import("../../../sessions/registry.js");
    const { isInterruptibleEngine } = await import("../../../shared/types.js");
    const session = {
      id: "s1",
      engine: "claude",
      source: "web",
      sourceRef: "web:1",
      connector: "web",
      status: "running",
      sessionKey: "sk1",
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    vi.mocked(getSession).mockReturnValue({ ok: true, value: session as never });
    vi.mocked(deleteSessions).mockReturnValue(1);
    vi.mocked(isInterruptibleEngine).mockReturnValue(true);
    const engine = makeEngine();
    vi.mocked(engine.isAlive).mockReturnValue(true);
    const context = makeContext();
    vi.mocked(context.sessionManager.getEngine as ReturnType<typeof vi.fn>).mockReturnValue(engine);
    const res = makeRes();
    const req = makeReq({ ids: ["s1"] });
    await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/bulk-delete",
      new URL("http://localhost/api/sessions/bulk-delete"),
    );
    expect(engine.kill).toHaveBeenCalledWith("s1");
  });
});

// ── POST /api/sessions/stub ────────────────────────────────────────────────

describe("POST /api/sessions/stub", () => {
  it("creates stub session with default greeting", async () => {
    const { createSession, insertMessage } = await import("../../../sessions/registry.js");
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({});
    const handled = await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/stub",
      new URL("http://localhost/api/sessions/stub"),
    );
    expect(handled).toBe(true);
    expect(createSession).toHaveBeenCalled();
    expect(insertMessage).toHaveBeenCalledWith("s1", "assistant", expect.stringContaining("Say hi"));
    expect(getStatusCode(res)).toBe(201);
  });

  it("uses custom greeting when provided", async () => {
    const { insertMessage } = await import("../../../sessions/registry.js");
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ greeting: "Custom greeting!" });
    await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/stub",
      new URL("http://localhost/api/sessions/stub"),
    );
    expect(insertMessage).toHaveBeenCalledWith("s1", "assistant", "Custom greeting!");
  });

  it("uses provided engine from body", async () => {
    const { createSession } = await import("../../../sessions/registry.js");
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ engine: "codex" });
    await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/stub",
      new URL("http://localhost/api/sessions/stub"),
    );
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ engine: "codex" }));
  });
});

// ── POST /api/sessions ─────────────────────────────────────────────────────

describe("POST /api/sessions", () => {
  it("returns 400 when prompt/message is missing", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({});
    const handled = await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions",
      new URL("http://localhost/api/sessions"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(400);
  });

  it("creates session with message field as fallback for prompt", async () => {
    const { createSession } = await import("../../../sessions/registry.js");
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ message: "Hello via message field" });
    await handleSessionsRequest(req, res, context, "POST", "/api/sessions", new URL("http://localhost/api/sessions"));
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ prompt: "Hello via message field" }));
  });

  it("returns 201 with error status when engine not found", async () => {
    const context = makeContext();
    vi.mocked(context.sessionManager.getEngine as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const res = makeRes();
    const req = makeReq({ prompt: "Hello" });
    const handled = await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions",
      new URL("http://localhost/api/sessions"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(201);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("error");
  });

  it("creates session and dispatches run when engine found", async () => {
    const { dispatchWebSessionRun } = await import("../session-runner.js");
    const { updateSession } = await import("../../../sessions/registry.js");
    vi.mocked(updateSession).mockReturnValue({
      ok: true,
      value: {
        id: "s1",
        engine: "claude",
        source: "web",
        sourceRef: "web:1",
        connector: "web",
        status: "running",
        sessionKey: "sk1",
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      } as never,
    });
    const engine = makeEngine();
    const context = makeContext();
    vi.mocked(context.sessionManager.getEngine as ReturnType<typeof vi.fn>).mockReturnValue(engine);
    const res = makeRes();
    const req = makeReq({ prompt: "Do some work" });
    await handleSessionsRequest(req, res, context, "POST", "/api/sessions", new URL("http://localhost/api/sessions"));
    expect(dispatchWebSessionRun).toHaveBeenCalled();
    expect(getStatusCode(res)).toBe(201);
  });

  it("falls back to session object when updateSession returns no value", async () => {
    const { updateSession } = await import("../../../sessions/registry.js");
    vi.mocked(updateSession).mockReturnValue({ ok: false } as never);
    const engine = makeEngine();
    const context = makeContext();
    vi.mocked(context.sessionManager.getEngine as ReturnType<typeof vi.fn>).mockReturnValue(engine);
    const res = makeRes();
    const req = makeReq({ prompt: "Hello" });
    await handleSessionsRequest(req, res, context, "POST", "/api/sessions", new URL("http://localhost/api/sessions"));
    expect(getStatusCode(res)).toBe(201);
  });
});

// ── GET /api/sessions/:id ──────────────────────────────────────────────────

describe("GET /api/sessions/:id", () => {
  it("delegates to getSessionHandler", async () => {
    const { getSessionHandler } = await import("../session-crud.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/sessions/s1",
      new URL("http://localhost/api/sessions/s1"),
    );
    expect(handled).toBe(true);
    expect(getSessionHandler).toHaveBeenCalledWith(
      expect.anything(),
      res,
      context,
      expect.anything(),
      "s1",
      expect.anything(),
    );
  });
});

// ── PUT /api/sessions/:id ──────────────────────────────────────────────────

describe("PUT /api/sessions/:id", () => {
  it("delegates to updateSessionHandler", async () => {
    const { updateSessionHandler } = await import("../session-crud.js");
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ title: "Updated" });
    const handled = await handleSessionsRequest(
      req,
      res,
      context,
      "PUT",
      "/api/sessions/s1",
      new URL("http://localhost/api/sessions/s1"),
    );
    expect(handled).toBe(true);
    expect(updateSessionHandler).toHaveBeenCalledWith(expect.anything(), res, context, expect.anything(), "s1");
  });
});

// ── DELETE /api/sessions/:id ───────────────────────────────────────────────

describe("DELETE /api/sessions/:id", () => {
  it("delegates to deleteSessionHandler", async () => {
    const { deleteSessionHandler } = await import("../session-crud.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "DELETE",
      "/api/sessions/s1",
      new URL("http://localhost/api/sessions/s1"),
    );
    expect(handled).toBe(true);
    expect(deleteSessionHandler).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── POST /api/sessions/:id/stop ────────────────────────────────────────────

describe("POST /api/sessions/:id/stop", () => {
  it("delegates to stopSession", async () => {
    const { stopSession } = await import("../session-crud.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "POST",
      "/api/sessions/s1/stop",
      new URL("http://localhost/api/sessions/s1/stop"),
    );
    expect(handled).toBe(true);
    expect(stopSession).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── POST /api/sessions/:id/reset ───────────────────────────────────────────

describe("POST /api/sessions/:id/reset", () => {
  it("delegates to resetSession", async () => {
    const { resetSession } = await import("../session-crud.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "POST",
      "/api/sessions/s1/reset",
      new URL("http://localhost/api/sessions/s1/reset"),
    );
    expect(handled).toBe(true);
    expect(resetSession).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── POST /api/sessions/:id/duplicate ──────────────────────────────────────

describe("POST /api/sessions/:id/duplicate", () => {
  it("delegates to duplicateSessionHandler", async () => {
    const { duplicateSessionHandler } = await import("../session-crud.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "POST",
      "/api/sessions/s1/duplicate",
      new URL("http://localhost/api/sessions/s1/duplicate"),
    );
    expect(handled).toBe(true);
    expect(duplicateSessionHandler).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── DELETE /api/sessions/:id/queue/:itemId ─────────────────────────────────

describe("DELETE /api/sessions/:id/queue/:itemId", () => {
  it("delegates to handleCancelQueueItem", async () => {
    const { handleCancelQueueItem } = await import("../session-queue-handlers.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "DELETE",
      "/api/sessions/s1/queue/qi1",
      new URL("http://localhost/api/sessions/s1/queue/qi1"),
    );
    expect(handled).toBe(true);
    expect(handleCancelQueueItem).toHaveBeenCalledWith(res, context, expect.anything(), "s1", "qi1");
  });
});

// ── GET /api/sessions/:id/queue ────────────────────────────────────────────

describe("GET /api/sessions/:id/queue", () => {
  it("delegates to handleGetQueue", async () => {
    const { handleGetQueue } = await import("../session-queue-handlers.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/sessions/s1/queue",
      new URL("http://localhost/api/sessions/s1/queue"),
    );
    expect(handled).toBe(true);
    expect(handleGetQueue).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── DELETE /api/sessions/:id/queue ─────────────────────────────────────────

describe("DELETE /api/sessions/:id/queue", () => {
  it("delegates to handleClearQueue", async () => {
    const { handleClearQueue } = await import("../session-queue-handlers.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "DELETE",
      "/api/sessions/s1/queue",
      new URL("http://localhost/api/sessions/s1/queue"),
    );
    expect(handled).toBe(true);
    expect(handleClearQueue).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── POST /api/sessions/:id/queue/pause ────────────────────────────────────

describe("POST /api/sessions/:id/queue/pause", () => {
  it("delegates to handlePauseQueue", async () => {
    const { handlePauseQueue } = await import("../session-queue-handlers.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "POST",
      "/api/sessions/s1/queue/pause",
      new URL("http://localhost/api/sessions/s1/queue/pause"),
    );
    expect(handled).toBe(true);
    expect(handlePauseQueue).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── POST /api/sessions/:id/queue/resume ───────────────────────────────────

describe("POST /api/sessions/:id/queue/resume", () => {
  it("delegates to handleResumeQueue", async () => {
    const { handleResumeQueue } = await import("../session-queue-handlers.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "POST",
      "/api/sessions/s1/queue/resume",
      new URL("http://localhost/api/sessions/s1/queue/resume"),
    );
    expect(handled).toBe(true);
    expect(handleResumeQueue).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── GET /api/sessions/:id/children ────────────────────────────────────────

describe("GET /api/sessions/:id/children", () => {
  it("delegates to getChildren", async () => {
    const { getChildren } = await import("../session-crud.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/sessions/s1/children",
      new URL("http://localhost/api/sessions/s1/children"),
    );
    expect(handled).toBe(true);
    expect(getChildren).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── GET /api/sessions/:id/transcript ──────────────────────────────────────

describe("GET /api/sessions/:id/transcript", () => {
  it("delegates to getTranscript", async () => {
    const { getTranscript } = await import("../session-crud.js");
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/sessions/s1/transcript",
      new URL("http://localhost/api/sessions/s1/transcript"),
    );
    expect(handled).toBe(true);
    expect(getTranscript).toHaveBeenCalledWith(res, context, expect.anything(), "s1");
  });
});

// ── POST /api/sessions/:id/message ────────────────────────────────────────

describe("POST /api/sessions/:id/message", () => {
  it("delegates to handlePostMessage", async () => {
    const { handlePostMessage } = await import("../session-message.js");
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ message: "New message" });
    const handled = await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/s1/message",
      new URL("http://localhost/api/sessions/s1/message"),
    );
    expect(handled).toBe(true);
    expect(handlePostMessage).toHaveBeenCalledWith(
      expect.anything(),
      res,
      context,
      expect.objectContaining({ getEngine: expect.any(Function), getConfig: expect.any(Function) }),
      "s1",
    );
  });

  it("deps.getEngine delegates to sessionManager.getEngine", async () => {
    const { handlePostMessage } = await import("../session-message.js");
    const context = makeContext();
    const engine = { run: vi.fn(), kill: vi.fn(), isAlive: vi.fn() };
    vi.mocked(context.sessionManager.getEngine as ReturnType<typeof vi.fn>).mockReturnValue(engine);
    let capturedGetEngine: ((name: string) => unknown) | null = null;
    let capturedGetConfig: (() => unknown) | null = null;
    vi.mocked(handlePostMessage).mockImplementation(async (_req, _res, _ctx, deps) => {
      // Capture the function references to call them and cover lines 306-307
      const d = deps as unknown as { getEngine: (name: string) => unknown; getConfig: () => unknown };
      capturedGetEngine = d.getEngine;
      capturedGetConfig = d.getConfig;
    });
    const res = makeRes();
    const req = makeReq({ message: "test" });
    await handleSessionsRequest(
      req,
      res,
      context,
      "POST",
      "/api/sessions/s1/message",
      new URL("http://localhost/api/sessions/s1/message"),
    );
    // Call the captured functions to cover the arrow function lines
    expect(capturedGetEngine).not.toBeNull();
    expect((capturedGetEngine as unknown as (name: string) => unknown)("claude")).toBe(engine);
    expect((capturedGetConfig as unknown as () => unknown)()).toBeDefined();
  });
});

// ── Unmatched routes ───────────────────────────────────────────────────────

describe("unmatched routes", () => {
  it("returns false for unknown route", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleSessionsRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/unknown",
      new URL("http://localhost/api/unknown"),
    );
    expect(handled).toBe(false);
  });
});

// ── POST /api/sessions — readJsonBody failure (line 139 branch) ──────────────

describe("POST /api/sessions — readJsonBody failure (line 139)", () => {
  it("returns 400 when body parse fails", async () => {
    const context = makeContext();
    const res = makeRes();
    const badReq = {
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
        if (event === "data") cb(Buffer.from("not-valid-json"));
        if (event === "end") cb();
      }),
    } as never;
    const handled = await handleSessionsRequest(
      badReq,
      res,
      context,
      "POST",
      "/api/sessions",
      new URL("http://localhost/api/sessions"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(400);
  });
});
