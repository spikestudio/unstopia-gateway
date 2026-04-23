import { describe, expect, it } from "vitest";
import { buildReplyContext, deriveSessionKey, isOldSlackMessage } from "../threads.js";

describe("AC-E003-01: deriveSessionKey", () => {
  it("keeps DM sessions per user", () => {
    const key = deriveSessionKey({
      channel: "D123",
      user: "U123",
      channel_type: "im",
      ts: "1700000000.000100",
    });
    expect(key).toBe("slack:dm:U123");
  });

  it("uses ts for channel root messages", () => {
    const key = deriveSessionKey({
      channel: "C123",
      user: "U123",
      ts: "1700000000.000100",
    });
    expect(key).toBe("slack:C123:1700000000.000100");
  });

  it("uses thread_ts for thread replies (matches root)", () => {
    const key = deriveSessionKey({
      channel: "C123",
      user: "U123",
      ts: "1700000100.000200",
      thread_ts: "1700000000.000100",
    });
    expect(key).toBe("slack:C123:1700000000.000100");
  });

  it("treats same-ts thread_ts as root message", () => {
    const key = deriveSessionKey({
      channel: "C123",
      user: "U123",
      ts: "1700000000.000100",
      thread_ts: "1700000000.000100",
    });
    expect(key).toBe("slack:C123:1700000000.000100");
  });
});

describe("AC-E003-01: buildReplyContext", () => {
  it("sets thread for channel root messages", () => {
    const context = buildReplyContext({
      channel: "C123",
      ts: "1700000000.000100",
      channel_type: "channel",
    });
    expect(context).toEqual({
      channel: "C123",
      thread: "1700000000.000100",
      messageTs: "1700000000.000100",
    });
  });

  it("sets thread_ts for thread replies", () => {
    const context = buildReplyContext({
      channel: "C123",
      ts: "1700000100.000200",
      thread_ts: "1700000000.000100",
    });
    expect(context).toEqual({
      channel: "C123",
      thread: "1700000000.000100",
      messageTs: "1700000100.000200",
    });
  });

  it("does NOT set thread for DMs", () => {
    const context = buildReplyContext({
      channel: "D123",
      ts: "1700000000.000100",
      channel_type: "im",
    });
    expect(context).toEqual({
      channel: "D123",
      thread: null,
      messageTs: "1700000000.000100",
    });
  });
});

describe("AC-E003-01: isOldSlackMessage", () => {
  it("compares against boot time", () => {
    expect(isOldSlackMessage("1700000000.000100", 1700000001000)).toBe(true);
    expect(isOldSlackMessage("1700000002.000100", 1700000001000)).toBe(false);
  });
});
