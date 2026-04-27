import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, Target } from "../../../shared/types.js";

// ── Hoisted mock variables ────────────────────────────────────────────────────

const { mockSendMessage, mockSendPresenceUpdate, mockEvOn, mockEnd, mockUpdateMediaMessage, mockFormatResponse } =
  vi.hoisted(() => ({
    mockSendMessage: vi.fn().mockResolvedValue({}),
    mockSendPresenceUpdate: vi.fn().mockResolvedValue(undefined),
    mockEvOn: vi.fn(),
    mockEnd: vi.fn().mockResolvedValue(undefined),
    mockUpdateMediaMessage: vi.fn(),
    mockFormatResponse: vi.fn((text: string) => [text]),
  }));

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@whiskeysockets/baileys", () => {
  const mockSock = {
    ev: {
      on: mockEvOn,
    },
    sendMessage: mockSendMessage,
    sendPresenceUpdate: mockSendPresenceUpdate,
    end: mockEnd,
    updateMediaMessage: mockUpdateMediaMessage,
    user: {
      id: "15551234567:1@s.whatsapp.net",
      lid: "",
    },
  };

  const makeWASocket = vi.fn(() => mockSock);

  return {
    default: makeWASocket,
    makeWASocket,
    useMultiFileAuthState: vi.fn().mockResolvedValue({
      state: {},
      saveCreds: vi.fn(),
    }),
    fetchLatestWaWebVersion: vi.fn().mockResolvedValue({ version: [2, 3000, 0] }),
    downloadMediaMessage: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
    Browsers: {
      macOS: vi.fn(() => ["macOS", "Chrome", "120"]),
    },
    DisconnectReason: {
      loggedOut: 401,
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
  JINN_HOME: "/tmp/jinn-test",
}));

vi.mock("node:fs", () => ({
  default: {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

vi.mock("../format.js", () => ({
  formatResponse: mockFormatResponse,
}));

// Import after mocks are set up
const { WhatsAppConnector } = await import("../index.js");

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal WAMessage for testing */
function makeWAMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const futureTs = Math.floor(Date.now() / 1000) + 3600;
  return {
    key: {
      remoteJid: "15559876543@s.whatsapp.net",
      fromMe: false,
      id: "msg-001",
    },
    messageTimestamp: futureTs,
    message: {
      conversation: "Hello bot!",
    },
    ...overrides,
  };
}

/** Trigger the messages.upsert event registered on sock.ev.on */
async function triggerMessagesUpsert(messages: unknown[], type: "notify" | "append" = "notify"): Promise<void> {
  const call = mockEvOn.mock.calls.find((c: unknown[]) => c[0] === "messages.upsert");
  const cb = call?.[1] as ((payload: { messages: unknown[]; type: string }) => Promise<void>) | undefined;
  if (cb) {
    await cb({ messages, type });
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("WhatsAppConnector", () => {
  let connector: InstanceType<typeof WhatsAppConnector>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({});
    mockSendPresenceUpdate.mockResolvedValue(undefined);
    mockEnd.mockResolvedValue(undefined);
    mockFormatResponse.mockImplementation((text: string) => [text]);

    // Re-register mock ev.on after clearAllMocks
    mockEvOn.mockImplementation(vi.fn());

    connector = new WhatsAppConnector({
      allowFrom: ["15559876543@s.whatsapp.net"],
      ignoreOldMessagesOnBoot: false,
    });
  });

  // ── AC-E020-24: getCapabilities ───────────────────────────────────────────

  describe("AC-E020-24: getCapabilities", () => {
    it("returns threading=false / messageEdits=false / reactions=false / attachments=true", () => {
      expect(connector.getCapabilities()).toEqual({
        threading: false,
        messageEdits: false,
        reactions: false,
        attachments: true,
      });
    });
  });

  // ── AC-E020-27: getHealth ─────────────────────────────────────────────────

  describe("AC-E020-27: getHealth", () => {
    it("returns stopped before start", () => {
      const health = connector.getHealth();
      expect(health.status).toBe("stopped");
    });

    it("returns running after connection.update open event", async () => {
      await connector.start();

      // Trigger connection.update with connection='open'
      const call = mockEvOn.mock.calls.find((c: unknown[]) => c[0] === "connection.update");
      const cb = call?.[1] as ((update: Record<string, unknown>) => void) | undefined;
      cb?.({ connection: "open" });

      expect(connector.getHealth().status).toBe("running");
    });

    it("returns qr_pending after connection.update with qr", async () => {
      await connector.start();

      const call = mockEvOn.mock.calls.find((c: unknown[]) => c[0] === "connection.update");
      const cb = call?.[1] as ((update: Record<string, unknown>) => void) | undefined;
      cb?.({ qr: "qr-data-string" });

      expect(connector.getHealth().status).toBe("qr_pending");
    });

    it("returns stopped after stop()", async () => {
      await connector.start();

      const call = mockEvOn.mock.calls.find((c: unknown[]) => c[0] === "connection.update");
      const cb = call?.[1] as ((update: Record<string, unknown>) => void) | undefined;
      cb?.({ connection: "open" });

      await connector.stop();
      expect(connector.getHealth().status).toBe("stopped");
    });
  });

  // ── start/connect ─────────────────────────────────────────────────────────

  describe("start", () => {
    it("registers connection.update, creds.update, and messages.upsert handlers", async () => {
      await connector.start();

      const registeredEvents = mockEvOn.mock.calls.map((c: unknown[]) => c[0]);
      expect(registeredEvents).toContain("connection.update");
      expect(registeredEvents).toContain("creds.update");
      expect(registeredEvents).toContain("messages.upsert");
    });
  });

  // ── AC-E020-20: グループ JID フィルター ─────────────────────────────────

  describe("AC-E020-20: group JID filter (@g.us)", () => {
    it("does not call handler when remoteJid ends with @g.us", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const groupMsg = makeWAMessage({
        key: { remoteJid: "120363000000@g.us", fromMe: false, id: "msg-001" },
      });
      await triggerMessagesUpsert([groupMsg]);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── AC-E020-21: 自己送信フィルター ───────────────────────────────────────

  describe("AC-E020-21: fromMe filter (non-self-chat)", () => {
    it("does not call handler when fromMe=true and jid is not own JID", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      // fromMe=true で、allowFrom に含まれる JID だが自分の JID ではない
      const fromMeMsg = makeWAMessage({
        key: {
          remoteJid: "15559876543@s.whatsapp.net",
          fromMe: true,
          id: "msg-002",
        },
      });
      await triggerMessagesUpsert([fromMeMsg]);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── AC-E020-22: allowFrom フィルター ─────────────────────────────────────

  describe("AC-E020-22: allowFrom filter", () => {
    it("does not call handler when JID is not in allowFrom list", async () => {
      // allowFrom に "15559876543@s.whatsapp.net" のみ許可
      const restrictedConnector = new WhatsAppConnector({
        allowFrom: ["15559876543@s.whatsapp.net"],
        ignoreOldMessagesOnBoot: false,
      });
      const handler = vi.fn();
      restrictedConnector.onMessage(handler);
      await restrictedConnector.start();

      const unauthorizedMsg = makeWAMessage({
        key: {
          remoteJid: "99999999999@s.whatsapp.net",
          fromMe: false,
          id: "msg-003",
        },
      });
      await triggerMessagesUpsert([unauthorizedMsg]);

      expect(handler).not.toHaveBeenCalled();
    });

    it("calls handler when JID is in allowFrom list", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      // "15559876543@s.whatsapp.net" は allowFrom に含まれる
      const allowedMsg = makeWAMessage();
      await triggerMessagesUpsert([allowedMsg]);

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ── AC-E020-23: 正常系 IncomingMessage 構造検証 ───────────────────────────

  describe("AC-E020-23: normal IncomingMessage structure", () => {
    it("calls handler with correct IncomingMessage fields", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const futureTs = Math.floor(Date.now() / 1000) + 3600;
      const msg = makeWAMessage({
        key: {
          remoteJid: "15559876543@s.whatsapp.net",
          fromMe: false,
          id: "msg-key-001",
        },
        messageTimestamp: futureTs,
        message: { conversation: "Hello WhatsApp!" },
      });
      await triggerMessagesUpsert([msg]);

      expect(handler).toHaveBeenCalledOnce();
      const incoming: IncomingMessage = handler.mock.calls[0][0];
      expect(incoming.connector).toBe("whatsapp");
      expect(incoming.source).toBe("whatsapp");
      expect(incoming.sessionKey).toBe("whatsapp:15559876543@s.whatsapp.net");
      expect(incoming.channel).toBe("15559876543@s.whatsapp.net");
      expect(incoming.text).toBe("Hello WhatsApp!");
      expect(incoming.user).toBe("15559876543");
      expect(incoming.userId).toBe("15559876543@s.whatsapp.net");
      expect(incoming.messageId).toBe("msg-key-001");
      expect(incoming.replyContext).toEqual({
        channel: "15559876543@s.whatsapp.net",
        thread: null,
        messageTs: "msg-key-001",
      });
      expect(incoming.transportMeta).toEqual({ jid: "15559876543@s.whatsapp.net" });
    });

    it("reads text from extendedTextMessage.text when conversation is absent", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const msg = makeWAMessage({
        message: {
          extendedTextMessage: { text: "Extended text message" },
        },
      });
      await triggerMessagesUpsert([msg]);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].text).toBe("Extended text message");
    });

    it("reads text from imageMessage.caption when present", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const msg = makeWAMessage({
        message: {
          imageMessage: { caption: "Image caption text" },
        },
      });
      await triggerMessagesUpsert([msg]);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].text).toBe("Image caption text");
    });

    it("does not call handler when text is empty", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      const msg = makeWAMessage({
        message: { conversation: "   " },
      });
      await triggerMessagesUpsert([msg]);

      expect(handler).not.toHaveBeenCalled();
    });

    it("does not call handler when messages.upsert type is not notify", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.start();

      await triggerMessagesUpsert([makeWAMessage()], "append");

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── AC-E020-25: replyMessage → sock.sendMessage ───────────────────────────

  describe("AC-E020-25: replyMessage calls sock.sendMessage", () => {
    it("calls sock.sendMessage with target channel and text when connected", async () => {
      await connector.start();

      // Set connection status to running
      const call = mockEvOn.mock.calls.find((c: unknown[]) => c[0] === "connection.update");
      const cb = call?.[1] as ((update: Record<string, unknown>) => void) | undefined;
      cb?.({ connection: "open" });

      const target: Target = { channel: "15559876543@s.whatsapp.net" };
      await connector.replyMessage(target, "Hello from bot!");

      expect(mockSendMessage).toHaveBeenCalledOnce();
      expect(mockSendMessage).toHaveBeenCalledWith("15559876543@s.whatsapp.net", {
        text: "Hello from bot!",
      });
    });

    it("sends each chunk separately when formatResponse returns multiple chunks", async () => {
      mockFormatResponse.mockReturnValueOnce(["chunk one", "chunk two"]);
      await connector.start();

      const call = mockEvOn.mock.calls.find((c: unknown[]) => c[0] === "connection.update");
      const cb = call?.[1] as ((update: Record<string, unknown>) => void) | undefined;
      cb?.({ connection: "open" });

      const target: Target = { channel: "15559876543@s.whatsapp.net" };
      await connector.replyMessage(target, "long message");

      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, "15559876543@s.whatsapp.net", { text: "chunk one" });
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, "15559876543@s.whatsapp.net", { text: "chunk two" });
    });
  });

  // ── AC-E020-26: 未接続時 replyMessage → sock.sendMessage 不呼び出し ──────

  describe("AC-E020-26: replyMessage does not call sock.sendMessage when not running", () => {
    it("does not call sock.sendMessage before connection is established", async () => {
      // Not started — connectionStatus is 'starting', sock is null
      const target: Target = { channel: "15559876543@s.whatsapp.net" };
      await connector.replyMessage(target, "Hello!");

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("does not call sock.sendMessage when connectionStatus is qr_pending", async () => {
      await connector.start();

      // Set status to qr_pending (not running)
      const call = mockEvOn.mock.calls.find((c: unknown[]) => c[0] === "connection.update");
      const cb = call?.[1] as ((update: Record<string, unknown>) => void) | undefined;
      cb?.({ qr: "qr-data-string" });

      const target: Target = { channel: "15559876543@s.whatsapp.net" };
      await connector.replyMessage(target, "Hello!");

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  // ── AC-E020-28: reconstructTarget ────────────────────────────────────────

  describe("AC-E020-28: reconstructTarget", () => {
    it("returns correct Target from replyContext with channel and messageTs", () => {
      const target = connector.reconstructTarget({
        channel: "15559876543@s.whatsapp.net",
        thread: null,
        messageTs: "msg-abc-123",
      });
      expect(target.channel).toBe("15559876543@s.whatsapp.net");
      expect(target.thread).toBeUndefined();
      expect(target.messageTs).toBe("msg-abc-123");
    });

    it("returns empty channel string when channel is not a string", () => {
      const target = connector.reconstructTarget({
        channel: null,
        thread: null,
        messageTs: null,
      });
      expect(target.channel).toBe("");
      expect(target.thread).toBeUndefined();
      expect(target.messageTs).toBeUndefined();
    });

    it("returns correct Target when replyContext is null", () => {
      const target = connector.reconstructTarget(null);
      expect(target.channel).toBe("");
      expect(target.thread).toBeUndefined();
      expect(target.messageTs).toBeUndefined();
    });
  });
});
