import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Engine, GatewayConfig, Session } from "../../../shared/types.js";
import type { ApiContext } from "../../types.js";
import type { RateLimitDeps, RetryRunParams } from "../session-rate-limit.js";
import { handleRateLimit, retryUntilDeadline } from "../session-rate-limit.js";

const makeSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    engine: "claude",
    source: "web",
    sourceRef: "web:1",
    connector: "web",
    status: "running",
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ...overrides,
  }) as Session;

const makeContext = (): ApiContext => ({ emit: vi.fn() }) as unknown as ApiContext;

const makeDeps = (overrides: Partial<RateLimitDeps> = {}): RateLimitDeps => ({
  computeNextRetryDelayMs: vi.fn().mockReturnValue({ delayMs: 60_000, resumeAt: undefined }),
  computeRateLimitDeadlineMs: vi.fn().mockReturnValue(Date.now() + 6 * 60 * 60_000),
  detectRateLimit: vi.fn().mockReturnValue({ limited: false }),
  notifyRateLimited: vi.fn(),
  notifyRateLimitResumed: vi.fn(),
  notifyDiscordChannel: vi.fn(),
  notifyParentSession: vi.fn(),
  updateSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ status: "waiting" }) }),
  insertMessage: vi.fn(),
  getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ status: "waiting" }) }),
  recordClaudeRateLimit: vi.fn(),
  ...overrides,
});

const makeRunParams = (overrides: Partial<RetryRunParams> = {}): RetryRunParams => ({
  prompt: "hello",
  systemPrompt: "you are a helpful assistant",
  engineConfig: { bin: "claude", model: "claude-3-5-sonnet" },
  effortLevel: undefined,
  employee: undefined,
  ...overrides,
});

const makeConfig = (): GatewayConfig =>
  ({ engines: { default: "claude", claude: {} }, portal: { portalName: "Gateway" } }) as unknown as GatewayConfig;

// ── handleRateLimit ───────────────────────────────────────────────────────────

describe("handleRateLimit", () => {
  it("should update session to waiting status", async () => {
    const deps = makeDeps();
    const context = makeContext();
    await handleRateLimit(deps, makeSession(), { limited: true }, undefined, context);
    expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "waiting" }));
  });

  it("should call notifyRateLimited with the waiting session", async () => {
    const deps = makeDeps();
    const context = makeContext();
    await handleRateLimit(deps, makeSession(), { limited: true }, undefined, context);
    expect(deps.notifyRateLimited).toHaveBeenCalled();
  });

  it("should insert notification message", async () => {
    const deps = makeDeps();
    const context = makeContext();
    await handleRateLimit(deps, makeSession(), { limited: true }, undefined, context);
    expect(deps.insertMessage).toHaveBeenCalledWith(
      "s1",
      "notification",
      expect.stringContaining("Claude usage limit"),
    );
  });

  it("should emit session:notification event", async () => {
    const deps = makeDeps();
    const context = makeContext();
    await handleRateLimit(deps, makeSession(), { limited: true }, undefined, context);
    expect(context.emit).toHaveBeenCalledWith("session:notification", expect.objectContaining({ sessionId: "s1" }));
  });

  it("should emit session:rate-limited event", async () => {
    const deps = makeDeps();
    const context = makeContext();
    await handleRateLimit(deps, makeSession({ employee: "alice" }), { limited: true }, "some error", context);
    expect(context.emit).toHaveBeenCalledWith(
      "session:rate-limited",
      expect.objectContaining({ sessionId: "s1", employee: "alice" }),
    );
  });

  it("should notify Discord channel", async () => {
    const deps = makeDeps();
    await handleRateLimit(deps, makeSession(), { limited: true }, undefined, makeContext());
    expect(deps.notifyDiscordChannel).toHaveBeenCalledWith(expect.stringContaining("Claude usage limit reached"));
  });

  it("should return computed delayMs and deadlineMs", async () => {
    const deps = makeDeps({
      computeNextRetryDelayMs: vi.fn().mockReturnValue({ delayMs: 30_000, resumeAt: undefined }),
      computeRateLimitDeadlineMs: vi.fn().mockReturnValue(999_999),
    });
    const result = await handleRateLimit(deps, makeSession(), { limited: true }, undefined, makeContext());
    expect(result).toEqual({ delayMs: 30_000, deadlineMs: 999_999 });
  });

  it("should format resumeAt in lastError when resetsAt is provided", async () => {
    const resetsAt = Math.floor((Date.now() + 60 * 60_000) / 1000);
    const resumeAt = new Date(resetsAt * 1000);
    const deps = makeDeps({
      computeNextRetryDelayMs: vi.fn().mockReturnValue({ delayMs: 10_000, resumeAt }),
    });
    await handleRateLimit(deps, makeSession(), { limited: true, resetsAt }, undefined, makeContext());
    expect(deps.updateSession).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ lastError: expect.stringContaining("resumes") }),
    );
  });

  it("should fall back to session spread when updateSession returns err", async () => {
    const deps = makeDeps({
      updateSession: vi.fn().mockReturnValue({ ok: false, error: { type: "not_found" } }),
    });
    await expect(
      handleRateLimit(deps, makeSession(), { limited: true }, undefined, makeContext()),
    ).resolves.not.toThrow();
    expect(deps.notifyRateLimited).toHaveBeenCalled();
  });
});

// ── retryUntilDeadline ────────────────────────────────────────────────────────

describe("retryUntilDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeEngine = (result: object = { result: "done", sessionId: "e1" }): Engine =>
    ({ run: vi.fn().mockResolvedValue(result) }) as unknown as Engine;

  it("should call notifyRateLimitResumed on successful retry", async () => {
    const deps = makeDeps();
    const engine = makeEngine({ result: "done", sessionId: "e1" });
    const session = makeSession({ status: "waiting", engineSessionId: "e1" });
    const deadlineMs = Date.now() + 60_000;

    const promise = retryUntilDeadline(
      deps,
      session,
      deadlineMs,
      1_000,
      engine,
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );
    await vi.advanceTimersByTimeAsync(1_001);
    await promise;

    expect(deps.notifyRateLimitResumed).toHaveBeenCalled();
  });

  it("should emit session:completed on successful retry", async () => {
    const deps = makeDeps();
    const context = makeContext();
    const engine = makeEngine({ result: "done", sessionId: "e1" });
    const session = makeSession({ status: "waiting" });
    const deadlineMs = Date.now() + 60_000;

    const promise = retryUntilDeadline(
      deps,
      session,
      deadlineMs,
      1_000,
      engine,
      makeRunParams(),
      makeConfig(),
      context,
    );
    await vi.advanceTimersByTimeAsync(1_001);
    await promise;

    expect(context.emit).toHaveBeenCalledWith("session:completed", expect.objectContaining({ sessionId: "s1" }));
  });

  it("should set status to error when deadline is already exceeded", async () => {
    const deps = makeDeps();
    const engine = makeEngine();
    const session = makeSession({ status: "waiting" });
    const deadlineMs = Date.now() - 1; // 既に期限切れ

    await retryUntilDeadline(deps, session, deadlineMs, 1_000, engine, makeRunParams(), makeConfig(), makeContext());

    expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "error" }));
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("should notify Discord when deadline is already exceeded", async () => {
    const deps = makeDeps();
    const session = makeSession({ status: "waiting" });
    const deadlineMs = Date.now() - 1;

    await retryUntilDeadline(
      deps,
      session,
      deadlineMs,
      1_000,
      makeEngine(),
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );

    expect(deps.notifyDiscordChannel).toHaveBeenCalledWith(expect.stringContaining("did not clear in time"));
  });

  it("should continue loop when still rate limited on retry", async () => {
    let callCount = 0;
    const engine = {
      run: vi.fn().mockImplementation(async () => {
        callCount++;
        return callCount < 3
          ? { error: "Claude rate limit exceeded", sessionId: "e1" }
          : { result: "done", sessionId: "e1" };
      }),
    } as unknown as Engine;

    const deps = makeDeps({
      detectRateLimit: vi.fn().mockImplementation((r: { error?: string }) => ({
        limited: r.error?.includes("rate limit") ?? false,
        resetsAt: undefined,
      })),
    });

    const session = makeSession({ status: "waiting" });
    const deadlineMs = Date.now() + 300_000;

    const promise = retryUntilDeadline(
      deps,
      session,
      deadlineMs,
      1_000,
      engine,
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );
    await vi.advanceTimersByTimeAsync(300_000);
    await promise;

    expect(engine.run).toHaveBeenCalledTimes(3);
    expect(deps.notifyRateLimitResumed).toHaveBeenCalled();
  });

  it("should stop early when session is no longer found", async () => {
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: null }),
    });
    const engine = makeEngine();
    const session = makeSession({ status: "waiting" });
    const deadlineMs = Date.now() + 60_000;

    const promise = retryUntilDeadline(
      deps,
      session,
      deadlineMs,
      1_000,
      engine,
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );
    await vi.advanceTimersByTimeAsync(1_001);
    await promise;

    expect(engine.run).not.toHaveBeenCalled();
  });

  it("should stop early when session status is error", async () => {
    const deps = makeDeps({
      getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ status: "error" }) }),
    });
    const engine = makeEngine();
    const session = makeSession({ status: "waiting" });
    const deadlineMs = Date.now() + 60_000;

    const promise = retryUntilDeadline(
      deps,
      session,
      deadlineMs,
      1_000,
      engine,
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );
    await vi.advanceTimersByTimeAsync(1_001);
    await promise;

    expect(engine.run).not.toHaveBeenCalled();
  });

  it("should call notifyRateLimitResumed even when engine returns non-rate-limit error", async () => {
    // rate limit はクリアされたが engine 自体がエラーを返した場合も resumed 通知は送る（元コードの挙動に準拠）
    const deps = makeDeps();
    const engine = makeEngine({ error: "some unrelated error", sessionId: "e1" });
    const session = makeSession({ status: "waiting" });
    const deadlineMs = Date.now() + 60_000;

    const promise = retryUntilDeadline(
      deps,
      session,
      deadlineMs,
      1_000,
      engine,
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );
    await vi.advanceTimersByTimeAsync(1_001);
    await promise;

    expect(deps.notifyRateLimitResumed).toHaveBeenCalled();
  });

  it("should call notifyParentSession on timeout if session is found", async () => {
    const deps = makeDeps({
      updateSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ status: "error" }) }),
    });
    const session = makeSession({ status: "waiting" });
    const deadlineMs = Date.now() - 1; // 既に期限切れ

    await retryUntilDeadline(
      deps,
      session,
      deadlineMs,
      1_000,
      makeEngine(),
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );

    expect(deps.notifyParentSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1" }),
      expect.objectContaining({ error: "Claude usage limit did not clear in time" }),
      expect.anything(),
    );
  });
});
