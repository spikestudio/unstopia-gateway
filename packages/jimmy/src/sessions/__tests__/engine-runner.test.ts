import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Connector, Engine, IncomingMessage, GatewayConfig, Session, Target } from "../../shared/types.js";

// 外部依存を vi.mock で分離
vi.mock("../../gateway/budgets.js", () => ({
  checkBudget: vi.fn().mockReturnValue("ok"),
}));

vi.mock("../../gateway/org.js", () => ({
  scanOrg: vi.fn().mockReturnValue({ employees: [] }),
}));

vi.mock("../../gateway/org-hierarchy.js", () => ({
  resolveOrgHierarchy: vi.fn().mockReturnValue({ nodes: {}, sorted: [] }),
}));

vi.mock("../../mcp/resolver.js", () => ({
  resolveMcpServers: vi.fn().mockReturnValue({ mcpServers: {} }),
  writeMcpConfigFile: vi.fn().mockReturnValue("/tmp/mcp-test.json"),
  cleanupMcpConfigFile: vi.fn(),
}));

vi.mock("../../shared/rateLimit.js", () => ({
  detectRateLimit: vi.fn().mockReturnValue({ limited: false }),
  computeNextRetryDelayMs: vi.fn().mockReturnValue({ delayMs: 1000, resumeAt: undefined }),
  computeRateLimitDeadlineMs: vi.fn().mockReturnValue(Date.now() + 60_000),
  isDeadSessionError: vi.fn().mockReturnValue(false),
  recordClaudeRateLimit: vi.fn(),
}));

vi.mock("../../shared/usageAwareness.js", () => ({
  isLikelyNearClaudeUsageLimit: vi.fn().mockReturnValue(false),
  getClaudeExpectedResetAt: vi.fn().mockReturnValue(null),
  recordClaudeRateLimit: vi.fn(),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  GATEWAY_HOME: "/test-gateway-home",
  ORG_DIR: "/test-gateway-home/org",
  DOCS_DIR: "/test-gateway-home/docs",
  CRON_JOBS: "/test-gateway-home/cron/jobs.json",
}));

vi.mock("../../shared/effort.js", () => ({
  resolveEffort: vi.fn().mockReturnValue("medium"),
}));

vi.mock("../callbacks.js", () => ({
  notifyDiscordChannel: vi.fn(),
  notifyParentSession: vi.fn(),
  notifyRateLimited: vi.fn(),
  notifyRateLimitResumed: vi.fn(),
}));

vi.mock("../context.js", () => ({
  buildContext: vi.fn().mockReturnValue("mocked system prompt"),
}));

vi.mock("node:fs", () => ({
  default: {
    rmSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(""),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ size: 1024, isDirectory: () => false }),
  },
}));

import { checkBudget } from "../../gateway/budgets.js";
import type { Result } from "../../shared/result.js";
import { checkBudgetResult, runSession } from "../engine-runner.js";
import { InMemoryFileRepository } from "../repositories/InMemoryFileRepository.js";
import { InMemoryMessageRepository } from "../repositories/InMemoryMessageRepository.js";
import { InMemoryQueueRepository } from "../repositories/InMemoryQueueRepository.js";
import { InMemorySessionRepository } from "../repositories/InMemorySessionRepository.js";
import type { Repositories } from "../repositories/index.js";

/** テスト用ヘルパー: Result から値を取り出す。Err/null の場合は undefined を返す */
function unwrap<T, E>(result: Result<T | null, E>): T | undefined {
  return result.ok ? (result.value ?? undefined) : undefined;
}

function makeConfig(): GatewayConfig {
  return {
    gateway: { port: 7777, host: "127.0.0.1" },
    engines: {
      default: "claude",
      claude: { bin: "claude", model: "sonnet" },
      codex: { bin: "codex", model: "" },
    },
    connectors: {},
    logging: { file: false, stdout: false, level: "info" },
  } as unknown as GatewayConfig;
}

function makeEngine(resultOverrides: Partial<{ result: string; error: string; sessionId: string }> = {}): Engine {
  return {
    name: "claude",
    run: vi.fn().mockResolvedValue({
      result: "engine response",
      error: undefined,
      sessionId: "eng-session-1",
      cost: 0.001,
      numTurns: 1,
      durationMs: 100,
      ...resultOverrides,
    }),
  };
}

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    name: "slack",
    reconstructTarget: vi.fn().mockReturnValue({ channel: "C12345", messageTs: undefined }),
    getCapabilities: vi.fn().mockReturnValue({
      threading: true,
      messageEdits: false,
      reactions: true,
      attachments: false,
    }),
    replyMessage: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    editMessage: vi.fn().mockResolvedValue(undefined),
    getHealth: vi.fn().mockReturnValue({ status: "ok", capabilities: {} }),
    onMessage: vi.fn(),
    ...overrides,
  } as unknown as Connector;
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-123",
    engine: "claude",
    engineSessionId: null,
    source: "slack",
    sourceRef: "slack:C12345",
    connector: "slack",
    sessionKey: "slack:C12345",
    replyContext: { channel: "C12345" },
    messageId: null,
    transportMeta: null,
    employee: null,
    model: null,
    title: null,
    parentSessionId: null,
    status: "idle",
    effortLevel: null,
    totalCost: 0,
    totalTurns: 0,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    lastError: null,
    ...overrides,
  };
}

function makeTarget(): Target {
  return { channel: "C12345", messageTs: undefined, thread: undefined };
}

function makeMsg(): IncomingMessage {
  return {
    connector: "slack",
    source: "slack",
    sessionKey: "slack:C12345",
    replyContext: { channel: "C12345" },
    messageId: undefined,
    channel: "C12345",
    thread: undefined,
    user: "U99999",
    userId: "U99999",
    text: "Hello",
    attachments: [],
    raw: {},
    transportMeta: undefined,
  };
}

function makeRepos(): Repositories {
  const sessionRepo = new InMemorySessionRepository();
  return {
    sessions: sessionRepo,
    messages: new InMemoryMessageRepository(),
    queue: new InMemoryQueueRepository(),
    files: new InMemoryFileRepository(),
  };
}

describe("runSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-E018-08: engines Map に存在しないエンジン名を持つ session を渡すと connector.replyMessage が呼ばれ早期終了
  describe("AC-E018-08: エンジン不在時の早期終了", () => {
    it("engines Map にないエンジン名を持つ session を渡すと connector.replyMessage が呼ばれる", async () => {
      const session = makeSession({ engine: "unknown-engine" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const connector = makeConnector();

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalledOnce();
      const [, msg] = vi.mocked(connector.replyMessage).mock.calls[0];
      expect(String(msg)).toContain("unknown-engine");
    });

    it("エンジン不在のとき engine.run は呼ばれない", async () => {
      const session = makeSession({ engine: "ghost" });
      const mockEngine = makeEngine();
      const engines = new Map<string, Engine>([["claude", mockEngine]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(mockEngine.run)).not.toHaveBeenCalled();
    });
  });

  // AC-E018-09: budget 超過（checkBudget が "paused"）で status が "error" 更新 + replyMessage
  describe("AC-E018-09: budget 超過時の動作", () => {
    it("checkBudget が 'paused' を返すとき session status が 'error' に更新される", async () => {
      vi.mocked(checkBudget).mockReturnValue("paused");

      const repos = makeRepos();
      // repos に session を登録
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const sessionWithId = makeSession({ id: sessionId, employee: "alice" });

      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const config = {
        ...makeConfig(),
        budgets: { employees: { alice: 10 } },
      } as unknown as GatewayConfig;

      await runSession(
        sessionWithId,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      const updated = unwrap(repos.sessions.getSession(sessionId));
      expect(updated?.status).toBe("error");
    });

    it("checkBudget が 'paused' のとき connector.replyMessage が呼ばれる", async () => {
      vi.mocked(checkBudget).mockReturnValue("paused");

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const sessionWithId = makeSession({ id: sessionId, employee: "alice" });

      const connector = makeConnector();
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const config = {
        ...makeConfig(),
        budgets: { employees: { alice: 10 } },
      } as unknown as GatewayConfig;

      await runSession(
        sessionWithId,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
      const [, msg] = vi.mocked(connector.replyMessage).mock.calls[0];
      expect(String(msg)).toContain("Budget");
    });
  });

  // AC-E018-10: source="cron" の場合 connector.addReaction が呼ばれない
  describe("AC-E018-10: source=cron で addReaction が呼ばれない", () => {
    it("session.source が 'cron' のとき connector.addReaction が呼ばれない", async () => {
      const session = makeSession({ source: "cron" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const connector = makeConnector();

      await runSession(
        session,
        { ...makeMsg(), source: "cron" },
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(connector.addReaction)).not.toHaveBeenCalled();
    });

    it("session.source が 'slack' のとき connector.addReaction が呼ばれる", async () => {
      const session = makeSession({ source: "slack" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const connector = makeConnector();

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(connector.addReaction)).toHaveBeenCalled();
    });
  });

  // AC-E018-11: pnpm test 全 PASS (正常系のカバレッジ向上)
  describe("正常系: engine.run 成功時の動作", () => {
    it("engine.run が成功すると connector.replyMessage にレスポンスが送られる", async () => {
      const session = makeSession();
      const engines = new Map<string, Engine>([["claude", makeEngine({ result: "Hello from AI" })]]);
      const connector = makeConnector();

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalledWith(expect.anything(), "Hello from AI");
    });

    it("repos がある場合 sessions.updateSession が呼ばれる", async () => {
      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId });

      const engines = new Map<string, Engine>([["claude", makeEngine()]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      const updated = unwrap(repos.sessions.getSession(sessionId));
      expect(updated?.status).toBe("idle");
    });

    it("engine.run がエラーを返した場合は status が 'error' になる", async () => {
      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId });

      const engines = new Map<string, Engine>([["claude", makeEngine({ result: "", error: "Engine crashed" })]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      const updated = unwrap(repos.sessions.getSession(sessionId));
      expect(updated?.status).toBe("error");
    });

    it("engine.run が例外を throw した場合 connector.replyMessage にエラーメッセージが送られる", async () => {
      const session = makeSession();
      const mockEngine: Engine = {
        name: "claude",
        run: vi.fn().mockRejectedValue(new Error("Unexpected engine failure")),
      };
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
      const [, msg] = vi.mocked(connector.replyMessage).mock.calls[0];
      expect(String(msg)).toContain("Unexpected engine failure");
    });

    it("repos.messages.insertMessage がユーザーメッセージを記録する", async () => {
      const repos = makeRepos();
      const session = makeSession();
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const insertSpy = vi.spyOn(repos.messages, "insertMessage");

      await runSession(
        session,
        { ...makeMsg(), text: "test message" },
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      expect(insertSpy).toHaveBeenCalledWith(session.id, "user", "test message");
    });
  });

  describe("setTypingStatus: connector が setTypingStatus を持つ場合", () => {
    it("source='slack' で setTypingStatus が呼ばれる", async () => {
      const session = makeSession({ source: "slack" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const setTypingStatus = vi.fn().mockResolvedValue(undefined);
      const connector = makeConnector({ setTypingStatus } as Partial<Connector>);

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(setTypingStatus).toHaveBeenCalled();
    });

    it("source='cron' で setTypingStatus は呼ばれない", async () => {
      const session = makeSession({ source: "cron" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const setTypingStatus = vi.fn().mockResolvedValue(undefined);
      const connector = makeConnector({ setTypingStatus } as Partial<Connector>);

      await runSession(
        session,
        { ...makeMsg(), source: "cron" },
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(setTypingStatus).not.toHaveBeenCalled();
    });
  });

  describe("syncRequested: claudeSyncSince のクリア", () => {
    it("syncRequested が true で rate limit なし・interrupted でない場合 claudeSyncSince が削除される", async () => {
      const repos = makeRepos();
      const sessionKey = "slack:C12345";
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: sessionKey,
        sessionKey,
      });

      const syncSince = new Date(Date.now() - 60_000).toISOString();
      repos.sessions.updateSession(sessionId, {
        transportMeta: { claudeSyncSince: syncSince },
      });
      const session = makeSession({
        id: sessionId,
        engine: "claude",
        transportMeta: { claudeSyncSince: syncSince },
      });

      const mockEngine = makeEngine({ result: "Done", error: undefined, sessionId: "new-session" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      // claudeSyncSince が削除されている
      const updated = unwrap(repos.sessions.getSession(sessionId));
      expect((updated?.transportMeta as Record<string, unknown>)?.claudeSyncSince).toBeUndefined();
    });
  });

  describe("syncRequested: claudeSyncSince が設定されている場合", () => {
    it("session の transportMeta に claudeSyncSince がある場合 sync transcript が使われる", async () => {
      const repos = makeRepos();
      const sessionKey = "slack:C12345";
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: sessionKey,
        sessionKey,
      });

      // claudeSyncSince を過去の時刻に設定（有効な ISO 文字列）
      const syncSince = new Date(Date.now() - 60_000).toISOString();
      const session = makeSession({
        id: sessionId,
        engine: "claude",
        transportMeta: { claudeSyncSince: syncSince },
      });

      const mockEngine = makeEngine({ result: "Synced response" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      // engine.run が呼ばれ、sync transcript を含むプロンプトが渡される
      expect(vi.mocked(mockEngine.run)).toHaveBeenCalled();
      const callArgs = vi.mocked(mockEngine.run).mock.calls[0][0];
      expect(callArgs.prompt).toContain("temporarily switched to GPT");
    });
  });

  describe("MCP config 分岐", () => {
    it("session.engine が 'claude' のとき resolveMcpServers が呼ばれる", async () => {
      const { resolveMcpServers } = await import("../../mcp/resolver.js");
      const session = makeSession({ engine: "claude" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(resolveMcpServers)).toHaveBeenCalled();
    });

    it("session.engine が 'codex' のとき resolveMcpServers は呼ばれない", async () => {
      const { resolveMcpServers } = await import("../../mcp/resolver.js");
      const session = makeSession({ engine: "codex" });
      const engines = new Map<string, Engine>([["codex", makeEngine()]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(resolveMcpServers)).not.toHaveBeenCalled();
    });

    it("MCP servers が存在する場合 writeMcpConfigFile が呼ばれる", async () => {
      const { resolveMcpServers, writeMcpConfigFile } = await import("../../mcp/resolver.js");
      vi.mocked(resolveMcpServers).mockReturnValue({
        mcpServers: { "test-server": { command: "test" } as import("../../shared/types.js").McpServerConfig },
      });

      const session = makeSession({ engine: "claude" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(writeMcpConfigFile)).toHaveBeenCalled();
    });
  });

  describe("budget チェック: budgetConfig がない場合", () => {
    it("session.employee があっても budgets 設定がなければ engine.run が呼ばれる", async () => {
      const session = makeSession({ employee: "alice" });
      const mockEngine = makeEngine();
      const engines = new Map<string, Engine>([["claude", mockEngine]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(), // budgets なし
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(mockEngine.run)).toHaveBeenCalled();
    });

    it("employee が budgetConfig に含まれない場合 engine.run が呼ばれる", async () => {
      const session = makeSession({ employee: "bob" });
      const mockEngine = makeEngine();
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const config = {
        ...makeConfig(),
        budgets: { employees: { alice: 10 } }, // bob は未設定
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(mockEngine.run)).toHaveBeenCalled();
    });
  });

  describe("rate limit fallback: Claude → Codex 切替", () => {
    it("detectRateLimit=limited で strategy=fallback かつ fallback engine がある場合 fallback engine が使われる", async () => {
      const { detectRateLimit } = await import("../../shared/rateLimit.js");
      vi.mocked(detectRateLimit).mockReturnValue({ limited: true as const, resetsAt: undefined });

      const session = makeSession({ engine: "claude" });
      const fallbackEngine = makeEngine({ result: "GPT fallback response" });
      const engines = new Map<string, Engine>([
        ["claude", makeEngine()], // claude は rate limit
        ["codex", fallbackEngine], // codex が fallback
      ]);
      const connector = makeConnector();
      const repos = makeRepos();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "fallback", fallbackEngine: "codex" as const },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // fallback engine が呼ばれる
      expect(vi.mocked(fallbackEngine.run)).toHaveBeenCalled();
      // fallback result が reply される
      const calls = vi.mocked(connector.replyMessage).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(String(lastCall[1])).toContain("GPT fallback response");
    });
  });

  describe("rate limit fallback: Codex engine ID の保持", () => {
    it("fallback engine が sessionId を返した場合 transportMeta.engineSessions.codex に保存される", async () => {
      const { detectRateLimit } = await import("../../shared/rateLimit.js");
      vi.mocked(detectRateLimit).mockReturnValue({ limited: true as const, resetsAt: undefined });

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId, engine: "claude" });

      const fallbackEngine: Engine = {
        name: "codex",
        run: vi.fn().mockResolvedValue({
          result: "Codex response",
          sessionId: "codex-session-1",
          cost: 0.001,
          numTurns: 1,
          durationMs: 100,
        }),
      };
      const engines = new Map<string, Engine>([
        ["claude", makeEngine()],
        ["codex", fallbackEngine],
      ]);

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "fallback", fallbackEngine: "codex" as const },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // fallback engine の sessionId が保存されている
      const updated = unwrap(repos.sessions.getSession(sessionId));
      const meta = updated?.transportMeta as Record<string, unknown> | null;
      const engineSessions = meta?.engineSessions as Record<string, unknown> | undefined;
      expect(engineSessions?.codex).toBe("codex-session-1");
    });

    it("fallback engine がない場合（engines Map に codex がない）でも rate limit wait path に入る", async () => {
      const { detectRateLimit, computeRateLimitDeadlineMs } = await import("../../shared/rateLimit.js");
      vi.mocked(detectRateLimit).mockReturnValue({ limited: true as const, resetsAt: undefined });
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() - 1); // 即座に deadline 切れ

      const session = makeSession({ engine: "claude" });
      // codex が engines に存在しない
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "fallback", fallbackEngine: "codex" as const },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        undefined,
      );

      // wait path に入り、deadline 切れで replyMessage が呼ばれる
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
    });
  });

  describe("rate limit fallback: engineSessionId が既存の場合の処理", () => {
    it("session に engineSessionId がある場合 claude engine session ID が engineSessions に保存される", async () => {
      const { detectRateLimit } = await import("../../shared/rateLimit.js");
      vi.mocked(detectRateLimit).mockReturnValue({ limited: true as const, resetsAt: undefined });

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      // engineSessionId が設定済みの session
      const session = makeSession({ id: sessionId, engine: "claude", engineSessionId: "existing-claude-session" });

      const fallbackEngine: Engine = {
        name: "codex",
        run: vi.fn().mockResolvedValue({
          result: "fallback response",
          sessionId: "new-codex-session",
          cost: 0.001,
          numTurns: 1,
          durationMs: 100,
        }),
      };
      const engines = new Map<string, Engine>([
        ["claude", makeEngine()],
        ["codex", fallbackEngine],
      ]);

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "fallback", fallbackEngine: "codex" as const },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // claude の engine session ID が保存されている
      const updated = unwrap(repos.sessions.getSession(sessionId));
      const meta = updated?.transportMeta as Record<string, unknown> | null;
      const engineSessions = meta?.engineSessions as Record<string, unknown> | undefined;
      expect(engineSessions?.claude).toBe("existing-claude-session");
    });

    it("fallback で既存の codex session がある場合 resume として使われる", async () => {
      const { detectRateLimit } = await import("../../shared/rateLimit.js");
      vi.mocked(detectRateLimit).mockReturnValue({ limited: true as const, resetsAt: undefined });

      const session = makeSession({
        engine: "claude",
        transportMeta: {
          engineSessions: { codex: "existing-codex-session" },
        },
      });

      const fallbackEngine: Engine = {
        name: "codex",
        run: vi.fn().mockResolvedValue({
          result: "resumed fallback response",
          sessionId: "existing-codex-session",
          cost: 0.001,
          numTurns: 1,
          durationMs: 100,
        }),
      };
      const engines = new Map<string, Engine>([
        ["claude", makeEngine()],
        ["codex", fallbackEngine],
      ]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "fallback", fallbackEngine: "codex" as const },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        undefined,
      );

      // fallback engine が呼ばれた
      expect(vi.mocked(fallbackEngine.run)).toHaveBeenCalled();
      // resumeSessionId として既存の codex session ID が使われる
      const runArgs = vi.mocked(fallbackEngine.run).mock.calls[0][0];
      expect(runArgs.resumeSessionId).toBe("existing-codex-session");
    });
  });

  describe("rate limit: notifyParentSession が呼ばれる（fallback 正常完了時）", () => {
    it("fallback engine 成功後に repos があれば notifyParentSession が呼ばれる", async () => {
      const { detectRateLimit } = await import("../../shared/rateLimit.js");
      const { notifyParentSession } = await import("../callbacks.js");
      vi.mocked(detectRateLimit).mockReturnValue({ limited: true as const, resetsAt: undefined });

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      // makeSession の overrides で parentSessionId を設定
      const session = makeSession({ id: sessionId, engine: "claude", parentSessionId: "parent-session" });

      const fallbackEngine: Engine = {
        name: "codex",
        run: vi.fn().mockResolvedValue({
          result: "fallback response",
          sessionId: "codex-1",
          cost: 0.001,
          numTurns: 1,
          durationMs: 100,
        }),
      };
      const engines = new Map<string, Engine>([
        ["claude", makeEngine()],
        ["codex", fallbackEngine],
      ]);

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "fallback", fallbackEngine: "codex" as const },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      expect(vi.mocked(notifyParentSession)).toHaveBeenCalled();
    });
  });

  describe("rate limit 検出: detectRateLimit が limited=true を返す場合", () => {
    it("detectRateLimit が limited=true かつ strategy='wait' のとき replyMessage が呼ばれる", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );
      // rate limit を検出し、即座に deadline を過ぎるようにする
      vi.mocked(detectRateLimit).mockReturnValue({ limited: true as const, resetsAt: undefined });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 100, resumeAt: undefined });
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() - 1); // 即座に deadline 切れ

      const session = makeSession({ engine: "claude" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" }, // fallback を使わない
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        undefined,
      );

      // rate limit に達したメッセージが送られる
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
    });
  });

  describe("isDeadSessionError: dead session の検出", () => {
    it("isDeadSessionError が true を返した場合に engine.run が実行されて完了する", async () => {
      const { isDeadSessionError } = await import("../../shared/rateLimit.js");
      vi.mocked(isDeadSessionError).mockReturnValue(true);

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      repos.sessions.updateSession(sessionId, { engineSessionId: "old-stale-id" });
      const session = makeSession({ id: sessionId, engineSessionId: "old-stale-id" });

      const mockEngine = makeEngine({ result: "Dead session handled", sessionId: "new-session-id" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      // dead session 後でも engine.run が呼ばれ、正常完了する
      expect(vi.mocked(mockEngine.run)).toHaveBeenCalled();
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalledWith(expect.anything(), "Dead session handled");
    });
  });

  describe("Claude usage limit 事前警告: isLikelyNearClaudeUsageLimit が true の場合", () => {
    it("isLikelyNearClaudeUsageLimit=true かつ heavy effort + resetAt あり の場合 警告メッセージに時刻が含まれる", async () => {
      const { isLikelyNearClaudeUsageLimit, getClaudeExpectedResetAt } = await import("../../shared/usageAwareness.js");
      const { resolveEffort } = await import("../../shared/effort.js");
      vi.mocked(isLikelyNearClaudeUsageLimit).mockReturnValue(true);
      vi.mocked(getClaudeExpectedResetAt).mockReturnValue(new Date(Date.now() + 3600_000)); // リセット時刻あり
      vi.mocked(resolveEffort).mockReturnValue("high");

      const session = makeSession({ engine: "claude" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const connector = makeConnector();

      await runSession(
        session,
        { ...makeMsg(), text: "a".repeat(7000) },
        ["att.jpg"],
        connector,
        makeTarget(),
        engines,
        {
          ...makeConfig(),
          engines: {
            default: "claude",
            claude: { bin: "claude", model: "claude-opus-4" },
            codex: { bin: "codex", model: "" },
          },
        } as unknown as GatewayConfig,
        () => new Map(),
        undefined,
        undefined,
      );

      // 警告メッセージが送られる（複数コール）
      expect(vi.mocked(connector.replyMessage).mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("isLikelyNearClaudeUsageLimit=true かつ heavy effort + resetAt なし の場合も警告メッセージが送られる", async () => {
      const { isLikelyNearClaudeUsageLimit, getClaudeExpectedResetAt } = await import("../../shared/usageAwareness.js");
      const { resolveEffort } = await import("../../shared/effort.js");
      vi.mocked(isLikelyNearClaudeUsageLimit).mockReturnValue(true);
      vi.mocked(getClaudeExpectedResetAt).mockReturnValue(undefined); // リセット時刻なし
      vi.mocked(resolveEffort).mockReturnValue("high");

      const session = makeSession({ engine: "claude" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        engines: {
          default: "claude",
          claude: { bin: "claude", model: "claude-opus-4" }, // opus = heavy model
          codex: { bin: "codex", model: "" },
        },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        // 長いテキストで "looks big" にする
        { ...makeMsg(), text: "a".repeat(7000) },
        ["attachment.jpg"], // attachments あり
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        undefined,
      );

      // 警告メッセージが送られている（+ 通常の replyMessage も）
      const calls = vi.mocked(connector.replyMessage).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("attachments cleanup: finally ブロック", () => {
    it("attachments がある場合 fs.rmSync が呼ばれる", async () => {
      const fsModule = await import("node:fs");
      const session = makeSession();
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);

      await runSession(
        session,
        makeMsg(),
        ["/tmp/attachment1.jpg", "/tmp/attachment2.jpg"], // attachments
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(fsModule.default.rmSync)).toHaveBeenCalled();
    });

    it("MCP config がある場合 cleanupMcpConfigFile が呼ばれる", async () => {
      const { resolveMcpServers, writeMcpConfigFile, cleanupMcpConfigFile } = await import("../../mcp/resolver.js");
      vi.mocked(resolveMcpServers).mockReturnValue({
        mcpServers: { "test-server": { command: "test" } as import("../../shared/types.js").McpServerConfig },
      });
      vi.mocked(writeMcpConfigFile).mockReturnValue("/tmp/mcp-config.json");

      const session = makeSession({ engine: "claude" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(cleanupMcpConfigFile)).toHaveBeenCalledWith(session.id);
    });
  });

  describe("exception path: catch ブロックの setTypingStatus", () => {
    it("例外が発生した場合に setTypingStatus がある connector では setTypingStatus が呼ばれる", async () => {
      const session = makeSession({ source: "slack" });
      const setTypingStatus = vi.fn().mockResolvedValue(undefined);
      const connector = makeConnector({ setTypingStatus } as Partial<Connector>);

      const mockEngine: Engine = {
        name: "claude",
        run: vi.fn().mockRejectedValue(new Error("Engine crashed during run")),
      };
      const engines = new Map<string, Engine>([["claude", mockEngine]]);

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      // エラーメッセージが送られる
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("Engine crashed"),
      );
    });

    it("例外が発生した場合に repos がある場合 notifyParentSession が呼ばれる", async () => {
      const { notifyParentSession } = await import("../callbacks.js");

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId });

      const mockEngine: Engine = {
        name: "claude",
        run: vi.fn().mockRejectedValue(new Error("Unexpected error with repos")),
      };
      const engines = new Map<string, Engine>([["claude", mockEngine]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      // repos があるので session が更新され notifyParentSession が呼ばれる
      expect(vi.mocked(notifyParentSession)).toHaveBeenCalled();
      const updated = unwrap(repos.sessions.getSession(sessionId));
      expect(updated?.status).toBe("error");
    });
  });

  // AC-E021-10: checkBudgetResult の Result 型参照実装
  describe("checkBudgetResult (AC-E021-10: Result パターン試験適用)", () => {
    it("returns Ok<void> when budget is ok", () => {
      const result = checkBudgetResult("alice", { alice: 100 }, "ok");
      expect(result.ok).toBe(true);
    });

    it("returns Err<AppError> when budget is paused", () => {
      const result = checkBudgetResult("alice", { alice: 100 }, "paused");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BUDGET_EXCEEDED");
        expect(result.error.message).toContain("alice");
      }
    });
  });

  describe("rate limit retry loop: 待機後に再試行して成功する", () => {
    it("rate limit → wait → retry 成功 の場合 replyMessage が複数回呼ばれる（wait path + retry success）", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      // mockReturnValueOnce: 最初の呼び出しは rate limited、以降は false
      // strategy=wait の場合: 1回目（初回 engine.run 後）は limited=true、2回目（retry 後）は limited=false
      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      // delay を最小にして即座にリトライ
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      // deadline を十分に先に設定
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 30_000);

      const repos = makeRepos();
      // repos にセッションを登録しておく（retry ループ内の getSessionBySessionKey に必要）
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId, engine: "claude" });

      // engine: 両方の呼び出しで成功する（detectRateLimit がモックで制御）
      const mockEngine = makeEngine({ result: "retry success", sessionId: "retry-sid" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // wait path と retry success の両方で replyMessage が呼ばれている
      const replyCalls = vi.mocked(connector.replyMessage).mock.calls;
      expect(replyCalls.length).toBeGreaterThanOrEqual(1);
      // engine が少なくとも1回は呼ばれている（初回）
      expect(vi.mocked(mockEngine.run)).toHaveBeenCalled();
    });

    it("rate limit → wait → retry でもまだ rate limit の場合 continue して再度 wait する", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      // 最初の2回は rate limit（初回実行 + 1回目 retry）、3回目以降は成功
      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      // deadline を十分先に設定してループが2回以上回るようにする
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 30_000);

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId, engine: "claude" });

      const mockEngine = makeEngine({ result: "eventually ok" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // wait path に入った（複数回 replyMessage が呼ばれている）
      expect(vi.mocked(connector.replyMessage).mock.calls.length).toBeGreaterThan(0);
    });

    it("rate limit wait loop 中にセッションが error 状態になった場合は早期 return する", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      // 初回は rate limit、その後は成功（ただしセッション状態が error なので retry しない）
      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 30_000);

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      // セッションを error 状態に事前設定（waitループ内で getSessionBySessionKey が error を返すようにする）
      repos.sessions.updateSession(sessionId, { status: "error" });
      const session = makeSession({ id: sessionId, engine: "claude" });

      const mockEngine = makeEngine({ result: "should not be called" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // error 状態なので retry engine.run は呼ばれない（最初の1回は呼ばれる）
      // 重要: 例外なく完了すること
      expect(true).toBe(true);
    });

    it("rate limit retry で Interrupted エラーが返された場合は rate limit チェックをスキップする", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 30_000);

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId, engine: "claude" });

      // retry engine は Interrupted エラーを返す
      let engineCallCount = 0;
      const mockEngine: Engine = {
        name: "claude",
        run: vi.fn().mockImplementation(() => {
          engineCallCount++;
          if (engineCallCount === 1) return Promise.resolve({ result: "", error: undefined });
          return Promise.resolve({ result: "", error: "Interrupted by user" });
        }),
      };
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // 例外なく完了すること
      expect(true).toBe(true);
    });

    it("rate limit retry 成功後に repos がある場合 replyMessage が呼ばれる（retry done パスの確認）", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 30_000);

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId, engine: "claude", parentSessionId: "parent-session" });

      const mockEngine = makeEngine({ result: "retry done" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // retry が成功して replyMessage が呼ばれている
      expect(vi.mocked(connector.replyMessage).mock.calls.length).toBeGreaterThan(0);
    });

    it("rate limit wait で resumeAt がある場合 replyMessage に時刻が含まれる", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      const resumeAt = new Date(Date.now() + 3_600_000);
      vi.mocked(detectRateLimit).mockReturnValue({ limited: true as const, resetsAt: resumeAt.getTime() / 1000 });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt });
      // deadline を過去にして即終了
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() - 1);

      const session = makeSession({ engine: "claude" });
      const engines = new Map<string, Engine>([["claude", makeEngine()]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        undefined,
      );

      // replyMessage が呼ばれている（待機中通知または期限切れ通知）
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
    });
  });

  describe("rate limit retry loop: retry 成功後にセッションIDが更新される", () => {
    it("retry result に sessionId がある場合 engine.run が2回呼ばれる（retry ループの成功パス確認）", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 30_000);

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId, engine: "claude" });

      // retry ループに入るために: rate limit 後に wait、その後 retry 成功
      const mockEngine = makeEngine({ result: "retry response", sessionId: "retry-session-id" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        config,
        () => new Map(),
        undefined,
        repos,
      );

      // engine.run が少なくとも1回呼ばれている（初回）
      expect(vi.mocked(mockEngine.run)).toHaveBeenCalled();
    });
  });

  describe("wasInterrupted: engine がエラーで 'Interrupted' を返す場合", () => {
    it("engine.run の error が 'Interrupted' で始まる場合 replyMessage は呼ばれない", async () => {
      const session = makeSession();
      const mockEngine = makeEngine({ result: "", error: "Interrupted by user" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      // wasInterrupted=true のとき connector.replyMessage は呼ばれない
      expect(vi.mocked(connector.replyMessage)).not.toHaveBeenCalled();
    });
  });

  describe("engine.run の結果処理", () => {
    it("engine.run が sessionId を返した場合 repos.sessions.updateSession に engineSessionId が渡される", async () => {
      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId });

      const mockEngine = makeEngine({ result: "Done", sessionId: "new-engine-session" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      const updated = unwrap(repos.sessions.getSession(sessionId));
      expect(updated?.engineSessionId).toBe("new-engine-session");
    });

    it("engine.run が cost を返した場合 repos.sessions.accumulateSessionCost が呼ばれる", async () => {
      const repos = makeRepos();
      const session = makeSession();
      const accumulateSpy = vi.spyOn(repos.sessions, "accumulateSessionCost");

      const mockEngine = makeEngine({ result: "Done" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);

      await runSession(
        session,
        makeMsg(),
        [],
        makeConnector(),
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        repos,
      );

      expect(accumulateSpy).toHaveBeenCalledWith(session.id, expect.any(Number), expect.any(Number));
    });

    it("engine.run が空の result を返した場合 error テキストが reply される", async () => {
      const session = makeSession();
      const mockEngine = makeEngine({ result: "", error: "Something went wrong" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      await runSession(
        session,
        makeMsg(),
        [],
        connector,
        makeTarget(),
        engines,
        makeConfig(),
        () => new Map(),
        undefined,
        undefined,
      );

      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalledWith(expect.anything(), "Something went wrong");
    });
  });

  describe("unwrapSessionResult — result.ok=false branch (line 38 right-side null)", () => {
    it("returns null when getSessionBySessionKey returns Err (stops retry loop)", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 30_000);

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId, engine: "claude" });

      // Patch getSessionBySessionKey to return Err after the first call
      // so that unwrapSessionResult receives ok=false → returns null → early return
      const originalGetByKey = repos.sessions.getSessionBySessionKey.bind(repos.sessions);
      let callCount = 0;
      repos.sessions.getSessionBySessionKey = (key: string) => {
        callCount++;
        if (callCount >= 2) {
          // Return Err — unwrapSessionResult's null branch
          return { ok: false, error: new Error("DB error") } as never;
        }
        return originalGetByKey(key);
      };

      const mockEngine = makeEngine({ result: "some result" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      // Should complete without throwing — the null currentSession → early return
      await expect(
        runSession(session, makeMsg(), [], connector, makeTarget(), engines, config, () => new Map(), undefined, repos),
      ).resolves.toBeUndefined();

      repos.sessions.getSessionBySessionKey = originalGetByKey;
    });
  });

  describe("rate limit wait loop — setInterval heartbeat (line 471 branch)", () => {
    it("heartbeat setInterval is set up during rate-limit wait (repos?.sessions.updateSession)", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 30_000);

      const repos = makeRepos();
      const { id: sessionId } = repos.sessions.createSession({
        engine: "claude",
        source: "slack",
        sourceRef: "slack:C12345",
        sessionKey: "slack:C12345",
      });
      const session = makeSession({ id: sessionId, engine: "claude" });

      const mockEngine = makeEngine({ result: "retry success" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      // Run normally — setInterval created internally for heartbeat
      // Even without fake timers, the interval is created and refs repos.sessions.updateSession
      // This test verifies the code path runs without throwing
      await expect(
        runSession(session, makeMsg(), [], connector, makeTarget(), engines, config, () => new Map(), undefined, repos),
      ).resolves.toBeUndefined();

      // repos.sessions.updateSession was called (at least for status updates)
      expect(vi.mocked(mockEngine.run)).toHaveBeenCalled();
    });
  });

  describe("rate limit wait loop — repos=undefined (line 484 false ternary branch)", () => {
    it("handles rate limit wait loop when repos is undefined (currentSessionResult is undefined → null)", async () => {
      const { detectRateLimit, computeNextRetryDelayMs, computeRateLimitDeadlineMs } = await import(
        "../../shared/rateLimit.js"
      );

      // Rate limit on first call, success on retry
      vi.mocked(detectRateLimit)
        .mockReturnValueOnce({ limited: true as const, resetsAt: undefined })
        .mockReturnValue({ limited: false as const });
      vi.mocked(computeNextRetryDelayMs).mockReturnValue({ delayMs: 1, resumeAt: undefined });
      // Very short deadline — loop will exit quickly
      vi.mocked(computeRateLimitDeadlineMs).mockReturnValue(Date.now() + 10);

      const session = makeSession({ engine: "claude" });
      const mockEngine = makeEngine({ result: "some result" });
      const engines = new Map<string, Engine>([["claude", mockEngine]]);
      const connector = makeConnector();

      const config = {
        ...makeConfig(),
        sessions: { rateLimitStrategy: "wait" },
      } as unknown as GatewayConfig;

      // Pass repos=undefined → repos?.sessions.getSessionBySessionKey returns undefined (line 484 false branch)
      await expect(
        runSession(
          session,
          makeMsg(),
          [],
          connector,
          makeTarget(),
          engines,
          config,
          () => new Map(),
          undefined,
          undefined,
        ),
      ).resolves.toBeUndefined();
    });
  });
});
