import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Connector, Engine, JinnConfig } from "../../shared/types.js";

vi.mock("../registry.js", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSessionBySessionKey: vi.fn(),
  updateSession: vi.fn(),
}));

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

import { deleteSession, getSessionBySessionKey, updateSession } from "../registry.js";
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
    getCapabilities: vi.fn().mockReturnValue({ threading: false, messageEdits: false, reactions: false, attachments: false }),
    replyMessage: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn(),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn(),
    getHealth: vi.fn().mockReturnValue({ status: "ok" }),
    ...overrides,
  } as unknown as Connector;
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1", sessionKey: "k1", status: "idle", engine: "claude",
    source: "telegram", sourceRef: "k1", connector: "telegram",
    replyContext: { channel: "ch", messageTs: undefined },
    messageId: undefined, channel: "ch", thread: undefined,
    employee: undefined, model: undefined, title: undefined, prompt: "hi",
    createdAt: new Date().toISOString(), lastActivity: new Date().toISOString(),
    lastError: undefined, engineSessionId: undefined, cost: 0, numTurns: 0,
    portalName: undefined, transportMeta: undefined,
    ...overrides,
  };
}

const baseMsg = {
  connector: "telegram", source: "telegram", sessionKey: "k1",
  replyContext: { channel: "ch", messageTs: undefined },
  messageId: undefined, channel: "ch", thread: undefined,
  user: "user1", userId: "user1", text: "hello", attachments: [], raw: {},
  transportMeta: undefined,
};

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    const engines = new Map<string, Engine>([["claude", makeEngine()]]);
    manager = new SessionManager(makeConfig(), engines);
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
      const mockSession = { id: "sess-1", sessionKey: "key-1" };
      vi.mocked(getSessionBySessionKey).mockReturnValue(mockSession as never);

      manager.resetSession("key-1");

      expect(getSessionBySessionKey).toHaveBeenCalledWith("key-1");
    });

    it("セッションが存在しない場合は何もしない", () => {
      vi.mocked(getSessionBySessionKey).mockReturnValue(undefined);

      expect(() => manager.resetSession("not-found")).not.toThrow();
    });
  });

  describe("route", () => {
    it("既存セッションがない場合は新規セッションを作成して runSession を呼ぶ", async () => {
      const { createSession } = await import("../registry.js");
      vi.mocked(getSessionBySessionKey).mockReturnValue(undefined);
      vi.mocked(createSession).mockReturnValue(makeSession() as never);
      vi.mocked(updateSession).mockReturnValue(makeSession() as never);

      await manager.route(baseMsg as never, makeConnector());

      expect(vi.mocked(runSession)).toHaveBeenCalledOnce();
    });

    it("既存セッションがある場合は updateSession を呼んで runSession を呼ぶ", async () => {
      vi.mocked(getSessionBySessionKey).mockReturnValue(makeSession() as never);
      vi.mocked(updateSession).mockReturnValue(makeSession() as never);

      await manager.route(baseMsg as never, makeConnector());

      expect(vi.mocked(updateSession)).toHaveBeenCalled();
      expect(vi.mocked(runSession)).toHaveBeenCalledOnce();
    });

    it("status が waiting のときはキュー待ちメッセージを返信する", async () => {
      vi.mocked(getSessionBySessionKey).mockReturnValue(makeSession({ status: "waiting" }) as never);
      vi.mocked(updateSession).mockReturnValue(makeSession({ status: "waiting" }) as never);
      const connector = makeConnector();

      await manager.route(baseMsg as never, connector);

      const replyMessage = vi.mocked(connector.replyMessage);
      expect(replyMessage).toHaveBeenCalled();
      const [, msg] = replyMessage.mock.calls[0];
      expect(String(msg)).toContain("queued");
    });

    it("result に sessionId を含む", async () => {
      const { createSession } = await import("../registry.js");
      vi.mocked(getSessionBySessionKey).mockReturnValue(undefined);
      vi.mocked(createSession).mockReturnValue(makeSession({ id: "sess-abc" }) as never);
      vi.mocked(updateSession).mockReturnValue(makeSession({ id: "sess-abc" }) as never);

      const result = await manager.route(baseMsg as never, makeConnector());

      expect(result?.sessionId).toBe("sess-abc");
    });
  });

  describe("handleCommand", () => {
    it("/new でセッションをリセットして true を返す", async () => {
      const session = makeSession();
      vi.mocked(getSessionBySessionKey).mockReturnValue(session as never);
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/new" } as never, connector);

      expect(handled).toBe(true);
      expect(vi.mocked(deleteSession)).toHaveBeenCalledWith(session.id);
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
    });

    it("/status でセッション情報を返して true を返す", async () => {
      vi.mocked(getSessionBySessionKey).mockReturnValue(makeSession() as never);
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/status" } as never, connector);

      expect(handled).toBe(true);
      expect(vi.mocked(connector.replyMessage)).toHaveBeenCalled();
    });

    it("/status でセッションがない場合もメッセージを返して true を返す", async () => {
      vi.mocked(getSessionBySessionKey).mockReturnValue(undefined);
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/status" } as never, connector);

      expect(handled).toBe(true);
    });

    it("/model でモデルを更新して true を返す", async () => {
      vi.mocked(getSessionBySessionKey).mockReturnValue(makeSession() as never);
      const connector = makeConnector();

      const handled = await manager.handleCommand({ ...baseMsg, text: "/model claude-opus-4" } as never, connector);

      expect(handled).toBe(true);
      expect(vi.mocked(updateSession)).toHaveBeenCalledWith("s1", expect.objectContaining({ model: "claude-opus-4" }));
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
      vi.mocked(getSessionBySessionKey).mockReturnValue(undefined);

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
