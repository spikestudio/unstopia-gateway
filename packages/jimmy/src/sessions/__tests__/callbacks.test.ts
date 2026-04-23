import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../registry.js", () => ({
  getSession: vi.fn(),
}));

vi.mock("../../shared/config.js", () => ({
  loadConfig: vi.fn(() => ({ gateway: { port: 7777 } })),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import type { Session } from "../../shared/types.js";
import { notifyDiscordChannel, notifyParentSession, notifyRateLimitResumed, notifyRateLimited } from "../callbacks.js";
import { getSession } from "../registry.js";

function makeSession(_overrides: Partial<Session> = {}): Session {
  return {
    id: "child-001",
    engine: "claude",
    engineSessionId: null,
    source: "api",
    sourceRef: "api:test",
    connector: null,
    sessionKey: "test-key",
    replyContext: null,
    messageId: null,
    transportMeta: null,
    employee: "test-employee",
    model: "opus",
    title: null,
    parentSessionId: "parent-001",
    status: "idle",
    effortLevel: null,
    totalCost: 0,
    totalTurns: 0,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    lastError: null,
  } as Session;
}

const originalFetch = globalThis.fetch;

describe("notifyParentSession — no parent", () => {
  it("does nothing if child has no parentSessionId", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = spy as unknown as typeof fetch;

    const child = makeSession({ parentSessionId: null });
    notifyParentSession(child, { result: "done" });

    await new Promise((r) => setTimeout(r, 150));
    expect(spy).not.toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });
});

describe("notifyParentSession", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    vi.mocked(getSession).mockReturnValue(makeSession({ id: "parent-001", parentSessionId: null, status: "idle" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch as typeof fetch;
  });

  it('sends success notification saying "replied in session" with API pointer', async () => {
    const child = makeSession();

    notifyParentSession(child, { result: "Some result" });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:7777/api/sessions/parent-001/message");

    const body = JSON.parse(opts.body);
    expect(body.message).toContain("replied in session");
    expect(body.message).toContain("GET /api/sessions/child-001?last=N");
    expect(body.message).not.toContain("completed their task");
  });

  it("includes truncated 200-char preview for long results", async () => {
    const longResult = "x".repeat(300);
    const child = makeSession();

    notifyParentSession(child, { result: longResult });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    // Should contain exactly 200 chars + "..."
    expect(body.message).toContain(`${"x".repeat(200)}...`);
    expect(body.message).not.toContain("x".repeat(201));
  });

  it("includes full preview for short results", async () => {
    const shortResult = "Task done successfully";
    const child = makeSession();

    notifyParentSession(child, { result: shortResult });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.message).toContain(shortResult);
    expect(body.message).not.toContain("...");
  });

  it("error notifications contain the error message", async () => {
    const child = makeSession();

    notifyParentSession(child, { error: "Something broke" });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.message).toContain("Something broke");
    expect(body.message).toContain("⚠️");
  });

  it('sends with "notification" role', async () => {
    const child = makeSession();

    notifyParentSession(child, { result: "done" });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.role).toBe("notification");
  });
});

describe("notifyParentSession — alwaysNotify suppression", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    vi.mocked(getSession).mockReturnValue(makeSession({ id: "parent-001", parentSessionId: null, status: "idle" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch as typeof fetch;
  });

  it("skips notification when alwaysNotify is false (success)", async () => {
    const child = makeSession();

    notifyParentSession(child, { result: "done" }, { alwaysNotify: false });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips notification when alwaysNotify is false (error)", async () => {
    const child = makeSession();

    notifyParentSession(child, { error: "Something broke" }, { alwaysNotify: false });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends notification when alwaysNotify is true", async () => {
    const child = makeSession();

    notifyParentSession(child, { result: "done" }, { alwaysNotify: true });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("sends notification when options is undefined (backward compat)", async () => {
    const child = makeSession();

    notifyParentSession(child, { result: "done" });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

describe("notifyRateLimited — fire-and-forget", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const WAIT = 200; // longer wait to flush pending promises from prior describe blocks

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch as typeof fetch;
  });

  it("sends rate-limit notification to parent session", async () => {
    const child = makeSession();
    notifyRateLimited(child);
    await new Promise((r) => setTimeout(r, WAIT));
    // _sendRaw is called directly — it posts to the parent session endpoint
    const calls = fetchSpy.mock.calls.filter((args: unknown[]) =>
      (args[0] as string).includes("/api/sessions/parent-001/message")
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(calls[calls.length - 1][1].body);
    expect(body.message).toContain("rate-limited");
  });

  it("includes estimated resume time when provided", async () => {
    const child = makeSession();
    notifyRateLimited(child, "2025-04-23T20:00:00Z");
    await new Promise((r) => setTimeout(r, WAIT));
    const calls = fetchSpy.mock.calls.filter((args: unknown[]) =>
      (args[0] as string).includes("/api/sessions/parent-001/message")
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(calls[calls.length - 1][1].body);
    expect(body.message).toContain("2025-04-23T20:00:00Z");
  });
});

describe("notifyRateLimitResumed — fire-and-forget", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const WAIT = 200;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch as typeof fetch;
  });

  it("sends resume notification to parent session", async () => {
    const child = makeSession();
    notifyRateLimitResumed(child);
    await new Promise((r) => setTimeout(r, WAIT));
    const calls = fetchSpy.mock.calls.filter((args: unknown[]) =>
      (args[0] as string).includes("/api/sessions/parent-001/message")
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(calls[calls.length - 1][1].body);
    expect(body.message).toContain("resumed");
    expect(body.message).toContain("test-employee");
  });

  it("uses 'Unknown' when employee is not set", async () => {
    // Build a session with employee explicitly as empty string (triggers the || fallback)
    const child: Session = {
      ...makeSession(),
      employee: "",
    };
    notifyRateLimitResumed(child);
    await new Promise((r) => setTimeout(r, WAIT));
    const calls = fetchSpy.mock.calls.filter((args: unknown[]) =>
      (args[0] as string).includes("/api/sessions/parent-001/message")
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(calls[calls.length - 1][1].body);
    expect(body.message).toContain("Unknown");
  });
});

describe("notifyDiscordChannel", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch as typeof fetch;
  });

  it("skips sending when no channel is configured", async () => {
    vi.mocked(await import("../../shared/config.js")).loadConfig = vi.fn(() => ({
      gateway: { port: 7777, host: "0.0.0.0" },
      engines: { default: "claude", claude: { bin: "claude", model: "sonnet" }, codex: { bin: "codex", model: "" } },
      connectors: {},
      logging: { file: false, stdout: true, level: "info" },
      // notifications not configured → no channel
    }));
    notifyDiscordChannel("test message");
    await new Promise((r) => setTimeout(r, 50));
    // fetch should NOT be called because no channel is configured
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
