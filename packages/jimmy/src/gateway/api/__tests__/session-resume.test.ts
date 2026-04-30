import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Engine, Session } from "../../../shared/types.js";
import type { ApiContext } from "../../types.js";
import { resumePendingWebQueueItemsImpl } from "../session-resume.js";

vi.mock("../../../sessions/registry.js", () => ({
  listAllPendingQueueItems: vi.fn().mockReturnValue([]),
  getSession: vi.fn().mockReturnValue({ ok: true, value: null }),
  cancelQueueItem: vi.fn(),
  updateSession: vi.fn().mockReturnValue({ ok: true, value: null }),
}));

vi.mock("../session-runner.js", () => ({
  maybeRevertEngineOverride: vi.fn().mockImplementation((s: Session) => s),
  dispatchWebSessionRun: vi.fn(),
}));

import {
  cancelQueueItem,
  getSession,
  listAllPendingQueueItems,
  updateSession,
} from "../../../sessions/registry.js";
import { dispatchWebSessionRun, maybeRevertEngineOverride } from "../session-runner.js";

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

describe("resumePendingWebQueueItemsImpl", () => {
  beforeEach(() => {
    vi.mocked(listAllPendingQueueItems).mockReturnValue([]);
    vi.mocked(getSession).mockReturnValue({ ok: true, value: null });
    vi.mocked(cancelQueueItem).mockReset();
    vi.mocked(updateSession).mockReturnValue({ ok: true, value: makeSession() });
    vi.mocked(maybeRevertEngineOverride).mockImplementation((s: Session) => s);
    vi.mocked(dispatchWebSessionRun).mockReset();
  });

  it("should return early when no pending items", () => {
    vi.mocked(listAllPendingQueueItems).mockReturnValue([]);
    resumePendingWebQueueItemsImpl(makeContext());
    expect(cancelQueueItem).not.toHaveBeenCalled();
    expect(dispatchWebSessionRun).not.toHaveBeenCalled();
  });

  it("should cancel queue item when session not found", () => {
    vi.mocked(listAllPendingQueueItems).mockReturnValue([
      { id: "qi1", sessionId: "s1", prompt: "hello", sessionKey: "sk1", createdAt: 0, status: "pending" } as never,
    ]);
    vi.mocked(getSession).mockReturnValue({ ok: true, value: null });

    resumePendingWebQueueItemsImpl(makeContext());
    expect(cancelQueueItem).toHaveBeenCalledWith("qi1");
    expect(dispatchWebSessionRun).not.toHaveBeenCalled();
  });

  it("should skip non-web sessions", () => {
    const session = makeSession({ source: "discord" });
    vi.mocked(listAllPendingQueueItems).mockReturnValue([
      { id: "qi1", sessionId: "s1", prompt: "hello", sessionKey: "sk1", createdAt: 0, status: "pending" } as never,
    ]);
    vi.mocked(getSession).mockReturnValue({ ok: true, value: session });

    resumePendingWebQueueItemsImpl(makeContext());
    expect(dispatchWebSessionRun).not.toHaveBeenCalled();
  });

  it("should cancel and errors session when engine not available", () => {
    const session = makeSession({ source: "web" });
    vi.mocked(listAllPendingQueueItems).mockReturnValue([
      { id: "qi1", sessionId: "s1", prompt: "hello", sessionKey: "sk1", createdAt: 0, status: "pending" } as never,
    ]);
    vi.mocked(getSession).mockReturnValue({ ok: true, value: session });

    const context = makeContext();
    (context.sessionManager.getEngine as ReturnType<typeof vi.fn>).mockReturnValue(null);

    resumePendingWebQueueItemsImpl(context);
    expect(cancelQueueItem).toHaveBeenCalledWith("qi1");
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "error" }));
  });

  it("should dispatch web session run for valid pending web sessions", () => {
    const session = makeSession({ source: "web" });
    vi.mocked(listAllPendingQueueItems).mockReturnValue([
      { id: "qi1", sessionId: "s1", prompt: "hello", sessionKey: "sk1", createdAt: 0, status: "pending" } as never,
    ]);
    vi.mocked(getSession).mockReturnValue({ ok: true, value: session });

    resumePendingWebQueueItemsImpl(makeContext());
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "running" }));
    expect(dispatchWebSessionRun).toHaveBeenCalled();
  });
});
