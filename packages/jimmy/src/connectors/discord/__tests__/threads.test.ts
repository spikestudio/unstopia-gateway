import type { Message } from "discord.js";
import { describe, expect, it } from "vitest";
import { buildReplyContext, deriveSessionKey, isOldMessage } from "../threads.js";

// ---------------------------------------------------------------------------
// Helper: construct a minimal discord.js Message stub
// ---------------------------------------------------------------------------
type ChannelStub = {
  id: string;
  isDMBased: () => boolean;
  isThread: () => boolean;
};

function makeMessage(opts: {
  channelId: string;
  authorId?: string;
  messageId?: string;
  guildId?: string;
  isDM?: boolean;
  isThread?: boolean;
}): Message {
  const channel: ChannelStub = {
    id: opts.channelId,
    isDMBased: () => opts.isDM ?? false,
    isThread: () => opts.isThread ?? false,
  };
  return {
    id: opts.messageId ?? "msg-001",
    author: { id: opts.authorId ?? "user-001" },
    channel,
    guild: opts.guildId ? { id: opts.guildId } : null,
  } as unknown as Message;
}

// ---------------------------------------------------------------------------
// deriveSessionKey
// ---------------------------------------------------------------------------
describe("AC-E003-04: deriveSessionKey", () => {
  it("returns discord:dm:<authorId> for a DM channel", () => {
    const msg = makeMessage({ channelId: "dm-channel-1", authorId: "user-123", isDM: true });
    expect(deriveSessionKey(msg)).toBe("discord:dm:user-123");
  });

  it("returns discord:thread:<channelId> for a thread channel", () => {
    const msg = makeMessage({ channelId: "thread-456", isThread: true });
    expect(deriveSessionKey(msg)).toBe("discord:thread:thread-456");
  });

  it("returns discord:<channelId> for a regular guild channel", () => {
    const msg = makeMessage({ channelId: "channel-789" });
    expect(deriveSessionKey(msg)).toBe("discord:channel-789");
  });

  it("respects a custom prefix", () => {
    const msg = makeMessage({ channelId: "channel-001" });
    expect(deriveSessionKey(msg, "mybot")).toBe("mybot:channel-001");
  });

  it("applies custom prefix to DM sessions", () => {
    const msg = makeMessage({ channelId: "dm-001", authorId: "user-42", isDM: true });
    expect(deriveSessionKey(msg, "gateway")).toBe("gateway:dm:user-42");
  });
});

// ---------------------------------------------------------------------------
// buildReplyContext
// ---------------------------------------------------------------------------
describe("AC-E003-04: buildReplyContext", () => {
  it("sets thread to null for a regular channel", () => {
    const msg = makeMessage({
      channelId: "C-100",
      messageId: "msg-001",
      guildId: "guild-99",
    });
    expect(buildReplyContext(msg)).toEqual({
      channel: "C-100",
      thread: null,
      messageTs: "msg-001",
      guildId: "guild-99",
    });
  });

  it("sets thread to the channel id for a thread", () => {
    const msg = makeMessage({
      channelId: "T-200",
      messageId: "msg-002",
      guildId: "guild-99",
      isThread: true,
    });
    expect(buildReplyContext(msg)).toEqual({
      channel: "T-200",
      thread: "T-200",
      messageTs: "msg-002",
      guildId: "guild-99",
    });
  });

  it("sets guildId to null when there is no guild (DM)", () => {
    const msg = makeMessage({
      channelId: "D-300",
      messageId: "msg-003",
      authorId: "user-55",
      isDM: true,
      // no guildId
    });
    expect(buildReplyContext(msg)).toEqual({
      channel: "D-300",
      thread: null,
      messageTs: "msg-003",
      guildId: null,
    });
  });
});

// ---------------------------------------------------------------------------
// isOldMessage
// ---------------------------------------------------------------------------
describe("AC-E003-04: isOldMessage", () => {
  it("returns true when the message was created before boot time", () => {
    const bootTimeMs = 1700000000000;
    const createdTimestamp = bootTimeMs - 1; // 1 ms before boot
    expect(isOldMessage(createdTimestamp, bootTimeMs)).toBe(true);
  });

  it("returns false when the message was created after boot time", () => {
    const bootTimeMs = 1700000000000;
    const createdTimestamp = bootTimeMs + 1; // 1 ms after boot
    expect(isOldMessage(createdTimestamp, bootTimeMs)).toBe(false);
  });

  it("returns false when the message timestamp equals boot time", () => {
    const bootTimeMs = 1700000000000;
    expect(isOldMessage(bootTimeMs, bootTimeMs)).toBe(false);
  });
});
