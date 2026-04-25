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

import { getSessionBySessionKey, updateSession } from "../registry.js";
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

  describe("route — セッションなし", () => {
    it("既存セッションがない場合は新規セッションを作成して runSession を呼ぶ", async () => {
      const { createSession } = await import("../registry.js");
      const { runSession } = await import("../engine-runner.js");

      vi.mocked(getSessionBySessionKey).mockReturnValue(undefined);
      const mockSession = {
        id: "s1", sessionKey: "k1", status: "idle", engine: "claude",
        source: "telegram", sourceRef: "k1", connector: "telegram",
        replyContext: {}, messageId: null, transportMeta: null,
        employee: null, model: null, title: null, prompt: "hi",
        createdAt: new Date().toISOString(), lastActivity: new Date().toISOString(),
        lastError: null, engineSessionId: null, cost: 0, numTurns: 0,
        portalName: null,
      };
      vi.mocked(createSession).mockReturnValue(mockSession as never);
      vi.mocked(updateSession).mockReturnValue(mockSession as never);

      const connector = {
        name: "telegram",
        route: vi.fn(),
        reconstructTarget: vi.fn().mockReturnValue({ channel: "ch", messageTs: null }),
        getCapabilities: vi.fn().mockReturnValue({ threading: false, messageEdits: false, reactions: false, attachments: false }),
        replyMessage: vi.fn(),
        sendMessage: vi.fn(),
        addReaction: vi.fn(),
        removeReaction: vi.fn(),
      } as unknown as Connector;

      const msg = {
        connector: "telegram", source: "telegram", sessionKey: "k1",
        replyContext: { channel: "ch", messageTs: null },
        messageId: undefined, channel: "ch", thread: undefined,
        user: "user1", userId: "user1", text: "hello", attachments: [], raw: {},
        transportMeta: undefined,
      };

      await manager.route(msg as never, connector);

      expect(vi.mocked(runSession)).toHaveBeenCalledOnce();
    });
  });
});
