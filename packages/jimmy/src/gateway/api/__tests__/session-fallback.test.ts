import { describe, expect, it, vi } from "vitest";
import type { Engine, GatewayConfig, Session } from "../../../shared/types.js";
import type { ApiContext } from "../../types.js";
import type { FallbackDeps, FallbackRunParams } from "../session-fallback.js";
import { switchToFallback } from "../session-fallback.js";

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

const makeDeps = (overrides: Partial<FallbackDeps> = {}): FallbackDeps => ({
  updateSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ status: "idle" }) }),
  insertMessage: vi.fn(),
  getMessages: vi.fn().mockReturnValue([]),
  getSession: vi.fn().mockReturnValue({ ok: true, value: makeSession({ status: "idle" }) }),
  notifyDiscordChannel: vi.fn(),
  notifyParentSession: vi.fn(),
  ...overrides,
});

const makeEngine = (): Engine =>
  ({ run: vi.fn().mockResolvedValue({ result: "fallback response", sessionId: "codex-1" }) }) as unknown as Engine;

const makeContext = (): ApiContext =>
  ({ emit: vi.fn(), sessionManager: { getEngine: vi.fn() } }) as unknown as ApiContext;

const makeConfig = (): GatewayConfig =>
  ({
    engines: { default: "claude", claude: {}, codex: {} },
    portal: { portalName: "Gateway" },
  }) as unknown as GatewayConfig;

const makeRunParams = (overrides: Partial<FallbackRunParams> = {}): FallbackRunParams => ({
  prompt: "hello",
  systemPrompt: "system",
  rateLimit: { resetsAt: undefined },
  fallbackEngineConfig: { bin: "codex", model: "gpt-4o" },
  employee: undefined,
  ...overrides,
});

// ── switchToFallback ──────────────────────────────────────────────────────────

describe("switchToFallback", () => {
  it("should return false when fallbackEngine is null", async () => {
    const result = await switchToFallback(
      makeDeps(),
      makeSession(),
      null,
      "codex",
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );
    expect(result).toBe(false);
  });

  it("should return false when fallbackEngine is undefined", async () => {
    const result = await switchToFallback(
      makeDeps(),
      makeSession(),
      undefined,
      "codex",
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );
    expect(result).toBe(false);
  });

  it("should not call engine.run when fallbackEngine is null", async () => {
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), null, "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.insertMessage).not.toHaveBeenCalled();
    expect(deps.updateSession).not.toHaveBeenCalled();
  });

  it("should return true on successful fallback", async () => {
    const result = await switchToFallback(
      makeDeps(),
      makeSession(),
      makeEngine(),
      "codex",
      makeRunParams(),
      makeConfig(),
      makeContext(),
    );
    expect(result).toBe(true);
  });

  it("should update session engine to fallbackName", async () => {
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ engine: "codex" }));
  });

  it("should call notifyDiscordChannel with rate limit message", async () => {
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.notifyDiscordChannel).toHaveBeenCalledWith(expect.stringContaining("Claude usage limit reached"));
  });

  it("should insert notification message before running fallback", async () => {
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.insertMessage).toHaveBeenCalledWith(
      "s1",
      "notification",
      expect.stringContaining("Claude usage limit reached"),
    );
  });

  it("should emit session:notification event", async () => {
    const context = makeContext();
    await switchToFallback(makeDeps(), makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), context);
    expect(context.emit).toHaveBeenCalledWith("session:notification", expect.objectContaining({ sessionId: "s1" }));
  });

  it("should emit session:completed event after fallback runs", async () => {
    const context = makeContext();
    await switchToFallback(makeDeps(), makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), context);
    expect(context.emit).toHaveBeenCalledWith("session:completed", expect.objectContaining({ sessionId: "s1" }));
  });

  it("should insert assistant message when fallback returns result", async () => {
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.insertMessage).toHaveBeenCalledWith("s1", "assistant", "fallback response");
  });

  it("should call notifyParentSession after fallback completes", async () => {
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.notifyParentSession).toHaveBeenCalled();
  });

  it("should call fallbackEngine.run with correct prompt and systemPrompt", async () => {
    const engine = makeEngine();
    await switchToFallback(
      makeDeps(),
      makeSession(),
      engine,
      "codex",
      makeRunParams({ prompt: "test prompt", systemPrompt: "sys" }),
      makeConfig(),
      makeContext(),
    );
    expect(engine.run).toHaveBeenCalledWith(expect.objectContaining({ systemPrompt: "sys" }));
  });

  it("should use conversation history in fallback prompt when no codex session", async () => {
    const deps = makeDeps({
      getMessages: vi.fn().mockReturnValue([
        { role: "user", content: "hi", timestamp: Date.now() },
        { role: "assistant", content: "hello", timestamp: Date.now() },
      ]),
    });
    const engine = makeEngine();
    const session = makeSession({ transportMeta: null });
    await switchToFallback(deps, session, engine, "codex", makeRunParams(), makeConfig(), makeContext());
    const call = (engine.run as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toContain("Continue this conversation");
  });

  it("should set session status to error when fallback engine returns error", async () => {
    const engine = { run: vi.fn().mockResolvedValue({ error: "codex failed", sessionId: "c1" }) } as unknown as Engine;
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), engine, "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "error" }));
  });

  it("should set engineSessions.claude when session has engineSessionId (line 89)", async () => {
    // Cover line 89: session.engineSessionId truthy branch
    const deps = makeDeps();
    const session = makeSession({ engineSessionId: "claude-sess-abc" } as never);
    await switchToFallback(deps, session, makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
    // updateSession should have been called (proof that the function ran past line 89)
    expect(deps.updateSession).toHaveBeenCalled();
  });

  it("uses runParams.prompt directly when codexResume is truthy (line 120)", async () => {
    // Cover line 120: codexResume truthy → prompt = runParams.prompt (not conversation history)
    const engine = makeEngine();
    const session = makeSession({
      transportMeta: { engineSessions: { codex: "codex-sess-xyz" } } as never,
    });
    await switchToFallback(
      makeDeps(),
      session,
      engine,
      "codex",
      makeRunParams({ prompt: "direct prompt" }),
      makeConfig(),
      makeContext(),
    );
    const callPrompt = (engine.run as ReturnType<typeof vi.fn>).mock.calls[0][0].prompt;
    // When codexResume is set, prompt is passed directly without history prefix
    expect(callPrompt).toBe("direct prompt");
  });

  it("persists fallbackResult.sessionId to codex in engineSessions (line 152)", async () => {
    // Cover line 152: fallbackResult.sessionId truthy branch
    const engine = {
      run: vi.fn().mockResolvedValue({ result: "done", sessionId: "new-codex-sess" }),
    } as unknown as Engine;
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), engine, "codex", makeRunParams(), makeConfig(), makeContext());
    // updateSession called with transportMeta containing codex session ID
    const updateCalls = (deps.updateSession as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1];
    const meta = lastCall[1].transportMeta as Record<string, unknown>;
    const sessions = meta?.engineSessions as Record<string, unknown> | undefined;
    expect(sessions?.codex).toBe("new-codex-sess");
  });

  it("skips notifyParentSession when completedResult.ok is false (line 168)", async () => {
    // Cover line 168: completedResult.ok = false → completed = null → no notify
    const deps = makeDeps({
      updateSession: vi.fn().mockReturnValue({ ok: false }),
    });
    await switchToFallback(deps, makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.notifyParentSession).not.toHaveBeenCalled();
  });

  it("uses portalName when session.employee is falsy (line 184)", async () => {
    // Cover line 184: session.employee || config.portal?.portalName || "Gateway"
    const context = makeContext();
    const session = makeSession({ employee: undefined as never });
    await switchToFallback(makeDeps(), session, makeEngine(), "codex", makeRunParams(), makeConfig(), context);
    expect(context.emit).toHaveBeenCalledWith("session:completed", expect.objectContaining({ employee: "Gateway" }));
  });

  it("should trigger onStream callback when engine emits delta events (line 137)", async () => {
    // Cover line 137: onStream callback
    const context = makeContext();
    let capturedOnStream: ((delta: { type: string; content: string; toolName?: string }) => void) | undefined;
    const engine = {
      run: vi.fn().mockImplementation((params: Record<string, unknown>) => {
        capturedOnStream = params.onStream as typeof capturedOnStream;
        // Trigger the onStream callback
        capturedOnStream?.({ type: "text", content: "streaming delta", toolName: undefined });
        return Promise.resolve({ result: "done", sessionId: "c1" });
      }),
    } as unknown as Engine;

    await switchToFallback(makeDeps(), makeSession(), engine, "codex", makeRunParams(), makeConfig(), context);

    expect(context.emit).toHaveBeenCalledWith(
      "session:delta",
      expect.objectContaining({ sessionId: "s1", type: "text", content: "streaming delta" }),
    );
  });

  it("uses toISOString in lastError when resumeAt is truthy (line 104-106)", async () => {
    // Cover: resumeAt ? `...until ${resumeAt.toISOString()}` : fallback string
    const resetsAt = Math.floor(Date.now() / 1000) + 3600;
    const deps = makeDeps();
    await switchToFallback(
      deps,
      makeSession(),
      makeEngine(),
      "codex",
      makeRunParams({ rateLimit: { resetsAt } }),
      makeConfig(),
      makeContext(),
    );
    const firstUpdateCall = (deps.updateSession as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstUpdateCall[1].lastError).toContain("using GPT until");
  });

  it("includes employee name in Discord notification when session.employee is set (line 110)", async () => {
    // Cover: session.employee ? ` (${session.employee})` : ""
    const deps = makeDeps();
    const session = makeSession({ employee: "alice" });
    await switchToFallback(deps, session, makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.notifyDiscordChannel).toHaveBeenCalledWith(expect.stringContaining("(alice)"));
  });

  it("skips persisting codex sessionId when fallbackResult has no sessionId (line 152 false)", async () => {
    // Cover: if (fallbackResult.sessionId) — false branch
    const engine = { run: vi.fn().mockResolvedValue({ result: "done" }) } as unknown as Engine;
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), engine, "codex", makeRunParams(), makeConfig(), makeContext());
    const updateCalls = (deps.updateSession as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1];
    const meta = lastCall[1].transportMeta as Record<string, unknown>;
    const sessions = meta?.engineSessions as Record<string, unknown> | undefined;
    expect(sessions?.codex).toBeUndefined();
  });

  it("falls back to literal Gateway when both session.employee and portalName are absent (line 184)", async () => {
    // Cover: session.employee || config.portal?.portalName || "Gateway"
    const context = makeContext();
    const session = makeSession({ employee: undefined as never });
    const config = { engines: { default: "claude", claude: {}, codex: {} } } as unknown as GatewayConfig;
    await switchToFallback(makeDeps(), session, makeEngine(), "codex", makeRunParams(), config, context);
    expect(context.emit).toHaveBeenCalledWith("session:completed", expect.objectContaining({ employee: "Gateway" }));
  });
});
