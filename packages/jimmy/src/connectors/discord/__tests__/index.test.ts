import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, Target } from "../../../shared/types.js";

// ── Hoisted mock variables ────────────────────────────────────────────────────

const { mockLogin, mockDestroy, mockChannelsFetch, mockClientOn, mockFormatResponse } = vi.hoisted(() => ({
  mockLogin: vi.fn().mockResolvedValue(undefined),
  mockDestroy: vi.fn().mockResolvedValue(undefined),
  mockChannelsFetch: vi.fn(),
  mockClientOn: vi.fn(),
  mockFormatResponse: vi.fn((text: string) => [text]),
}));

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock discord.js Client constructor
vi.mock("discord.js", () => {
  const MockClient = vi.fn(function (this: Record<string, unknown>) {
    this.user = { tag: "TestBot#0001", id: "bot-self-id" };
    this.login = mockLogin;
    this.destroy = mockDestroy;
    this.channels = { fetch: mockChannelsFetch };
    this.on = mockClientOn;
  });

  return {
    Client: MockClient,
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
      DirectMessages: 8,
      GuildMessageReactions: 16,
    },
    Partials: {
      Channel: "Channel",
      Message: "Message",
    },
  };
});

vi.mock("../../../shared/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../shared/paths.js", () => ({
  TMP_DIR: "/tmp",
}));

vi.mock("../format.js", () => ({
  formatResponse: mockFormatResponse,
  downloadAttachment: vi.fn().mockResolvedValue("/tmp/test-file.png"),
}));

// Import after mocks are set up
const { DiscordConnector } = await import("../index.js");

// ── Helpers ──────────────────────────────────────────────────────────────────

type ChannelStub = {
  id: string;
  isTextBased: () => boolean;
  isDMBased: () => boolean;
  isThread: () => boolean;
  name?: string;
  send: ReturnType<typeof vi.fn>;
  messages: { fetch: ReturnType<typeof vi.fn> };
  sendTyping?: ReturnType<typeof vi.fn>;
};

function makeChannel(overrides: Partial<ChannelStub> = {}): ChannelStub {
  return {
    id: "channel-001",
    isTextBased: () => true,
    isDMBased: () => false,
    isThread: () => false,
    name: "general",
    send: vi.fn().mockResolvedValue({ id: "sent-msg-001" }),
    messages: { fetch: vi.fn() },
    sendTyping: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

type MessageStub = {
  id: string;
  content: string;
  author: { id: string; username: string; bot: boolean };
  guild: { id: string } | null;
  channel: ChannelStub;
  attachments: Map<string, unknown>;
  createdTimestamp: number;
};

function makeDiscordMessage(overrides: Partial<MessageStub> = {}): MessageStub {
  const channel = makeChannel();
  return {
    id: "msg-001",
    content: "Hello from Discord",
    author: { id: "user-001", username: "testuser", bot: false },
    guild: { id: "guild-001" },
    channel,
    attachments: new Map(),
    createdTimestamp: Date.now() + 10_000, // future → not old
    ...overrides,
  };
}

/** Grab the callback registered for a given event name via client.on(eventName, cb). */
function getClientEventCallback(eventName: string): ((...args: unknown[]) => Promise<void>) | undefined {
  const call = mockClientOn.mock.calls.find((c) => c[0] === eventName);
  return call?.[1] as ((...args: unknown[]) => Promise<void>) | undefined;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DiscordConnector", () => {
  let connector: InstanceType<typeof DiscordConnector>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-initialize default mock behaviors after clearAllMocks
    mockLogin.mockResolvedValue(undefined);
    mockDestroy.mockResolvedValue(undefined);
    mockFormatResponse.mockImplementation((text: string) => [text]);
    connector = new DiscordConnector({ botToken: "Bot token-123" });
  });

  // ── AC-E020-08: getHealth ─────────────────────────────────────────────────

  describe("AC-E020-08: getHealth", () => {
    it("returns stopped status before start", () => {
      const health = connector.getHealth();
      expect(health.status).toBe("stopped");
    });

    it("returns capabilities including threading and reactions", () => {
      const health = connector.getHealth();
      expect(health.capabilities).toEqual({
        threading: true,
        messageEdits: true,
        reactions: true,
        attachments: true,
      });
    });
  });

  // ── start / stop ──────────────────────────────────────────────────────────

  describe("start", () => {
    it("calls client.login with the bot token", async () => {
      await connector.start();
      expect(mockLogin).toHaveBeenCalledWith("Bot token-123");
    });

    it("registers messageCreate handler", async () => {
      await connector.start();
      const cb = getClientEventCallback("messageCreate");
      expect(cb).toBeDefined();
    });
  });

  describe("stop", () => {
    it("calls client.destroy and sets status to stopped", async () => {
      await connector.start();
      await connector.stop();
      expect(mockDestroy).toHaveBeenCalledOnce();
      expect(connector.getHealth().status).toBe("stopped");
    });
  });

  // ── AC-E020-01: bot filter ────────────────────────────────────────────────

  describe("AC-E020-01: bot message filter", () => {
    it("does not call handler for messages from bots", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const cb = getClientEventCallback("messageCreate");
      const botMsg = makeDiscordMessage({
        author: { id: "bot-id", username: "another_bot", bot: true },
      });
      await cb?.(botMsg);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── AC-E020-02: allowFrom filter ──────────────────────────────────────────

  describe("AC-E020-02: allowFrom filter", () => {
    it("does not call handler when user is not in allowFrom list", async () => {
      const restricted = new DiscordConnector({
        botToken: "Bot token-123",
        allowFrom: ["allowed-user-id"],
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const cb = getClientEventCallback("messageCreate");
      const msg = makeDiscordMessage({
        author: { id: "stranger-id", username: "stranger", bot: false },
      });
      await cb?.(msg);

      expect(handler).not.toHaveBeenCalled();
    });

    it("calls handler when user is in allowFrom list", async () => {
      const restricted = new DiscordConnector({
        botToken: "Bot token-123",
        allowFrom: ["allowed-user-id"],
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const cb = getClientEventCallback("messageCreate");
      const msg = makeDiscordMessage({
        author: { id: "allowed-user-id", username: "allowed", bot: false },
      });
      await cb?.(msg);

      expect(handler).toHaveBeenCalledOnce();
    });

    it("accepts allowFrom as a single string", async () => {
      const restricted = new DiscordConnector({
        botToken: "Bot token-123",
        allowFrom: "single-user-id",
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const cb = getClientEventCallback("messageCreate");
      const msg = makeDiscordMessage({
        author: { id: "single-user-id", username: "singleuser", bot: false },
      });
      await cb?.(msg);

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ── AC-E020-03: guildId filter ────────────────────────────────────────────

  describe("AC-E020-03: guildId filter", () => {
    it("does not call handler when message is from a different guild", async () => {
      const restricted = new DiscordConnector({
        botToken: "Bot token-123",
        guildId: "correct-guild",
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const cb = getClientEventCallback("messageCreate");
      const msg = makeDiscordMessage({ guild: { id: "wrong-guild" } });
      await cb?.(msg);

      expect(handler).not.toHaveBeenCalled();
    });

    it("calls handler when message is from the configured guild", async () => {
      const restricted = new DiscordConnector({
        botToken: "Bot token-123",
        guildId: "correct-guild",
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const cb = getClientEventCallback("messageCreate");
      const msg = makeDiscordMessage({ guild: { id: "correct-guild" } });
      await cb?.(msg);

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ── AC-E020-04: channelId filter ──────────────────────────────────────────

  describe("AC-E020-04: channelId filter", () => {
    it("does not call handler when message is from a different channel", async () => {
      const restricted = new DiscordConnector({
        botToken: "Bot token-123",
        channelId: "allowed-channel",
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const cb = getClientEventCallback("messageCreate");
      const wrongChannel = makeChannel({ id: "wrong-channel", isDMBased: () => false });
      const msg = makeDiscordMessage({ channel: wrongChannel });
      await cb?.(msg);

      expect(handler).not.toHaveBeenCalled();
    });

    it("calls handler when message is from the configured channel", async () => {
      const restricted = new DiscordConnector({
        botToken: "Bot token-123",
        channelId: "allowed-channel",
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const cb = getClientEventCallback("messageCreate");
      const correctChannel = makeChannel({ id: "allowed-channel", isDMBased: () => false });
      const msg = makeDiscordMessage({ channel: correctChannel });
      await cb?.(msg);

      expect(handler).toHaveBeenCalledOnce();
    });

    it("allows DM messages even when channelId filter is set", async () => {
      const restricted = new DiscordConnector({
        botToken: "Bot token-123",
        channelId: "allowed-channel",
      });
      const handler = vi.fn();
      restricted.onMessage(handler);
      await restricted.start();

      const cb = getClientEventCallback("messageCreate");
      const dmChannel = makeChannel({ id: "dm-channel-999", isDMBased: () => true });
      const msg = makeDiscordMessage({ channel: dmChannel, guild: null });
      await cb?.(msg);

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ── AC-E020-05: normal IncomingMessage structure ──────────────────────────

  describe("AC-E020-05: normal IncomingMessage structure", () => {
    it("builds IncomingMessage with correct fields", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const cb = getClientEventCallback("messageCreate");
      const channel = makeChannel({
        id: "channel-001",
        name: "general",
        isDMBased: () => false,
        isThread: () => false,
      });
      const msg = makeDiscordMessage({
        id: "msg-abc",
        content: "Hello bot!",
        author: { id: "user-xyz", username: "discord_user", bot: false },
        guild: { id: "guild-001" },
        channel,
      });
      await cb?.(msg);

      expect(handler).toHaveBeenCalledOnce();
      const incoming: IncomingMessage = handler.mock.calls[0][0];
      expect(incoming.source).toBe("discord");
      expect(incoming.text).toBe("Hello bot!");
      expect(incoming.user).toBe("discord_user");
      expect(incoming.userId).toBe("user-xyz");
      expect(incoming.channel).toBe("channel-001");
      expect(incoming.messageId).toBe("msg-abc");
      expect(incoming.sessionKey).toBe("discord:channel-001");
    });

    it("sets thread field when message is in a thread channel", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const cb = getClientEventCallback("messageCreate");
      const threadChannel = makeChannel({
        id: "thread-channel-001",
        isDMBased: () => false,
        isThread: () => true,
      });
      const msg = makeDiscordMessage({ channel: threadChannel });
      await cb?.(msg);

      const incoming: IncomingMessage = handler.mock.calls[0][0];
      expect(incoming.thread).toBe("thread-channel-001");
    });

    it("sets sessionKey as discord:dm:<userId> for DM messages", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const cb = getClientEventCallback("messageCreate");
      const dmChannel = makeChannel({ id: "dm-ch-001", isDMBased: () => true, isThread: () => false });
      const msg = makeDiscordMessage({
        channel: dmChannel,
        guild: null,
        author: { id: "user-dm-001", username: "dmuser", bot: false },
      });
      await cb?.(msg);

      const incoming: IncomingMessage = handler.mock.calls[0][0];
      expect(incoming.sessionKey).toBe("discord:dm:user-dm-001");
    });
  });

  // ── AC-E020-06: sendMessage → channel.send ────────────────────────────────

  describe("AC-E020-06: sendMessage", () => {
    it("calls channel.send and returns message id", async () => {
      const mockSend = vi.fn().mockResolvedValue({ id: "sent-id-001" });
      const ch = makeChannel({ send: mockSend });
      mockChannelsFetch.mockResolvedValue(ch);

      const target: Target = { channel: "channel-001" };
      const result = await connector.sendMessage(target, "Hello Discord");

      expect(mockSend).toHaveBeenCalledWith("Hello Discord");
      expect(result).toBe("sent-id-001");
    });

    it("returns the last message id when text is split into multiple chunks", async () => {
      mockFormatResponse.mockReturnValueOnce(["chunk1", "chunk2"]);

      const mockSend = vi.fn().mockResolvedValueOnce({ id: "id-chunk1" }).mockResolvedValueOnce({ id: "id-chunk2" });
      const ch = makeChannel({ send: mockSend });
      mockChannelsFetch.mockResolvedValue(ch);

      const target: Target = { channel: "channel-001" };
      const result = await connector.sendMessage(target, "long text");

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(result).toBe("id-chunk2");
    });
  });

  // ── AC-E020-07: sendMessage channel fetch failure ─────────────────────────

  describe("AC-E020-07: sendMessage channel fetch failure", () => {
    it("returns undefined and does not throw when channel fetch fails", async () => {
      mockChannelsFetch.mockRejectedValue(new Error("Unknown Channel"));

      const target: Target = { channel: "nonexistent-channel" };
      const result = await connector.sendMessage(target, "Hello");

      expect(result).toBeUndefined();
    });

    it("returns undefined when channel is not text-based", async () => {
      const nonTextChannel = {
        isTextBased: () => false,
      };
      mockChannelsFetch.mockResolvedValue(nonTextChannel);

      const target: Target = { channel: "voice-channel" };
      const result = await connector.sendMessage(target, "Hello");

      expect(result).toBeUndefined();
    });
  });

  // ── AC-E020-09: reconstructTarget ────────────────────────────────────────

  describe("AC-E020-09: reconstructTarget", () => {
    it("returns Target with channel from replyContext", () => {
      const target = connector.reconstructTarget({
        channel: "channel-001",
        thread: null,
        messageTs: "msg-001",
      });
      expect(target.channel).toBe("channel-001");
      expect(target.thread).toBeUndefined();
      expect(target.messageTs).toBe("msg-001");
    });

    it("returns Target with thread when replyContext has thread", () => {
      const target = connector.reconstructTarget({
        channel: "channel-001",
        thread: "thread-001",
        messageTs: "msg-002",
      });
      expect(target.channel).toBe("channel-001");
      expect(target.thread).toBe("thread-001");
      expect(target.messageTs).toBe("msg-002");
    });

    it("returns empty channel string when replyContext is null", () => {
      const target = connector.reconstructTarget(null);
      expect(target.channel).toBe("");
    });

    it("returns empty channel string when replyContext is undefined", () => {
      const target = connector.reconstructTarget(undefined);
      expect(target.channel).toBe("");
    });
  });

  // ── getEmployee ──────────────────────────────────────────────────────────

  describe("getEmployee", () => {
    it("returns undefined when employee is not configured", () => {
      expect(connector.getEmployee()).toBeUndefined();
    });

    it("returns the configured employee name", () => {
      const c = new DiscordConnector({ botToken: "tok", employee: "alice" });
      expect(c.getEmployee()).toBe("alice");
    });
  });

  // ── channelRouting / proxyToRemote ────────────────────────────────────────

  describe("channelRouting / proxyToRemote", () => {
    it("proxies message to remote URL when channelRouting matches channel id", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const routed = new DiscordConnector({
        botToken: "Bot token-123",
        channelRouting: { "routed-channel": "http://remote.example.com/" },
      });
      const handler = vi.fn();
      routed.onMessage(handler);
      await routed.start();

      const cb = getClientEventCallback("messageCreate");
      const channel = makeChannel({ id: "routed-channel", isDMBased: () => false });
      const msg = makeDiscordMessage({ channel });
      await cb?.(msg);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://remote.example.com/api/connectors/discord/incoming",
        expect.objectContaining({ method: "POST" }),
      );
      expect(handler).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("logs error when proxy response is not ok", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable" });
      vi.stubGlobal("fetch", mockFetch);

      const routed = new DiscordConnector({
        botToken: "Bot token-123",
        channelRouting: { "routed-channel": "http://remote.example.com" },
      });
      const handler = vi.fn();
      routed.onMessage(handler);
      await routed.start();

      const cb = getClientEventCallback("messageCreate");
      const channel = makeChannel({ id: "routed-channel" });
      const msg = makeDiscordMessage({ channel });
      await cb?.(msg);

      const { logger } = await import("../../../shared/logger.js");
      expect(logger.error).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("logs error when proxy fetch throws", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network failure"));
      vi.stubGlobal("fetch", mockFetch);

      const routed = new DiscordConnector({
        botToken: "Bot token-123",
        channelRouting: { "routed-channel": "http://remote.example.com" },
      });
      routed.onMessage(vi.fn());
      await routed.start();

      const cb = getClientEventCallback("messageCreate");
      const channel = makeChannel({ id: "routed-channel" });
      await cb?.(makeDiscordMessage({ channel }));

      const { logger } = await import("../../../shared/logger.js");
      expect(logger.error).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("strips trailing slashes from remote URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const routed = new DiscordConnector({
        botToken: "Bot token-123",
        channelRouting: { "routed-channel": "http://remote.example.com///" },
      });
      routed.onMessage(vi.fn());
      await routed.start();

      const cb = getClientEventCallback("messageCreate");
      const channel = makeChannel({ id: "routed-channel" });
      await cb?.(makeDiscordMessage({ channel }));

      expect(mockFetch).toHaveBeenCalledWith(
        "http://remote.example.com/api/connectors/discord/incoming",
        expect.any(Object),
      );

      vi.unstubAllGlobals();
    });
  });

  // ── channelRouting numeric key normalisation ───────────────────────────────

  describe("channelRouting numeric key normalisation", () => {
    it("converts numeric channelRouting keys to strings", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const routed = new DiscordConnector({
        botToken: "Bot token-123",
        // Simulate YAML-parsed numeric key
        channelRouting: { 123456789: "http://remote.example.com" } as Record<string, string>,
      });
      routed.onMessage(vi.fn());
      await routed.start();

      const cb = getClientEventCallback("messageCreate");
      const channel = makeChannel({ id: "123456789" });
      await cb?.(makeDiscordMessage({ channel }));

      expect(mockFetch).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  // ── transportMeta "dm" branch ─────────────────────────────────────────────

  describe("transportMeta channelName='dm' branch", () => {
    it("sets channelName to 'dm' when channel has no name property", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const cb = getClientEventCallback("messageCreate");
      // Channel without 'name' key → channelName branch falls to "dm"
      const noNameChannel: ChannelStub = {
        id: "dm-channel-no-name",
        isTextBased: () => false, // isTextBased false → goes to "dm"
        isDMBased: () => true,
        isThread: () => false,
        send: vi.fn(),
        messages: { fetch: vi.fn() },
      };
      const msg = makeDiscordMessage({ channel: noNameChannel, guild: null });
      await cb?.(msg);

      const incoming = handler.mock.calls[0][0];
      expect(incoming.transportMeta.channelName).toBe("dm");

      vi.unstubAllGlobals();
    });
  });

  // ── replyMessage ──────────────────────────────────────────────────────────

  describe("replyMessage", () => {
    it("sends to thread channel when target.thread is set", async () => {
      const mockSend = vi.fn().mockResolvedValue({ id: "reply-id" });
      const ch = makeChannel({ send: mockSend });
      mockChannelsFetch.mockResolvedValue(ch);

      const target: Target = { channel: "channel-001", thread: "thread-001" };
      const result = await connector.replyMessage(target, "Reply text");

      expect(mockChannelsFetch).toHaveBeenCalledWith("thread-001");
      expect(result).toBe("reply-id");
    });

    it("falls back to channel when thread is not set", async () => {
      const mockSend = vi.fn().mockResolvedValue({ id: "reply-id-2" });
      const ch = makeChannel({ send: mockSend });
      mockChannelsFetch.mockResolvedValue(ch);

      const target: Target = { channel: "channel-001" };
      const result = await connector.replyMessage(target, "Reply text");

      expect(mockChannelsFetch).toHaveBeenCalledWith("channel-001");
      expect(result).toBe("reply-id-2");
    });

    it("returns undefined when channel is not text-based", async () => {
      mockChannelsFetch.mockResolvedValue({ isTextBased: () => false });
      const target: Target = { channel: "voice-ch" };
      const result = await connector.replyMessage(target, "Reply");
      expect(result).toBeUndefined();
    });

    it("returns undefined when channel fetch throws", async () => {
      mockChannelsFetch.mockRejectedValue(new Error("fetch error"));
      const target: Target = { channel: "bad-ch" };
      const result = await connector.replyMessage(target, "Reply");
      expect(result).toBeUndefined();
    });
  });

  // ── editMessage ───────────────────────────────────────────────────────────

  describe("editMessage", () => {
    it("returns early when messageTs is not set", async () => {
      const target: Target = { channel: "channel-001" };
      await connector.editMessage(target, "Edit text");
      expect(mockChannelsFetch).not.toHaveBeenCalled();
    });

    it("fetches channel and calls msg.edit", async () => {
      const mockEdit = vi.fn().mockResolvedValue(undefined);
      const mockMsgFetch = vi.fn().mockResolvedValue({ edit: mockEdit });
      const ch = makeChannel({ messages: { fetch: mockMsgFetch } });
      mockChannelsFetch.mockResolvedValue(ch);

      const target: Target = { channel: "channel-001", messageTs: "msg-to-edit" };
      await connector.editMessage(target, "Edited content");

      expect(mockMsgFetch).toHaveBeenCalledWith("msg-to-edit");
      expect(mockEdit).toHaveBeenCalledWith("Edited content");
    });

    it("returns when channel is not text-based", async () => {
      mockChannelsFetch.mockResolvedValue({ isTextBased: () => false });
      const target: Target = { channel: "voice-ch", messageTs: "msg-id" };
      await connector.editMessage(target, "Edit text");
      // No error thrown
    });

    it("handles edit errors gracefully", async () => {
      mockChannelsFetch.mockRejectedValue(new Error("edit error"));
      const target: Target = { channel: "channel-001", messageTs: "msg-id" };
      await expect(connector.editMessage(target, "Edit text")).resolves.toBeUndefined();
    });
  });

  // ── addReaction / removeReaction ──────────────────────────────────────────

  describe("addReaction", () => {
    it("returns early when messageTs is not set", async () => {
      const target: Target = { channel: "channel-001" };
      await connector.addReaction(target, "thumbsup");
      expect(mockChannelsFetch).not.toHaveBeenCalled();
    });

    it("fetches channel and calls msg.react", async () => {
      const mockReact = vi.fn().mockResolvedValue(undefined);
      const mockMsgFetch = vi.fn().mockResolvedValue({ react: mockReact });
      const ch = makeChannel({ messages: { fetch: mockMsgFetch } });
      mockChannelsFetch.mockResolvedValue(ch);

      const target: Target = { channel: "channel-001", thread: "thread-001", messageTs: "msg-react" };
      await connector.addReaction(target, "star");

      expect(mockChannelsFetch).toHaveBeenCalledWith("thread-001");
      expect(mockReact).toHaveBeenCalledWith("star");
    });

    it("does not throw on fetch error (non-fatal)", async () => {
      mockChannelsFetch.mockRejectedValue(new Error("fetch error"));
      const target: Target = { channel: "channel-001", messageTs: "msg-id" };
      await expect(connector.addReaction(target, "star")).resolves.toBeUndefined();
    });

    it("returns when channel is not text-based (non-fatal)", async () => {
      mockChannelsFetch.mockResolvedValue({ isTextBased: () => false });
      const target: Target = { channel: "voice-ch", messageTs: "msg-id" };
      await connector.addReaction(target, "star");
    });
  });

  describe("removeReaction", () => {
    it("returns early when messageTs is not set", async () => {
      const target: Target = { channel: "channel-001" };
      await connector.removeReaction(target, "thumbsup");
      expect(mockChannelsFetch).not.toHaveBeenCalled();
    });

    it("fetches channel and calls msg.reactions.cache.get().users.remove", async () => {
      const mockUsersRemove = vi.fn().mockResolvedValue(undefined);
      const mockReactionsCache = {
        get: vi.fn().mockReturnValue({ users: { remove: mockUsersRemove } }),
      };
      const mockMsgFetch = vi.fn().mockResolvedValue({ reactions: { cache: mockReactionsCache } });
      const ch = makeChannel({ messages: { fetch: mockMsgFetch } });
      mockChannelsFetch.mockResolvedValue(ch);

      const target: Target = { channel: "channel-001", messageTs: "msg-remove" };
      await connector.removeReaction(target, "star");

      expect(mockReactionsCache.get).toHaveBeenCalledWith("star");
    });

    it("does not throw on fetch error (non-fatal)", async () => {
      mockChannelsFetch.mockRejectedValue(new Error("fetch error"));
      const target: Target = { channel: "channel-001", messageTs: "msg-id" };
      await expect(connector.removeReaction(target, "star")).resolves.toBeUndefined();
    });
  });

  // ── setTypingStatus ────────────────────────────────────────────────────────

  describe("setTypingStatus", () => {
    it("sends typing and sets interval when status is non-empty", async () => {
      const mockSendTyping = vi.fn().mockResolvedValue(undefined);
      const ch = makeChannel({ sendTyping: mockSendTyping, isTextBased: () => true });
      mockChannelsFetch.mockResolvedValue(ch);

      await connector.setTypingStatus("channel-001", undefined, "typing");

      expect(mockSendTyping).toHaveBeenCalledOnce();
    });

    it("clears existing interval and sets new one when called twice", async () => {
      const mockSendTyping = vi.fn().mockResolvedValue(undefined);
      const ch = makeChannel({ sendTyping: mockSendTyping, isTextBased: () => true });
      mockChannelsFetch.mockResolvedValue(ch);

      await connector.setTypingStatus("channel-001", undefined, "typing");
      mockSendTyping.mockClear();
      await connector.setTypingStatus("channel-001", undefined, "typing");

      expect(mockSendTyping).toHaveBeenCalledOnce();
    });

    it("does not fetch channel when status is empty string", async () => {
      await connector.setTypingStatus("channel-001", undefined, "");
      expect(mockChannelsFetch).not.toHaveBeenCalled();
    });

    it("does not throw when channel is not text-based (non-fatal)", async () => {
      mockChannelsFetch.mockResolvedValue({ isTextBased: () => false });
      await expect(connector.setTypingStatus("channel-001", undefined, "typing")).resolves.toBeUndefined();
    });

    it("does not throw when channel fetch throws (non-fatal)", async () => {
      mockChannelsFetch.mockRejectedValue(new Error("fetch error"));
      await expect(connector.setTypingStatus("channel-001", undefined, "typing")).resolves.toBeUndefined();
    });
  });

  // ── error event handler ───────────────────────────────────────────────────

  describe("error event handler", () => {
    it("sets status to error and stores lastError on client error event", async () => {
      await connector.start();
      const errorCb = getClientEventCallback("error");
      errorCb?.(new Error("test error"));
      expect(connector.getHealth().status).toBe("error");
      expect(connector.getHealth().detail).toBe("test error");
    });
  });

  // ── ready event handler ───────────────────────────────────────────────────

  describe("ready event handler", () => {
    it("sets status to running when ready event fires", async () => {
      await connector.start();
      const readyCb = getClientEventCallback("ready");
      readyCb?.();
      expect(connector.getHealth().status).toBe("running");
    });
  });

  // ── messageCreate error handling ──────────────────────────────────────────

  describe("messageCreate error handling", () => {
    it("catches errors thrown in handleMessage without crashing", async () => {
      // handler that throws
      connector.onMessage(() => {
        throw new Error("handler error");
      });
      await connector.start();

      const cb = getClientEventCallback("messageCreate");
      const msg = makeDiscordMessage();
      // Should not propagate the error
      await expect(cb?.(msg)).resolves.toBeUndefined();
    });
  });

  // ── no handler registered ─────────────────────────────────────────────────

  describe("no handler registered", () => {
    it("does not crash when handler is null and message arrives", async () => {
      // handler not registered
      await connector.start();
      const cb = getClientEventCallback("messageCreate");
      const msg = makeDiscordMessage();
      await expect(cb?.(msg)).resolves.toBeUndefined();
    });
  });

  // ── ignoreOldMessagesOnBoot ───────────────────────────────────────────────

  describe("ignoreOldMessagesOnBoot", () => {
    it("ignores old messages when ignoreOldMessagesOnBoot is true (default)", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const cb = getClientEventCallback("messageCreate");
      // Old timestamp in the past
      const msg = makeDiscordMessage({ createdTimestamp: Date.now() - 120_000 });
      await cb?.(msg);

      expect(handler).not.toHaveBeenCalled();
    });

    it("does not ignore old messages when ignoreOldMessagesOnBoot is false", async () => {
      const c = new DiscordConnector({ botToken: "tok", ignoreOldMessagesOnBoot: false });
      const handler = vi.fn();
      c.onMessage(handler);
      await c.start();

      const cb = getClientEventCallback("messageCreate");
      const msg = makeDiscordMessage({ createdTimestamp: Date.now() - 120_000 });
      await cb?.(msg);

      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
