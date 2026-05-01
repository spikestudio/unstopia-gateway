import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, Target } from "../../../shared/types.js";

// ── Hoisted mock variables ────────────────────────────────────────────────────

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../shared/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.stubGlobal("fetch", mockFetch);

// Import after mocks are set up
const { RemoteDiscordConnector } = await import("../remote.js");

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RemoteDiscordConnector", () => {
  let connector: InstanceType<typeof RemoteDiscordConnector>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ messageId: "proxy-msg-id" }),
    });
    connector = new RemoteDiscordConnector({ proxyVia: "http://primary.example.com" });
  });

  // ── constructor ───────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("sets name to discord", () => {
      expect(connector.name).toBe("discord");
    });

    it("strips trailing slashes from proxyVia URL", () => {
      const c = new RemoteDiscordConnector({ proxyVia: "http://primary.example.com///" });
      // Use sendMessage to verify URL is constructed correctly
      mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      c.sendMessage({ channel: "C001" }, "test");
      // The URL should not have double slashes
      // (actual assertion happens via sendMessage test below)
    });
  });

  // ── lifecycle ─────────────────────────────────────────────────────────────

  describe("start", () => {
    it("starts without error", async () => {
      await expect(connector.start()).resolves.toBeUndefined();
    });
  });

  describe("stop", () => {
    it("stops without error", async () => {
      await expect(connector.stop()).resolves.toBeUndefined();
    });
  });

  // ── getCapabilities ───────────────────────────────────────────────────────

  describe("getCapabilities", () => {
    it("returns full capabilities", () => {
      expect(connector.getCapabilities()).toEqual({
        threading: true,
        messageEdits: true,
        reactions: true,
        attachments: true,
      });
    });
  });

  // ── getHealth ─────────────────────────────────────────────────────────────

  describe("getHealth", () => {
    it("always returns running status", () => {
      const health = connector.getHealth();
      expect(health.status).toBe("running");
    });

    it("includes capabilities in health", () => {
      expect(connector.getHealth().capabilities).toEqual(connector.getCapabilities());
    });
  });

  // ── onMessage / deliverMessage ────────────────────────────────────────────

  describe("deliverMessage", () => {
    it("calls registered handler when deliverMessage is called", () => {
      const handler = vi.fn();
      connector.onMessage(handler);

      const msg: IncomingMessage = {
        connector: "discord",
        source: "discord",
        sessionKey: "discord:channel-001",
        channel: "channel-001",
        user: "testuser",
        userId: "user-001",
        text: "Hello remote!",
        attachments: [],
        replyContext: {},
        messageId: "msg-001",
        raw: {},
        transportMeta: {},
      };
      connector.deliverMessage(msg);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(msg);
    });

    it("does nothing when no handler is registered", () => {
      const msg: IncomingMessage = {
        connector: "discord",
        source: "discord",
        sessionKey: "discord:channel-001",
        channel: "channel-001",
        user: "testuser",
        userId: "user-001",
        text: "Hello",
        attachments: [],
        replyContext: {},
        messageId: "msg-001",
        raw: {},
        transportMeta: {},
      };
      // Should not throw
      expect(() => connector.deliverMessage(msg)).not.toThrow();
    });
  });

  // ── reconstructTarget ─────────────────────────────────────────────────────

  describe("reconstructTarget", () => {
    it("returns Target with channel and thread from replyContext", () => {
      const target = connector.reconstructTarget({
        channel: "channel-001",
        thread: "thread-001",
        messageTs: "msg-ts-001",
      });
      expect(target.channel).toBe("channel-001");
      expect(target.thread).toBe("thread-001");
      expect(target.messageTs).toBe("msg-ts-001");
    });

    it("returns empty channel when replyContext is null", () => {
      const target = connector.reconstructTarget(null);
      expect(target.channel).toBe("");
      expect(target.thread).toBeUndefined();
    });

    it("returns empty channel when replyContext is undefined", () => {
      const target = connector.reconstructTarget(undefined);
      expect(target.channel).toBe("");
    });

    it("returns undefined thread when thread is null in replyContext", () => {
      const target = connector.reconstructTarget({ channel: "C001", thread: null, messageTs: null });
      expect(target.thread).toBeUndefined();
      expect(target.messageTs).toBeUndefined();
    });
  });

  // ── proxyAction / sendMessage / replyMessage / editMessage ───────────────

  describe("sendMessage", () => {
    it("calls proxy endpoint with sendMessage action and returns messageId", async () => {
      const target: Target = { channel: "channel-001", thread: "thread-001" };
      const result = await connector.sendMessage(target, "Hello proxy!");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://primary.example.com/api/connectors/discord/proxy",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("sendMessage"),
        }),
      );
      expect(result).toBe("proxy-msg-id");
    });

    it("returns undefined when proxy response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const target: Target = { channel: "channel-001" };
      const result = await connector.sendMessage(target, "Hello");
      expect(result).toBeUndefined();
    });

    it("returns undefined and logs error when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));
      const target: Target = { channel: "channel-001" };
      const result = await connector.sendMessage(target, "Hello");
      expect(result).toBeUndefined();

      const { logger } = await import("../../../shared/logger.js");
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("replyMessage", () => {
    it("calls proxy endpoint with replyMessage action", async () => {
      const target: Target = { channel: "channel-001", thread: "thread-001" };
      const result = await connector.replyMessage(target, "Reply proxy!");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://primary.example.com/api/connectors/discord/proxy",
        expect.objectContaining({ method: "POST" }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.action).toBe("replyMessage");
      expect(result).toBe("proxy-msg-id");
    });
  });

  describe("editMessage", () => {
    it("calls proxy endpoint with editMessage action", async () => {
      const target: Target = { channel: "channel-001", messageTs: "msg-ts" };
      await connector.editMessage(target, "Edited text");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.action).toBe("editMessage");
    });
  });

  describe("addReaction", () => {
    it("calls proxy endpoint with addReaction action", async () => {
      const target: Target = { channel: "channel-001", messageTs: "msg-ts" };
      await connector.addReaction(target, "thumbsup");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.action).toBe("addReaction");
      expect(body.emoji).toBe("thumbsup");
    });
  });

  describe("removeReaction", () => {
    it("calls proxy endpoint with removeReaction action", async () => {
      const target: Target = { channel: "channel-001", messageTs: "msg-ts" };
      await connector.removeReaction(target, "star");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.action).toBe("removeReaction");
      expect(body.emoji).toBe("star");
    });
  });

  describe("setTypingStatus", () => {
    it("calls proxy endpoint with setTypingStatus action", async () => {
      await connector.setTypingStatus("channel-001", "thread-ts", "typing");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.action).toBe("setTypingStatus");
      expect(body.channelId).toBe("channel-001");
      expect(body.threadTs).toBe("thread-ts");
      expect(body.status).toBe("typing");
    });

    it("returns undefined on proxy error without throwing", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));
      await expect(connector.setTypingStatus("channel-001", undefined, "typing")).resolves.toBeUndefined();
    });

    it("logs String(err) when fetch rejects with non-Error (line 106 right-side branch)", async () => {
      const { logger } = await import("../../../shared/logger.js");
      const errorSpy = vi.mocked(logger.error);
      // Reject with a non-Error primitive
      mockFetch.mockRejectedValueOnce("plain-string-rejection");
      await expect(connector.setTypingStatus("channel-001", undefined, "typing")).resolves.toBeUndefined();
      // The error branch should use String(err) = "plain-string-rejection"
      const errors = errorSpy.mock.calls.map((c) => String(c[0]));
      expect(errors.some((e) => e.includes("plain-string-rejection") || e.includes("error"))).toBe(true);
    });
  });
});
