import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types.js";
import type { ApiContext } from "../../types.js";
import type { CrudDeps } from "../session-crud.js";
import { loadTranscriptMessages } from "../session-runner.js";

vi.mock("../session-runner.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../session-runner.js")>();
  return {
    ...actual,
    loadTranscriptMessages: vi.fn().mockReturnValue([{ role: "user", content: "backfilled message" }]),
    loadRawTranscript: vi.fn().mockReturnValue([]),
  };
});

import {
  deleteSessionHandler,
  duplicateSessionHandler,
  getChildren,
  getSessionHandler,
  getTranscript,
  resetSession,
  stopSession,
  updateSessionHandler,
} from "../session-crud.js";

const makeSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    engine: "claude",
    source: "web",
    sourceRef: "web:1",
    connector: "web",
    status: "idle",
    sessionKey: "sk1",
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ...overrides,
  }) as Session;

const makeDeps = (overrides: Partial<CrudDeps> = {}): CrudDeps => ({
  getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession() }),
  updateSession: vi.fn().mockReturnValue({ ok: true, value: makeSession() }),
  deleteSession: vi.fn().mockReturnValue(true),
  insertMessage: vi.fn(),
  getMessages: vi.fn().mockReturnValue([]),
  listSessions: vi.fn().mockReturnValue([]),
  duplicateSession: vi.fn(),
  forkEngineSession: vi.fn().mockReturnValue({ engineSessionId: "forked-e1" }),
  ...overrides,
});

const makeEngine = () => ({
  isAlive: vi.fn().mockReturnValue(false),
  kill: vi.fn(),
  killAll: vi.fn(),
  run: vi.fn(),
});

const makeQueue = () => ({
  clearQueue: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
  getPendingCount: vi.fn().mockReturnValue(0),
  getTransportState: vi.fn().mockReturnValue(null),
});

const makeContext = (): ApiContext =>
  ({
    emit: vi.fn(),
    sessionManager: {
      getEngine: vi.fn().mockReturnValue(null),
      getQueue: vi.fn().mockReturnValue(makeQueue()),
    },
  }) as unknown as ApiContext;

const makeRes = (): ServerResponse =>
  ({
    writeHead: vi.fn(),
    end: vi.fn(),
  }) as unknown as ServerResponse;

const makeUrl = (search = ""): URL => new URL(`http://localhost/api/sessions/s1${search}`);

// ── getSessionHandler ─────────────────────────────────────────────────────────

describe("getSessionHandler", () => {
  it("should return 404 when session not found", async () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should return session with messages", async () => {
    const deps = makeDeps({ getMessages: vi.fn().mockReturnValue([{ role: "user", content: "hi" }]) });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });

  it("should apply last=N filter when specified", async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: "user",
      content: `msg${i}`,
      id: `${i}`,
      timestamp: Date.now(),
      sessionId: "s1",
    }));
    const deps = makeDeps({ getMessages: vi.fn().mockReturnValue(messages) });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl("?last=3"));
    const body = JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(body.messages).toHaveLength(3);
  });
});

// ── updateSessionHandler ──────────────────────────────────────────────────────

describe("updateSessionHandler", () => {
  it("should return 404 when session not found", async () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    const req = {
      headers: {},
      on: vi.fn().mockImplementation((e, cb) => {
        if (e === "data") {
        }
        if (e === "end") cb();
      }),
    } as never;
    await updateSessionHandler(req, res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should return 400 when title is not a string", async () => {
    const deps = makeDeps();
    const res = makeRes();
    const req = {
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((e: string, cb: (d?: Buffer) => void) => {
        if (e === "data") cb(Buffer.from(JSON.stringify({ title: 123 })));
        if (e === "end") cb();
      }),
    } as never;
    await updateSessionHandler(req, res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  });

  it("should return 400 when title is empty string", async () => {
    const deps = makeDeps();
    const res = makeRes();
    const req = {
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((e: string, cb: (d?: Buffer) => void) => {
        if (e === "data") cb(Buffer.from(JSON.stringify({ title: "   " })));
        if (e === "end") cb();
      }),
    } as never;
    await updateSessionHandler(req, res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  });
});

// ── deleteSessionHandler ──────────────────────────────────────────────────────

describe("deleteSessionHandler", () => {
  it("should return 404 when session not found (AC-E026-21)", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    deleteSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should call deleteSession when session exists", () => {
    const deps = makeDeps();
    const res = makeRes();
    deleteSessionHandler(res, makeContext(), deps, "s1");
    expect(deps.deleteSession).toHaveBeenCalledWith("s1");
  });

  it("should emit session:deleted event on success", () => {
    const context = makeContext();
    deleteSessionHandler(makeRes(), context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("session:deleted", { sessionId: "s1" });
  });

  it("should return 404 when deleteSession returns falsy", () => {
    const deps = makeDeps({ deleteSession: vi.fn().mockReturnValue(false) });
    const res = makeRes();
    deleteSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should kill live engine process before deleting", () => {
    const engine = makeEngine();
    engine.isAlive.mockReturnValue(true);
    const context = {
      emit: vi.fn(),
      sessionManager: {
        getEngine: vi.fn().mockReturnValue(engine),
        getQueue: vi.fn().mockReturnValue(makeQueue()),
      },
    } as unknown as ApiContext;
    deleteSessionHandler(makeRes(), context, makeDeps(), "s1");
    expect(engine.kill).toHaveBeenCalledWith("s1");
  });
});

// ── updateSessionHandler success ──────────────────────────────────────────────

describe("updateSessionHandler success", () => {
  const makeBodyReq = (body: object) =>
    ({
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((e: string, cb: (d?: Buffer) => void) => {
        if (e === "data") cb(Buffer.from(JSON.stringify(body)));
        if (e === "end") cb();
      }),
    }) as never;

  it("should emit session:updated and returns updated session", async () => {
    const context = makeContext();
    const res = makeRes();
    await updateSessionHandler(makeBodyReq({ title: "New Title" }), res, context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("session:updated", { sessionId: "s1" });
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });

  it("should return 404 when updateSession returns ok:false", async () => {
    const deps = makeDeps({ updateSession: vi.fn().mockReturnValue({ ok: false, error: { type: "not_found" } }) });
    const res = makeRes();
    await updateSessionHandler(makeBodyReq({ title: "New Title" }), res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should return 404 when updateSession returns null", async () => {
    const deps = makeDeps({ updateSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    await updateSessionHandler(makeBodyReq({ title: "New Title" }), res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should return 400 when no valid fields provided", async () => {
    const res = makeRes();
    await updateSessionHandler(makeBodyReq({ unknownField: "x" }), res, makeContext(), makeDeps(), "s1");
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  });
});

// ── getSessionHandler ─────────────────────────────────────────────────────────

describe("getSessionHandler backfill", () => {
  it("should return session with messages (200)", async () => {
    const deps = makeDeps({
      getMessages: vi.fn().mockReturnValue([{ id: "m1", role: "user", content: "hi", timestamp: 0, sessionId: "s1" }]),
    });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });

  it("should not slice messages when lastN equals message count", async () => {
    const msgs = [1, 2, 3].map((i) => ({
      id: `m${i}`,
      role: "user",
      content: `msg${i}`,
      timestamp: 0,
      sessionId: "s1",
    }));
    const deps = makeDeps({ getMessages: vi.fn().mockReturnValue(msgs) });
    const res = makeRes();
    // lastN = 3 and messages.length = 3 → no slicing
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl("?last=3"));
    const body = JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(body.messages).toHaveLength(3);
  });

  it("should return session when messages exist (original test)", async () => {
    const deps = makeDeps({
      getMessages: vi.fn().mockReturnValue([{ id: "m1", role: "user", content: "hi", timestamp: 0, sessionId: "s1" }]),
    });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });

  it("should backfill from transcript when DB has no messages and engineSessionId is set", async () => {
    // getMessages returns [] first, then [message] after backfill
    let callCount = 0;
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: "e1" }) }),
      getMessages: vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? []
          : [{ id: "m1", role: "user", content: "backfilled", timestamp: 0, sessionId: "s1" }];
      }),
    });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    // insertMessage should have been called with backfilled data
    expect(deps.insertMessage).toHaveBeenCalledWith("s1", "user", "backfilled message");
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });
});

const makeNonInterruptibleEngine = () => ({
  run: vi.fn(),
});

// ── stopSession ───────────────────────────────────────────────────────────────

describe("stopSession", () => {
  it("should return 404 when session not found", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    stopSession(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should update session to idle and emits session:stopped", () => {
    const context = makeContext();
    stopSession(makeRes(), context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("session:stopped", { sessionId: "s1" });
  });

  it("should kill engine when alive", () => {
    const engine = makeEngine();
    engine.isAlive.mockReturnValue(true);
    const context = {
      emit: vi.fn(),
      sessionManager: {
        getEngine: vi.fn().mockReturnValue(engine),
        getQueue: vi.fn().mockReturnValue(makeQueue()),
      },
    } as unknown as ApiContext;
    stopSession(makeRes(), context, makeDeps(), "s1");
    expect(engine.kill).toHaveBeenCalledWith("s1", "Interrupted by user");
  });

  it("should not kill non-interruptible engine", () => {
    const engine = makeNonInterruptibleEngine();
    const context = {
      emit: vi.fn(),
      sessionManager: {
        getEngine: vi.fn().mockReturnValue(engine),
        getQueue: vi.fn().mockReturnValue(makeQueue()),
      },
    } as unknown as ApiContext;
    stopSession(makeRes(), context, makeDeps(), "s1");
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("should fall back to sourceRef when sessionKey is absent", () => {
    const deps = makeDeps({
      getSession: vi
        .fn()
        .mockReturnValue({ ok: true, value: makeSession({ sessionKey: undefined, sourceRef: "web:ref" }) }),
    });
    const context = makeContext();
    stopSession(makeRes(), context, deps, "s1");
    expect(context.emit).toHaveBeenCalledWith("session:stopped", { sessionId: "s1" });
  });

  it("should fall back to session.id when both sessionKey and sourceRef are absent", () => {
    const deps = makeDeps({
      getSession: vi
        .fn()
        .mockReturnValue({ ok: true, value: makeSession({ sessionKey: undefined, sourceRef: undefined }) }),
    });
    const context = makeContext();
    stopSession(makeRes(), context, deps, "s1");
    expect(context.emit).toHaveBeenCalledWith("session:stopped", { sessionId: "s1" });
  });
});

// ── resetSession ──────────────────────────────────────────────────────────────

describe("resetSession", () => {
  it("should return 404 when session not found", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    resetSession(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should emit session:updated after reset", () => {
    const context = makeContext();
    resetSession(makeRes(), context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("session:updated", { sessionId: "s1" });
  });

  it("should kill engine when alive", () => {
    const engine = makeEngine();
    engine.isAlive.mockReturnValue(true);
    const context = {
      emit: vi.fn(),
      sessionManager: {
        getEngine: vi.fn().mockReturnValue(engine),
        getQueue: vi.fn().mockReturnValue(makeQueue()),
      },
    } as unknown as ApiContext;
    resetSession(makeRes(), context, makeDeps(), "s1");
    expect(engine.kill).toHaveBeenCalledWith("s1", "Interrupted by reset");
  });

  it("should not kill non-interruptible engine", () => {
    const engine = makeNonInterruptibleEngine();
    const context = {
      emit: vi.fn(),
      sessionManager: {
        getEngine: vi.fn().mockReturnValue(engine),
        getQueue: vi.fn().mockReturnValue(makeQueue()),
      },
    } as unknown as ApiContext;
    resetSession(makeRes(), context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("session:updated", { sessionId: "s1" });
  });

  it("should fall back to session.id when sessionKey and sourceRef are absent", () => {
    const deps = makeDeps({
      getSession: vi
        .fn()
        .mockReturnValue({ ok: true, value: makeSession({ sessionKey: undefined, sourceRef: undefined }) }),
    });
    const context = makeContext();
    resetSession(makeRes(), context, deps, "s1");
    expect(context.emit).toHaveBeenCalledWith("session:updated", { sessionId: "s1" });
  });
});

// ── duplicateSessionHandler ───────────────────────────────────────────────────

describe("duplicateSessionHandler", () => {
  it("should return 404 when session not found", async () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    await duplicateSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should return 400 when session has no engineSessionId", async () => {
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: undefined }) }),
    });
    const res = makeRes();
    await duplicateSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  });

  it("should return 500 when fork throws", async () => {
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: "e1" }) }),
      duplicateSession: vi.fn().mockImplementation(() => {
        throw new Error("fork failed");
      }),
    });
    const res = makeRes();
    await duplicateSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.anything());
  });

  it("should return 500 when updateSession throws and cleanup deleteSession also throws", async () => {
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: "e1" }) }),
      duplicateSession: vi.fn().mockReturnValue({ session: makeSession({ id: "s2" }), messageCount: 0 }),
      updateSession: vi.fn().mockImplementation(() => {
        throw new Error("update failed");
      }),
      deleteSession: vi.fn().mockImplementation(() => {
        throw new Error("delete failed");
      }),
    });
    const res = makeRes();
    await duplicateSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.anything());
  });

  it("should return 500 when getSession after duplication returns null", async () => {
    let callCount = 0;
    const deps = makeDeps({
      getSession: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { ok: true, value: makeSession({ engineSessionId: "e1" }) };
        return { ok: true, value: null }; // second call returns null
      }),
      duplicateSession: vi.fn().mockReturnValue({ session: makeSession({ id: "s2" }), messageCount: 0 }),
    });
    const res = makeRes();
    await duplicateSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.anything());
  });

  it("should emit session:created and returns duplicated session on success", async () => {
    let callCount = 0;
    const deps = makeDeps({
      getSession: vi.fn().mockImplementation(() => {
        callCount++;
        const s =
          callCount === 1
            ? makeSession({ engineSessionId: "e1" })
            : makeSession({ id: "s2", engineSessionId: "forked-e1" });
        return { ok: true, value: s };
      }),
      duplicateSession: vi.fn().mockReturnValue({ session: makeSession({ id: "s2" }), messageCount: 3 }),
    });
    const context = makeContext();
    await duplicateSessionHandler(makeRes(), context, deps, "s1");
    expect(context.emit).toHaveBeenCalledWith("session:created", { sessionId: "s2" });
  });

  it("should return 500 when updateSession throws and deleteSession cleanup succeeds", async () => {
    // Covers the cleanup path where deleteSession doesn't throw (inner try succeeds)
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: "e1" }) }),
      duplicateSession: vi.fn().mockReturnValue({ session: makeSession({ id: "s2" }), messageCount: 0 }),
      updateSession: vi.fn().mockImplementation(() => {
        throw new Error("update failed");
      }),
    });
    const res = makeRes();
    await duplicateSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.anything());
  });
});

// ── getChildren ───────────────────────────────────────────────────────────────

describe("getChildren", () => {
  it("should return child sessions filtered by parentSessionId", () => {
    const child = makeSession({ id: "s2", parentSessionId: "s1" });
    const deps = makeDeps({ listSessions: vi.fn().mockReturnValue([child, makeSession({ id: "s3" })]) });
    const res = makeRes();
    getChildren(res, makeContext(), deps, "s1");
    const body = JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("s2");
  });
});

// ── getTranscript ─────────────────────────────────────────────────────────────

describe("getTranscript", () => {
  it("should return 404 when session not found", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    getTranscript(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should return empty array when no engineSessionId", () => {
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: undefined }) }),
    });
    const res = makeRes();
    getTranscript(res, makeContext(), deps, "s1");
    const body = JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(body).toEqual([]);
  });

  it("should return transcript entries when engineSessionId is present", () => {
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: "e1" }) }),
    });
    const res = makeRes();
    getTranscript(res, makeContext(), deps, "s1");
    // loadRawTranscript returns [] in test env (no ~/.claude/projects files)
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });
});

// ── Edge case coverage ────────────────────────────────────────────────────────

describe("edge cases for full coverage", () => {
  it("should unwrapSession: returns null when getSession ok=false", async () => {
    // Line 41: ternary false branch (result.ok = false → return null → notFound)
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: false, error: { type: "not_found" } }) });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should getSessionHandler: skips backfill when loadTranscriptMessages returns empty", async () => {
    // Line 59: if (transcriptMessages.length > 0) false branch
    vi.mocked(loadTranscriptMessages).mockReturnValueOnce([]);
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: "e1" }) }),
      getMessages: vi.fn().mockReturnValue([]), // no messages → triggers backfill attempt
    });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    expect(deps.insertMessage).not.toHaveBeenCalled(); // backfill skipped
  });

  it("should updateSessionHandler: returns early when readJsonBody fails", async () => {
    // Line 86: if (!_parsed.ok) return
    const badReq = {
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((e: string, cb: (d?: Buffer) => void) => {
        if (e === "data") cb(Buffer.from("INVALID_JSON_{{{")); // malformed
        if (e === "end") cb();
      }),
    } as never;
    const deps = makeDeps();
    const res = makeRes();
    await updateSessionHandler(badReq, res, makeContext(), deps, "s1");
    expect(deps.updateSession).not.toHaveBeenCalled();
  });

  it("should duplicateSessionHandler: error message from non-Error throw", async () => {
    // Line 219: err instanceof Error ? err.message : String(err) — false branch
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ engineSessionId: "e1" }) }),
      duplicateSession: vi.fn().mockImplementation(() => {
        throw "string error";
      }), // non-Error throw
    });
    const res = makeRes();
    await duplicateSessionHandler(res, makeContext(), deps, "s1");
    const body = JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(body.error).toContain("string error");
  });
});
