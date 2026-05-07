import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterruptibleEngine, GatewayConfig, Session } from "../../../shared/types.js";
import type { ApiContext } from "../../types.js";
import type { PostMessageDeps } from "../session-message.js";
import { handlePostMessage } from "../session-message.js";

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

const makeEngine = (overrides: Partial<InterruptibleEngine> = {}): InterruptibleEngine =>
  ({
    run: vi.fn(),
    isAlive: vi.fn().mockReturnValue(false),
    kill: vi.fn(),
    killAll: vi.fn(),
    ...overrides,
  }) as unknown as InterruptibleEngine;

const makeDeps = (
  session: Session | null = makeSession(),
  engineOverride: InterruptibleEngine | null = makeEngine(),
  overrides: Partial<PostMessageDeps> = {},
): PostMessageDeps => ({
  getSession: vi.fn().mockReturnValue({ ok: true, value: session }),
  insertMessage: vi.fn(),
  updateSession: vi.fn().mockReturnValue({ ok: true, value: session }),
  enqueueQueueItem: vi.fn().mockReturnValue("qi1"),
  getClaudeExpectedResetAt: vi.fn().mockReturnValue(undefined),
  maybeRevertEngineOverride: vi.fn().mockImplementation((s: Session) => s),
  dispatchWebSessionRun: vi.fn(),
  resolveAttachmentPaths: vi.fn().mockReturnValue([]),
  getEngine: vi.fn().mockReturnValue(engineOverride),
  getConfig: vi
    .fn()
    .mockReturnValue({ engines: { default: "claude", claude: {} }, sessions: {} } as unknown as GatewayConfig),
  ...overrides,
});

const makeContext = (): ApiContext =>
  ({
    emit: vi.fn(),
    sessionManager: {
      getEngine: vi.fn(),
      getQueue: vi.fn().mockReturnValue({
        clearCancelled: vi.fn(),
        getPendingCount: vi.fn().mockReturnValue(0),
        getTransportState: vi.fn().mockReturnValue(null),
      }),
    },
  }) as unknown as ApiContext;

const makeRes = (): ServerResponse =>
  ({
    writeHead: vi.fn(),
    end: vi.fn(),
  }) as unknown as ServerResponse;

const makeReq = (body: object) =>
  ({
    headers: { "content-type": "application/json" },
    on: vi.fn().mockImplementation((event: string, cb: (d?: Buffer) => void) => {
      if (event === "data") cb(Buffer.from(JSON.stringify(body)));
      if (event === "end") cb();
    }),
  }) as never;

// ── handlePostMessage ─────────────────────────────────────────────────────────

describe("handlePostMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 404 when session not found", async () => {
    const deps = makeDeps(null);
    const res = makeRes();
    await handlePostMessage(makeReq({ message: "hi" }), res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should return 400 when message is missing (AC-E026-12)", async () => {
    const deps = makeDeps();
    const res = makeRes();
    await handlePostMessage(makeReq({}), res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  });

  it("should return 400 when message is empty string", async () => {
    const deps = makeDeps();
    const res = makeRes();
    await handlePostMessage(makeReq({ message: "" }), res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  });

  it("should return 500 when engine is not available", async () => {
    const deps = makeDeps(makeSession(), null);
    const res = makeRes();
    await handlePostMessage(makeReq({ message: "hi" }), res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.anything());
  });

  it("should insert message and returns queued status", async () => {
    const deps = makeDeps();
    const res = makeRes();
    await handlePostMessage(makeReq({ message: "hello" }), res, makeContext(), deps, "s1");
    expect(deps.insertMessage).toHaveBeenCalledWith("s1", "user", "hello");
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });

  it("should call dispatchWebSessionRun after enqueueing", async () => {
    const deps = makeDeps();
    await handlePostMessage(makeReq({ message: "hello" }), makeRes(), makeContext(), deps, "s1");
    expect(deps.dispatchWebSessionRun).toHaveBeenCalled();
    expect(deps.enqueueQueueItem).toHaveBeenCalledWith("s1", "sk1", "hello");
  });

  it("should kill engine when status is running and engine is interruptible (AC-E026-13)", async () => {
    const engine = makeEngine({ isAlive: vi.fn().mockReturnValue(true) });
    const session = makeSession({ status: "running" });
    const deps = makeDeps(session, engine);
    const promise = handlePostMessage(makeReq({ message: "hi" }), makeRes(), makeContext(), deps, "s1");
    await vi.advanceTimersByTimeAsync(500);
    await promise;
    expect(engine.kill).toHaveBeenCalledWith("s1", "Interrupted: new message received");
  });

  it("should emit session:interrupted after engine kill", async () => {
    const engine = makeEngine({ isAlive: vi.fn().mockReturnValue(true) });
    const session = makeSession({ status: "running" });
    const deps = makeDeps(session, engine);
    const context = makeContext();
    const promise = handlePostMessage(makeReq({ message: "hi" }), makeRes(), context, deps, "s1");
    await vi.advanceTimersByTimeAsync(500);
    await promise;
    expect(context.emit).toHaveBeenCalledWith("session:interrupted", expect.objectContaining({ sessionId: "s1" }));
  });

  it("should emit session:queued when running but not interruptible", async () => {
    const engine = makeEngine(); // isAlive = false → not interruptible in this context
    const session = makeSession({ status: "running" });
    const deps = makeDeps(session, engine);
    const context = makeContext();
    await handlePostMessage(makeReq({ message: "hi" }), makeRes(), context, deps, "s1");
    expect(context.emit).toHaveBeenCalledWith("session:queued", expect.objectContaining({ sessionId: "s1" }));
    expect(engine.kill).not.toHaveBeenCalled();
  });

  it("should insert queuedText notification when status is waiting (AC-E026-14)", async () => {
    const session = makeSession({ status: "waiting" });
    const deps = makeDeps(session);
    const context = makeContext();
    await handlePostMessage(makeReq({ message: "hi" }), makeRes(), context, deps, "s1");
    expect(deps.insertMessage).toHaveBeenCalledWith("s1", "notification", expect.stringContaining("Still paused"));
    expect(context.emit).toHaveBeenCalledWith("session:notification", expect.objectContaining({ sessionId: "s1" }));
  });

  it("should reset status to running when interrupted (AC-E026-15)", async () => {
    const session = makeSession({ status: "interrupted" });
    const deps = makeDeps(session);
    const context = makeContext();
    await handlePostMessage(makeReq({ message: "hi" }), makeRes(), context, deps, "s1");
    expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "running" }));
    expect(context.emit).toHaveBeenCalledWith("session:resumed", { sessionId: "s1" });
  });

  it("should not kill engine for notification role messages", async () => {
    const engine = makeEngine({ isAlive: vi.fn().mockReturnValue(true) });
    const session = makeSession({ status: "running" });
    const deps = makeDeps(session, engine);
    await handlePostMessage(
      makeReq({ message: "child done", role: "notification" }),
      makeRes(),
      makeContext(),
      deps,
      "s1",
    );
    expect(engine.kill).not.toHaveBeenCalled();
  });

  it("should emit session:notification for notification role messages", async () => {
    const deps = makeDeps();
    const context = makeContext();
    await handlePostMessage(makeReq({ message: "ping", role: "notification" }), makeRes(), context, deps, "s1");
    expect(context.emit).toHaveBeenCalledWith("session:notification", expect.objectContaining({ message: "ping" }));
  });

  it("should return early when readJsonBody fails (line 67)", async () => {
    // Cover line 67: !_parsed.ok → return early
    const session = makeSession();
    const deps = makeDeps(session);
    const res = makeRes();
    const bodyStr = "not-valid-json";
    const req = {
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
        if (event === "data") cb(Buffer.from(bodyStr));
        if (event === "end") cb();
      }),
    } as never;
    await handlePostMessage(req, res, makeContext(), deps, "s1");
    // readJsonBody failed → sends 400, but dispatchWebSessionRun not called
    expect(deps.dispatchWebSessionRun).not.toHaveBeenCalled();
  });

  it("should include reset time in waiting notification when getClaudeExpectedResetAt returns a date (lines 93-102)", async () => {
    // Cover lines 93-102: expectedResetAt truthy → toLocaleString branch
    const session = makeSession({ status: "waiting" });
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
    const deps = makeDeps(session, makeEngine(), {
      getClaudeExpectedResetAt: vi.fn().mockReturnValue(futureDate),
    });
    const context = makeContext();
    await handlePostMessage(makeReq({ message: "hi" }), makeRes(), context, deps, "s1");
    // insertMessage should include "resets" with the localized date
    const notifCalls = (deps.insertMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[1] === "notification",
    );
    const queuedText = notifCalls[0]?.[2] as string;
    expect(queuedText).toContain("resets");
  });

  it("uses sourceRef as sessionKey when sessionKey is absent (line 133-136)", async () => {
    // Cover lines 133-136: sessionKey || sourceRef || id fallback
    const session = makeSession({ sessionKey: undefined as never, sourceRef: "src-ref-x" });
    const mockClearCancelled = vi.fn();
    const deps = makeDeps(session);
    const ctx = makeContext();
    (ctx.sessionManager.getQueue as ReturnType<typeof vi.fn>).mockReturnValue({
      clearCancelled: mockClearCancelled,
      getPendingCount: vi.fn().mockReturnValue(0),
      getTransportState: vi.fn().mockReturnValue(null),
    });
    await handlePostMessage(makeReq({ message: "hi" }), makeRes(), ctx, deps, "s1");
    // clearCancelled called with sourceRef
    expect(mockClearCancelled).toHaveBeenCalledWith("src-ref-x");
  });

  it("uses session id as sessionKey when both sessionKey and sourceRef are absent (line 133-136)", async () => {
    const session = makeSession({ sessionKey: undefined as never, sourceRef: undefined as never });
    const mockClearCancelled = vi.fn();
    const deps = makeDeps(session);
    const ctx = makeContext();
    (ctx.sessionManager.getQueue as ReturnType<typeof vi.fn>).mockReturnValue({
      clearCancelled: mockClearCancelled,
      getPendingCount: vi.fn().mockReturnValue(0),
      getTransportState: vi.fn().mockReturnValue(null),
    });
    await handlePostMessage(makeReq({ message: "hi" }), makeRes(), ctx, deps, "s1");
    expect(mockClearCancelled).toHaveBeenCalledWith("s1");
  });
});
