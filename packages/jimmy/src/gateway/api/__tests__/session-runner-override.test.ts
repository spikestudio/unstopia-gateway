import { describe, expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types.js";

vi.mock("../../../sessions/registry.js", () => ({
  getSession: vi.fn().mockReturnValue({ ok: true, value: null }),
  getMessages: vi.fn().mockReturnValue([]),
  insertMessage: vi.fn(),
  updateSession: vi.fn().mockReturnValue({ ok: true, value: null }),
  listAllPendingQueueItems: vi.fn().mockReturnValue([]),
  cancelQueueItem: vi.fn(),
}));
vi.mock("../../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
vi.mock("../../org.js", () => ({ scanOrg: vi.fn().mockReturnValue({}), findEmployee: vi.fn() }));
vi.mock("../../org-hierarchy.js", () => ({ resolveOrgHierarchy: vi.fn().mockReturnValue({}) }));
vi.mock("../session-fallback.js", () => ({ defaultFallbackDeps: {}, switchToFallback: vi.fn() }));
vi.mock("../session-rate-limit.js", () => ({
  defaultRateLimitDeps: {},
  handleRateLimit: vi.fn(),
  retryUntilDeadline: vi.fn(),
}));
vi.mock("../../../sessions/context.js", () => ({ buildContext: vi.fn().mockReturnValue("sys") }));
vi.mock("../../../shared/effort.js", () => ({ resolveEffort: vi.fn().mockReturnValue("medium") }));
vi.mock("../../../shared/paths.js", () => ({ JINN_HOME: "/mock/jinn" }));
vi.mock("../../../shared/usageAwareness.js", () => ({ recordClaudeRateLimit: vi.fn() }));
vi.mock("../../../shared/rateLimit.js", () => ({ detectRateLimit: vi.fn().mockReturnValue({ limited: false }) }));

import { maybeRevertEngineOverride } from "../session-runner.js";

const makeSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    engine: "codex",
    engineSessionId: "codex-1",
    source: "web",
    sourceRef: "web:1",
    connector: "web",
    status: "running",
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    transportMeta: null,
    ...overrides,
  }) as Session;

describe("maybeRevertEngineOverride", () => {
  it("should return session unchanged when transportMeta is null", () => {
    const s = makeSession({ transportMeta: null });
    expect(maybeRevertEngineOverride(s)).toBe(s);
  });

  it("should return session unchanged when no engineOverride in meta", () => {
    const s = makeSession({ transportMeta: { other: "val" } as never });
    expect(maybeRevertEngineOverride(s)).toBe(s);
  });

  it("should return session unchanged when originalEngine is not a string", () => {
    const s = makeSession({
      transportMeta: {
        engineOverride: { originalEngine: 42, until: new Date(Date.now() - 1000).toISOString() },
      } as never,
    });
    expect(maybeRevertEngineOverride(s)).toBe(s);
  });

  it("should return session unchanged when until is not a string", () => {
    const s = makeSession({
      transportMeta: { engineOverride: { originalEngine: "claude", until: 12345 } } as never,
    });
    expect(maybeRevertEngineOverride(s)).toBe(s);
  });

  it("should return session unchanged when until is invalid date string", () => {
    const s = makeSession({
      transportMeta: { engineOverride: { originalEngine: "claude", until: "not-a-date" } } as never,
    });
    expect(maybeRevertEngineOverride(s)).toBe(s);
  });

  it("should return session unchanged when until is in the future", () => {
    const s = makeSession({
      transportMeta: {
        engineOverride: { originalEngine: "claude", until: new Date(Date.now() + 60000).toISOString() },
      } as never,
    });
    expect(maybeRevertEngineOverride(s)).toBe(s);
  });

  it("should attempt engine revert when override has expired", () => {
    const s = makeSession({
      engine: "codex",
      engineSessionId: "codex-1",
      transportMeta: {
        engineSessions: { claude: "claude-1" },
        engineOverride: {
          originalEngine: "claude",
          until: new Date(Date.now() - 1000).toISOString(),
          syncSince: new Date().toISOString(),
        },
      } as never,
    });
    const result = maybeRevertEngineOverride(s);
    expect(result).toBeDefined();
  });

  it("should store current engineSessionId in engineSessions before reverting", () => {
    const s = makeSession({
      engine: "codex",
      engineSessionId: "codex-session-123",
      transportMeta: {
        engineOverride: {
          originalEngine: "claude",
          until: new Date(Date.now() - 1000).toISOString(),
        },
      } as never,
    });
    const result = maybeRevertEngineOverride(s);
    expect(result).toBeDefined();
  });
});
