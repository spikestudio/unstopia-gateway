import { describe, expect, it, vi } from "vitest";
import type { Connector, ReplyContext, Target } from "../../../shared/types.js";

vi.mock("../../../shared/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { CronConnector } from "../index.js";

function makeConnectorMap(name: string, connector: Partial<Connector>): Map<string, Connector> {
  return new Map([[name, connector as Connector]]);
}

describe("AC-E003-03: CronConnector", () => {
  describe("constructor and identity", () => {
    it("sets name to 'cron'", () => {
      const c = new CronConnector(new Map());
      expect(c.name).toBe("cron");
    });

    it("creates without delivery option", () => {
      const c = new CronConnector(new Map());
      expect(c.name).toBe("cron");
    });

    it("creates with delivery option", () => {
      const c = new CronConnector(new Map(), { connector: "slack", channel: "#general" });
      expect(c.name).toBe("cron");
    });
  });

  describe("getCapabilities", () => {
    it("returns expected capabilities", () => {
      const c = new CronConnector(new Map());
      const caps = c.getCapabilities();
      expect(caps.threading).toBe(false);
      expect(caps.messageEdits).toBe(false);
      expect(caps.reactions).toBe(false);
      expect(caps.attachments).toBe(false);
    });
  });

  describe("getHealth", () => {
    it("returns running status", () => {
      const c = new CronConnector(new Map());
      const health = c.getHealth();
      expect(health.status).toBe("running");
    });
  });

  describe("reconstructTarget", () => {
    it("uses string channel from replyContext", () => {
      const c = new CronConnector(new Map());
      const rc: ReplyContext = { channel: "chan-1", messageTs: "ts-1", thread: "thread-1" };
      const target = c.reconstructTarget(rc);
      expect(target.channel).toBe("chan-1");
      expect(target.messageTs).toBe("ts-1");
      expect(target.thread).toBe("thread-1");
    });

    it("falls back to empty string when channel is not a string", () => {
      const c = new CronConnector(new Map());
      const rc: ReplyContext = { channel: null, messageTs: null, thread: null };
      const target = c.reconstructTarget(rc);
      expect(target.channel).toBe("");
      expect(target.messageTs).toBeUndefined();
      expect(target.thread).toBeUndefined();
    });
  });

  describe("sendMessage", () => {
    it("returns undefined when no delivery is configured", async () => {
      const c = new CronConnector(new Map());
      const result = await c.sendMessage({ channel: "c" }, "hello");
      expect(result).toBeUndefined();
    });

    it("returns undefined when delivery connector is not found", async () => {
      const c = new CronConnector(new Map(), { connector: "slack", channel: "#g" });
      // connectors map is empty → connector not found
      const result = await c.sendMessage({ channel: "c" }, "hello");
      expect(result).toBeUndefined();
    });

    it("delegates to connector.sendMessage when delivery is configured", async () => {
      const mockSend = vi.fn().mockResolvedValue("msg-id-1");
      const connectors = makeConnectorMap("slack", { sendMessage: mockSend });
      const c = new CronConnector(connectors, { connector: "slack", channel: "#general" });
      const result = await c.sendMessage({ channel: "" }, "hello world");
      expect(mockSend).toHaveBeenCalledOnce();
      expect(result).toBe("msg-id-1");
    });

    it("uses delivery.channel when target.channel is empty", async () => {
      const mockSend = vi.fn().mockResolvedValue(undefined);
      const connectors = makeConnectorMap("slack", { sendMessage: mockSend });
      const c = new CronConnector(connectors, { connector: "slack", channel: "#fallback" });
      await c.sendMessage({ channel: "" }, "hi");
      const [target] = mockSend.mock.calls[0];
      expect((target as Target).channel).toBe("#fallback");
    });
  });

  describe("replyMessage", () => {
    it("delegates to connector.replyMessage when delivery is configured", async () => {
      const mockReply = vi.fn().mockResolvedValue("reply-id");
      const connectors = makeConnectorMap("slack", { replyMessage: mockReply });
      const c = new CronConnector(connectors, { connector: "slack", channel: "#g" });
      const result = await c.replyMessage({ channel: "c" }, "reply text");
      expect(mockReply).toHaveBeenCalledOnce();
      expect(result).toBe("reply-id");
    });
  });

  describe("editMessage", () => {
    it("returns early when no delivery is configured", async () => {
      const mockEdit = vi.fn();
      const connectors = makeConnectorMap("slack", { editMessage: mockEdit });
      const c = new CronConnector(connectors); // no delivery
      await c.editMessage({ channel: "c" }, "edited");
      expect(mockEdit).not.toHaveBeenCalled();
    });

    it("returns early when connector does not support messageEdits", async () => {
      const mockEdit = vi.fn();
      const connectors = makeConnectorMap("slack", {
        editMessage: mockEdit,
        getCapabilities: () => ({
          threading: false, messageEdits: false, reactions: false, attachments: false,
        }),
      });
      const c = new CronConnector(connectors, { connector: "slack", channel: "#g" });
      await c.editMessage({ channel: "c" }, "edited");
      expect(mockEdit).not.toHaveBeenCalled();
    });

    it("delegates to connector.editMessage when messageEdits is supported", async () => {
      const mockEdit = vi.fn().mockResolvedValue(undefined);
      const connectors = makeConnectorMap("slack", {
        editMessage: mockEdit,
        getCapabilities: () => ({
          threading: false, messageEdits: true, reactions: false, attachments: false,
        }),
      });
      const c = new CronConnector(connectors, { connector: "slack", channel: "#g" });
      await c.editMessage({ channel: "c", messageTs: "ts1" }, "edited text");
      expect(mockEdit).toHaveBeenCalledOnce();
    });
  });

  describe("start / stop / addReaction / removeReaction / onMessage", () => {
    it("start is a no-op", async () => {
      const c = new CronConnector(new Map());
      await expect(c.start()).resolves.toBeUndefined();
    });

    it("stop is a no-op", async () => {
      const c = new CronConnector(new Map());
      await expect(c.stop()).resolves.toBeUndefined();
    });

    it("addReaction is a no-op", async () => {
      // CronConnector は send-only — addReaction は no-op
      // Connector インターフェース経由で呼び出すことでインターフェース契約を検証する
      const c: Connector = new CronConnector(new Map());
      await expect(c.addReaction({ channel: "c" }, "👍")).resolves.toBeUndefined();
    });

    it("removeReaction is a no-op", async () => {
      // CronConnector は send-only — removeReaction は no-op
      // Connector インターフェース経由で呼び出すことでインターフェース契約を検証する
      const c: Connector = new CronConnector(new Map());
      await expect(c.removeReaction({ channel: "c" }, "👍")).resolves.toBeUndefined();
    });

    it("onMessage is a no-op", () => {
      const c = new CronConnector(new Map());
      expect(() => c.onMessage(() => {})).not.toThrow();
    });
  });
});
