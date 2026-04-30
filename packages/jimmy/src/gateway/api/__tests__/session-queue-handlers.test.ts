import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../../types.js";
import type { QueueHandlerDeps } from "../session-queue-handlers.js";
import {
  handleCancelQueueItem,
  handleClearQueue,
  handleGetQueue,
  handlePauseQueue,
  handleResumeQueue,
} from "../session-queue-handlers.js";
import type { Session } from "../../../shared/types.js";

const makeSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    sessionKey: "sk1",
    sourceRef: "web:1",
    engine: "claude",
    source: "web",
    connector: "web",
    status: "idle",
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ...overrides,
  }) as Session;

const makeDeps = (overrides: Partial<QueueHandlerDeps> = {}): QueueHandlerDeps => ({
  getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession() }),
  getQueueItems: vi.fn().mockReturnValue([]),
  cancelQueueItem: vi.fn().mockReturnValue(true),
  cancelAllPendingQueueItems: vi.fn().mockReturnValue(2),
  ...overrides,
});

const makeQueue = () => ({
  clearQueue: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
});

const makeContext = (queue = makeQueue()): ApiContext =>
  ({
    emit: vi.fn(),
    sessionManager: { getQueue: () => queue },
  }) as unknown as ApiContext;

const makeRes = (): ServerResponse => {
  const chunks: string[] = [];
  return {
    writeHead: vi.fn(),
    end: vi.fn((data: string) => chunks.push(data)),
    _chunks: chunks,
  } as unknown as ServerResponse;
};

// ── handleGetQueue ────────────────────────────────────────────────────────────

describe("handleGetQueue", () => {
  it("should return queue items for a valid session", () => {
    const items = [{ id: "qi1", prompt: "hi" }];
    const deps = makeDeps({ getQueueItems: vi.fn().mockReturnValue(items) });
    const res = makeRes();
    handleGetQueue(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });

  it("should return 404 when session not found", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    handleGetQueue(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });
});

// ── handleClearQueue ──────────────────────────────────────────────────────────

describe("handleClearQueue", () => {
  it("should call clearQueue and cancelAllPendingQueueItems", () => {
    const deps = makeDeps();
    const queue = makeQueue();
    const context = makeContext(queue);
    handleClearQueue(makeRes(), context, deps, "s1");
    expect(queue.clearQueue).toHaveBeenCalledWith("sk1");
    expect(deps.cancelAllPendingQueueItems).toHaveBeenCalledWith("sk1");
  });

  it("should emit queue:updated event", () => {
    const context = makeContext();
    handleClearQueue(makeRes(), context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("queue:updated", expect.objectContaining({ sessionId: "s1" }));
  });

  it("should return 404 when session not found", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    handleClearQueue(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });
});

// ── handleCancelQueueItem ─────────────────────────────────────────────────────

describe("handleCancelQueueItem", () => {
  it("should return 409 when queue item not found or already running", () => {
    const deps = makeDeps({ cancelQueueItem: vi.fn().mockReturnValue(false) });
    const res = makeRes();
    handleCancelQueueItem(res, makeContext(), deps, "s1", "qi1");
    expect(res.writeHead).toHaveBeenCalledWith(409, expect.anything());
  });

  it("should return 404 when session not found", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    handleCancelQueueItem(res, makeContext(), deps, "s1", "qi1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });

  it("should emit queue:updated and returns cancelled on success", () => {
    const context = makeContext();
    const res = makeRes();
    handleCancelQueueItem(res, context, makeDeps(), "s1", "qi1");
    expect(context.emit).toHaveBeenCalledWith("queue:updated", expect.objectContaining({ sessionId: "s1" }));
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  });
});

// ── handlePauseQueue ──────────────────────────────────────────────────────────

describe("handlePauseQueue", () => {
  it("should emit queue:updated with paused: true", () => {
    const context = makeContext();
    handlePauseQueue(makeRes(), context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("queue:updated", expect.objectContaining({ paused: true, sessionId: "s1" }));
  });

  it("should call pauseQueue on the session manager", () => {
    const queue = makeQueue();
    handlePauseQueue(makeRes(), makeContext(queue), makeDeps(), "s1");
    expect(queue.pauseQueue).toHaveBeenCalledWith("sk1");
  });

  it("should return 404 when session not found", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    handlePauseQueue(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });
});

// ── handleResumeQueue ─────────────────────────────────────────────────────────

describe("handleResumeQueue", () => {
  it("should emit queue:updated with paused: false", () => {
    const context = makeContext();
    handleResumeQueue(makeRes(), context, makeDeps(), "s1");
    expect(context.emit).toHaveBeenCalledWith("queue:updated", expect.objectContaining({ paused: false, sessionId: "s1" }));
  });

  it("should call resumeQueue on the session manager", () => {
    const queue = makeQueue();
    handleResumeQueue(makeRes(), makeContext(queue), makeDeps(), "s1");
    expect(queue.resumeQueue).toHaveBeenCalledWith("sk1");
  });

  it("should return 404 when session not found", () => {
    const deps = makeDeps({ getSession: vi.fn().mockReturnValue({ ok: true, value: null }) });
    const res = makeRes();
    handleResumeQueue(res, makeContext(), deps, "s1");
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });
});
