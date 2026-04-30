import { describe, expect, it, vi } from "vitest";
import type { Engine, Session } from "../../../shared/types.js";
import type { ApiContext } from "../../types.js";
import type { ResumeDeps } from "../session-resume.js";
import { resumePendingWebQueueItemsImpl } from "../session-resume.js";

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

const makeEngine = (): Engine => ({ run: vi.fn() }) as unknown as Engine;

const makeContext = (): ApiContext =>
  ({
    emit: vi.fn(),
    getConfig: vi.fn().mockReturnValue({ engines: { default: "claude", claude: {} } }),
    sessionManager: {
      getEngine: vi.fn().mockReturnValue(makeEngine()),
      getQueue: vi.fn().mockReturnValue({ clearQueue: vi.fn() }),
    },
  }) as unknown as ApiContext;

const makeDeps = (overrides: Partial<ResumeDeps> = {}): ResumeDeps => ({
  listAllPendingQueueItems: vi.fn().mockReturnValue([]),
  getSession: vi.fn().mockReturnValue({ ok: true, value: null }),
  cancelQueueItem: vi.fn(),
  updateSession: vi.fn().mockReturnValue({ ok: true, value: makeSession() }),
  maybeRevertEngineOverride: vi.fn().mockImplementation((s: Session) => s),
  dispatchWebSessionRun: vi.fn(),
  ...overrides,
});

describe("resumePendingWebQueueItemsImpl", () => {
  it("should return early when no pending items", () => {
    const deps = makeDeps();
    resumePendingWebQueueItemsImpl(makeContext(), deps);
    expect(deps.cancelQueueItem).not.toHaveBeenCalled();
    expect(deps.dispatchWebSessionRun).not.toHaveBeenCalled();
  });

  it("should cancel queue item when session not found", () => {
    const deps = makeDeps({
      listAllPendingQueueItems: vi.fn().mockReturnValue([
        { id: "qi1", sessionId: "s1", prompt: "hello", sessionKey: "sk1", createdAt: 0, status: "pending" } as never,
      ]),
      getSession: vi.fn().mockReturnValue({ ok: true, value: null }),
    });
    resumePendingWebQueueItemsImpl(makeContext(), deps);
    expect(deps.cancelQueueItem).toHaveBeenCalledWith("qi1");
    expect(deps.dispatchWebSessionRun).not.toHaveBeenCalled();
  });

  it("should skip non-web sessions", () => {
    const deps = makeDeps({
      listAllPendingQueueItems: vi.fn().mockReturnValue([
        { id: "qi1", sessionId: "s1", prompt: "hello", sessionKey: "sk1", createdAt: 0, status: "pending" } as never,
      ]),
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ source: "discord" }) }),
    });
    resumePendingWebQueueItemsImpl(makeContext(), deps);
    expect(deps.dispatchWebSessionRun).not.toHaveBeenCalled();
  });

  it("should cancel and error session when engine not available", () => {
    const deps = makeDeps({
      listAllPendingQueueItems: vi.fn().mockReturnValue([
        { id: "qi1", sessionId: "s1", prompt: "hello", sessionKey: "sk1", createdAt: 0, status: "pending" } as never,
      ]),
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ source: "web" }) }),
    });
    const context = makeContext();
    (context.sessionManager.getEngine as ReturnType<typeof vi.fn>).mockReturnValue(null);
    resumePendingWebQueueItemsImpl(context, deps);
    expect(deps.cancelQueueItem).toHaveBeenCalledWith("qi1");
    expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "error" }));
  });

  it("should dispatch web session run for valid pending web sessions", () => {
    const deps = makeDeps({
      listAllPendingQueueItems: vi.fn().mockReturnValue([
        { id: "qi1", sessionId: "s1", prompt: "hello", sessionKey: "sk1", createdAt: 0, status: "pending" } as never,
      ]),
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ source: "web" }) }),
    });
    resumePendingWebQueueItemsImpl(makeContext(), deps);
    expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "running" }));
    expect(deps.dispatchWebSessionRun).toHaveBeenCalled();
  });
});
