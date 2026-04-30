import { describe, expect, it, vi } from "vitest";
import type { Engine, JinnConfig, Session } from "../../../shared/types.js";
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

const makeConfig = (): JinnConfig =>
  ({
    engines: { default: "claude", claude: {}, codex: {} },
    portal: { portalName: "Jinn" },
  }) as unknown as JinnConfig;

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
    const result = await switchToFallback(makeDeps(), makeSession(), null, "codex", makeRunParams(), makeConfig(), makeContext());
    expect(result).toBe(false);
  });

  it("should return false when fallbackEngine is undefined", async () => {
    const result = await switchToFallback(makeDeps(), makeSession(), undefined, "codex", makeRunParams(), makeConfig(), makeContext());
    expect(result).toBe(false);
  });

  it("should not call engine.run when fallbackEngine is null", async () => {
    const deps = makeDeps();
    await switchToFallback(deps, makeSession(), null, "codex", makeRunParams(), makeConfig(), makeContext());
    expect(deps.insertMessage).not.toHaveBeenCalled();
    expect(deps.updateSession).not.toHaveBeenCalled();
  });

  it("should return true on successful fallback", async () => {
    const result = await switchToFallback(makeDeps(), makeSession(), makeEngine(), "codex", makeRunParams(), makeConfig(), makeContext());
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
    expect(deps.insertMessage).toHaveBeenCalledWith("s1", "notification", expect.stringContaining("Claude usage limit reached"));
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
    await switchToFallback(makeDeps(), makeSession(), engine, "codex", makeRunParams({ prompt: "test prompt", systemPrompt: "sys" }), makeConfig(), makeContext());
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
});
