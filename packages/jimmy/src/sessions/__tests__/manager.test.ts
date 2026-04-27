import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Result } from "../../shared/result.js";
import type { Connector, Engine, JinnConfig } from "../../shared/types.js";
import { InMemoryFileRepository } from "../repositories/InMemoryFileRepository.js";
import { InMemoryMessageRepository } from "../repositories/InMemoryMessageRepository.js";
import { InMemoryQueueRepository } from "../repositories/InMemoryQueueRepository.js";
import { InMemorySessionRepository } from "../repositories/InMemorySessionRepository.js";
import type { Repositories } from "../repositories/index.js";

/** テスト用ヘルパー: Result から値を取り出す。Err/null の場合は undefined を返す */
function unwrap<T, E>(result: Result<T | null, E>): T | undefined {
  return result.ok ? (result.value ?? undefined) : undefined;
}

vi.mock("../engine-runner.js", () => ({
  mergeTransportMeta: vi.fn((e: unknown, i: unknown) => ({ ...((e as object) || {}), ...((i as object) || {}) })),
  runSession: vi.fn(),
}));

vi.mock("../cron-command-handler.js", () => ({
  handleCronCommand: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../shared/usageAwareness.js", () => ({
  getClaudeExpectedResetAt: vi.fn().mockReturnValue(null),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { handleCronCommand } from "../cron-command-handler.js";
import { runSession } from "../engine-runner.js";
import { SessionManager } from "../manager.js";

function makeConfig(): JinnConfig {
  return {
    gateway: { port: 7777, host: "0.0.0.0" },
    engines: { default: "claude", claude: { bin: "claude", model: "sonnet" }, codex: { bin: "codex", model: "" } },
    connectors: {},
    logging: { file: false, stdout: false, level: "info" },
  } as unknown as JinnConfig;
}

function makeEngine(): Engine {
  return { name: "claude", run: vi.fn() };
}

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    name: "telegram",
    reconstructTarget: vi.fn().mockReturnValue({ channel: "ch", messageTs: undefined }),
    getCapabilities: vi
      .fn()
      .mockReturnValue({ threading: false, messageEdits: false, reactions: false, attachments: false }),
    replyMessage: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn(),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn(),
    getHealth: vi.fn().mockReturnValue({ status: "ok" }),
    ...overrides,
  } as unknown as Connector;
}

const baseMsg = {
  connector: "telegram",
  source: "telegram",
  sessionKey: "k1",
  replyContext: { channel: "ch", messageTs: undefined },
  messageId: undefined,
  channel: "ch",
  thread: undefined,
  user: "user1",
  userId: "user1",
  text: "hello",
  attachments: [],
  raw: {},
  transportMeta: undefined,
};

function makeRepos(sessionRepo: InMemorySessionRepository): Repositories {
  return {
    sessions: sessionRepo,
    messages: new InMemoryMessageRepository(),
    queue: new InMemoryQueueRepository(),
    files: new InMemoryFileRepository(),
  };
}

describe("SessionManager", () => {
  let manager: SessionManager;
  let sessionRepo: InMemorySessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionRepo = new InMemorySessionRepository();
    const engines = new Map<string, Engine>([["claude", makeEngine()]]);
    manager = new SessionManager(makeConfig(), engines, [], makeRepos(sessionRepo));
  });

  describe("getEngine", () => {
    it("登録済みエンジンを返す", () => {
      expect(manager.getEngine("claude")).toBeDefined();
      expect(manager.getEngine("claude")?.name).toBe("claude");
    });

    it("未登録エンジンは undefined を返す", () => {
      expect(manager.getEngine("unknown")).toBeUndefined();
    });
  });

  describe("getQueue", () => {
    it("SessionQueue インスタンスを返す", () => {
      const queue = manager.getQueue();
      expect(queue).toBeDefined();
      expect(typeof queue.getPendingCount).toBe("function");
    });
  });

  describe("resetSession", () => {
    it("セッションキーに対応するセッションを削除する", () => {
      sessionRepo.createSession({ engine: "claude", source: "telegram", sourceRef: "key-1", sessionKey: "key-1" });

      manager.resetSession("key-1");

      expect(unwrap(sessionRepo.getSessionBySessionKey("key-1"))).toBeUndefined();
    });

    it("セッションが存在しない場合は何もしない", () => {
      expect(() => manager.resetSession("not-found")).not.toThrow();
    });
  });

  describe("route", () => {
    it("既存セッションがない場合は新規セッションを作成して runSession を呼ぶ", async () => {
      await manager.route(baseMsg as never, makeConnector());

      expect(vi.mocked(runSession)).toHaveBeenCalledOnce();
    });

    it("既存セッションがある場合は runSession を呼ぶ", async () => {
      sessionRepo.createSession({ engine: "claude", source: "telegram", sourceRef: "k1", sessionKey: "k1" });

      await manager.route(baseMsg as never, makeConnector());

      expect(vi.mocked(runSession)).toHaveBeenCalledOnce();
    });

    it("status が waiting のときはキュー待ちメッセージを返信する", async () => {
      const session = sessionRepo.createSession({
        engine: "claude",
        source: "telegram",
        sourceRef: "k1",
        sessionKey: "k1",
      });
      sessionRepo.updateSession(session.id, { status: "waiting" });
      const connector = makeConnector();

      await manager.route(baseMsg as never, connector);

      const replyMessage = vi.mocked(connector.replyMessage);
      expect(replyMessage).toHaveBeenCalled();
      const [, msg] = replyMessage.mock.calls[0];
      expect(String(msg)).toContain("queued");
    });

    it("result に sessionId を含む", async () => {
      const result = await manager.route(baseMsg as never, makeConnector());

      expect(result?.sessionId).toBeDefined();
    });
  });

  describe("handleCommand", () => {
    it("/new でセッションをリセットして true を返す", async () => {
      sessionRepo.createSession({ engine: "claude", source: "telegram", sourceRef: "k1", sessionKey: "k1" });
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/new" } as never, connector);

      expect(handled).toBe(true);
      expect(unwrap(sessionRepo.getSessionBySessionKey("k1"))).toBeUndefined();
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
    });

    it("/status でセッション情報を返して true を返す", async () => {
      sessionRepo.createSession({ engine: "claude", source: "telegram", sourceRef: "k1", sessionKey: "k1" });
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/status" } as never, connector);

      expect(handled).toBe(true);
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
    });

    it("/status でセッションがない場合もメッセージを返して true を返す", async () => {
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/status" } as never, connector);

      expect(handled).toBe(true);
    });

    it("/model でモデルを更新して true を返す", async () => {
      const session = sessionRepo.createSession({
        engine: "claude",
        source: "telegram",
        sourceRef: "k1",
        sessionKey: "k1",
      });
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/model claude-opus-4" } as never, connector);

      expect(handled).toBe(true);
      expect(unwrap(sessionRepo.getSession(session.id))?.model).toBe("claude-opus-4");
      const [, reply] = vi.mocked(connector.replyMessage).mock.calls[0];
      expect(String(reply)).toContain("claude-opus-4");
    });

    it("/model で引数なしのとき使用方法を返して true を返す", async () => {
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/model" } as never, connector);

      expect(handled).toBe(true);
      const [, reply] = vi.mocked(connector.replyMessage).mock.calls[0];
      expect(String(reply)).toContain("Usage:");
    });

    it("/model でセッションがない場合もメッセージを返して true を返す", async () => {
      const handled = await manager.handleCommand({ ...baseMsg, text: "/model gpt-4" } as never, makeConnector());

      expect(handled).toBe(true);
    });

    it("/doctor でエンジン・コネクター情報を返して true を返す", async () => {
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/doctor" } as never, connector);

      expect(handled).toBe(true);
      const [, reply] = vi.mocked(connector.replyMessage).mock.calls[0];
      expect(String(reply)).toContain("claude");
    });

    it("/cron は handleCronCommand に委譲する", async () => {
      vi.mocked(handleCronCommand).mockResolvedValue(true);
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/cron list" } as never, connector);

      expect(handled).toBe(true);
      expect(vi.mocked(handleCronCommand)).toHaveBeenCalledWith("/cron list", connector, expect.any(Object));
    });

    it("未知のコマンドは false を返す", async () => {
      const handled = await manager.handleCommand({ ...baseMsg, text: "普通のメッセージ" } as never, makeConnector());
      expect(handled).toBe(false);
    });
  });
});
