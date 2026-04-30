import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types.js";
import type { ApiContext } from "../../types.js";
import type { CrudDeps } from "../session-crud.js";
import {
  deleteSessionHandler,
  getSessionHandler,
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

const makeRes = (): ServerResponse => ({
  writeHead: vi.fn(),
  end: vi.fn(),
}) as unknown as ServerResponse;

const makeUrl = (search = ""): URL => new URL(`http://localhost/api/sessions/s1${search}`);

// ── getSessionHandler ─────────────────────────────────────────────────────────

describe("getSessionHandler", () => {
  it("returns 404 when session not found", async () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("returns session with messages", async () => {
    const deps = makeDeps({ getMessages: vi.fn().mockReturnValue([{ role: "user", content: "hi" }]) });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl());
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });

  it("applies last=N filter when specified", async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ role: "user", content: `msg${i}`, id: `${i}`, timestamp: Date.now(), sessionId: "s1" }));
    const deps = makeDeps({ getMessages: vi.fn().mockReturnValue(messages) });
    const res = makeRes();
    await getSessionHandler({} as never, res, makeContext(), deps, "s1", makeUrl("?last=3"));
    const body = JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(body.messages).toHaveLength(3);
  });
});

// ── updateSessionHandler ──────────────────────────────────────────────────────

describe("updateSessionHandler", () => {
  it("returns 404 when session not found", async () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    const req = { headers: {}, on: vi.fn().mockImplementation((e, cb) => { if (e === "data") {}; if (e === "end") cb(); }), } as never;
    await updateSessionHandler(req, res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("returns 400 when title is not a string", async () => {
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

  it("returns 400 when title is empty string", async () => {
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
  it("returns 404 when session not found (AC-E026-21)", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    deleteSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("calls deleteSession when session exists", () => {
    const deps = makeDeps();
    const res = makeRes();
    deleteSessionHandler(res, makeContext(), deps, "s1");
    expect(deps.deleteSession).toHaveBeenCalledWith("s1");
  });

  it("emits session:deleted event on success", () => {
    const context = makeContext();
    deleteSessionHandler(makeRes(), context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("session:deleted", { sessionId: "s1" });
  });

  it("returns 404 when deleteSession returns falsy", () => {
    const deps = makeDeps({ deleteSession: vi.fn().mockReturnValue(false) });
    const res = makeRes();
    deleteSessionHandler(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("kills live engine process before deleting", () => {
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
