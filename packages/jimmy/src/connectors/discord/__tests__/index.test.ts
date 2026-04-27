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
});
