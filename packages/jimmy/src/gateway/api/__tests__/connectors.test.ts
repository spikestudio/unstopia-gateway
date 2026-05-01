import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../../types.js";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../shared/paths.js", () => ({
  TMP_DIR: "/tmp/fake",
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,abc") },
}));
vi.mock("../../../connectors/discord/format.js", () => ({
  downloadAttachment: vi.fn().mockResolvedValue("/tmp/fake/file.png"),
}));

import { handleConnectorsRequest } from "../connectors.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const makeRes = (): ServerResponse =>
  ({
    writeHead: vi.fn(),
    end: vi.fn(),
  }) as unknown as ServerResponse;

const makeReq = (bodyObj: unknown = {}): never => {
  const bodyStr = JSON.stringify(bodyObj);
  return {
    headers: { "content-type": "application/json" },
    on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
      if (event === "data") cb(Buffer.from(bodyStr));
      if (event === "end") cb();
    }),
  } as never;
};

const makeConnector = (overrides: Record<string, unknown> = {}) => ({
  name: "discord",
  getHealth: vi.fn().mockReturnValue({ connected: true, status: "ok" }),
  getEmployee: vi.fn().mockReturnValue("alice"),
  sendMessage: vi.fn().mockResolvedValue("msg-id-1"),
  replyMessage: vi.fn().mockResolvedValue("msg-id-2"),
  editMessage: vi.fn().mockResolvedValue(undefined),
  addReaction: vi.fn().mockResolvedValue(undefined),
  removeReaction: vi.fn().mockResolvedValue(undefined),
  setTypingStatus: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeContext = (connectors: Map<string, unknown> = new Map()): ApiContext =>
  ({
    emit: vi.fn(),
    connectors,
    sessionManager: {
      getEngine: vi.fn().mockReturnValue(null),
      getQueue: vi.fn().mockReturnValue({ getPendingCount: vi.fn().mockReturnValue(0), getTransportState: vi.fn() }),
    },
    getConfig: vi.fn().mockReturnValue({}),
    startTime: Date.now(),
  }) as unknown as ApiContext;

const getResponseBody = (res: ServerResponse): unknown => {
  const endMock = res.end as ReturnType<typeof vi.fn>;
  return JSON.parse(endMock.mock.calls[0][0]);
};

const getStatusCode = (res: ServerResponse): number => {
  const writeHeadMock = res.writeHead as ReturnType<typeof vi.fn>;
  return writeHeadMock.mock.calls[0][0];
};

// ── POST /api/connectors/reload ────────────────────────────────────────────

describe("POST /api/connectors/reload", () => {
  it("returns 501 when reloadConnectorInstances not available", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleConnectorsRequest(makeReq(), res, context, "POST", "/api/connectors/reload");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(501);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.error).toMatch(/not available/i);
  });

  it("calls reloadConnectorInstances and emits event on success", async () => {
    const reloadResult = { started: ["slack"], stopped: [], errors: [] };
    const context = makeContext();
    context.reloadConnectorInstances = vi.fn().mockResolvedValue(reloadResult);
    const res = makeRes();
    const handled = await handleConnectorsRequest(makeReq(), res, context, "POST", "/api/connectors/reload");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    expect(context.emit).toHaveBeenCalledWith("connectors:reloaded", reloadResult);
  });

  it("returns 500 when reload throws", async () => {
    const context = makeContext();
    context.reloadConnectorInstances = vi.fn().mockRejectedValue(new Error("reload failed"));
    const res = makeRes();
    await handleConnectorsRequest(makeReq(), res, context, "POST", "/api/connectors/reload");
    expect(getStatusCode(res)).toBe(500);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.error).toBe("reload failed");
  });

  it("returns 500 with string when non-Error thrown", async () => {
    const context = makeContext();
    context.reloadConnectorInstances = vi.fn().mockRejectedValue("string error");
    const res = makeRes();
    await handleConnectorsRequest(makeReq(), res, context, "POST", "/api/connectors/reload");
    expect(getStatusCode(res)).toBe(500);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });
});

// ── GET /api/connectors/whatsapp/qr ───────────────────────────────────────

describe("GET /api/connectors/whatsapp/qr", () => {
  it("returns 404 when whatsapp connector not found", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleConnectorsRequest(makeReq(), res, context, "GET", "/api/connectors/whatsapp/qr");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("returns qr=null when no QR code available", async () => {
    const waConnector = { getQrCode: vi.fn().mockReturnValue(null) };
    const connectors = new Map([["whatsapp", waConnector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    await handleConnectorsRequest(makeReq(), res, context, "GET", "/api/connectors/whatsapp/qr");
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.qr).toBeNull();
  });

  it("returns QR code data URL when QR string available", async () => {
    const waConnector = { getQrCode: vi.fn().mockReturnValue("raw-qr-string") };
    const connectors = new Map([["whatsapp", waConnector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    await handleConnectorsRequest(makeReq(), res, context, "GET", "/api/connectors/whatsapp/qr");
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.qr).toContain("data:image/png");
  });
});

// ── GET /api/connectors ────────────────────────────────────────────────────

describe("GET /api/connectors", () => {
  it("returns empty array with no connectors", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleConnectorsRequest(makeReq(), res, context, "GET", "/api/connectors");
    expect(handled).toBe(true);
    const body = getResponseBody(res);
    expect(body).toEqual([]);
  });

  it("returns connector list with health info", async () => {
    const connector = makeConnector({ name: "slack" });
    const connectors = new Map([["slack", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    await handleConnectorsRequest(makeReq(), res, context, "GET", "/api/connectors");
    const body = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("slack");
    expect(body[0].instanceId).toBe("slack");
    expect(body[0].connected).toBe(true);
  });

  it("handles connector with no getEmployee", async () => {
    const connector = makeConnector({ name: "discord", getEmployee: undefined });
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    await handleConnectorsRequest(makeReq(), res, context, "GET", "/api/connectors");
    const body = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(body[0].employee).toBeUndefined();
  });
});

// ── POST /api/connectors/:id/incoming ─────────────────────────────────────

describe("POST /api/connectors/:id/incoming", () => {
  it("returns 404 when connector not found", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleConnectorsRequest(makeReq(), res, context, "POST", "/api/connectors/missing/incoming");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("returns 400 when connector lacks deliverMessage", async () => {
    const connector = makeConnector({ name: "slack" });
    // no deliverMessage
    const connectors = new Map([["slack", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    await handleConnectorsRequest(makeReq(), res, context, "POST", "/api/connectors/slack/incoming");
    expect(getStatusCode(res)).toBe(400);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.error).toMatch(/not in remote mode/i);
  });

  it("delivers message and returns delivered", async () => {
    const deliverMessage = vi.fn();
    const connector = { ...makeConnector(), deliverMessage };
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({
      sessionKey: "sk1",
      channel: "ch1",
      thread: undefined,
      user: "u1",
      userId: "u1",
      text: "Hello",
      messageId: "m1",
      attachments: [],
    });
    const handled = await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/incoming");
    expect(handled).toBe(true);
    expect(deliverMessage).toHaveBeenCalled();
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("delivered");
  });

  it("falls back to discord connector for legacy discord path", async () => {
    const deliverMessage = vi.fn();
    const connector = { ...makeConnector(), deliverMessage };
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({
      sessionKey: "sk1",
      channel: "ch1",
      user: "u1",
      userId: "u1",
      text: "Hello",
      attachments: [],
    });
    // Using /api/connectors/discord/incoming — the 'discord' id checks fallback too
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/incoming");
    expect(deliverMessage).toHaveBeenCalled();
  });

  it("downloads attachments when URL is provided", async () => {
    const { downloadAttachment } = await import("../../../connectors/discord/format.js");
    vi.mocked(downloadAttachment).mockResolvedValue("/tmp/fake/downloaded.png");
    const deliverMessage = vi.fn();
    const connector = { ...makeConnector(), deliverMessage };
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({
      sessionKey: "sk1",
      channel: "ch1",
      user: "u1",
      userId: "u1",
      text: "Hello",
      attachments: [{ name: "file.png", url: "https://cdn.discord.com/file.png", mimeType: "image/png" }],
    });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/incoming");
    expect(downloadAttachment).toHaveBeenCalled();
  });

  it("handles attachment download failure gracefully", async () => {
    const { downloadAttachment } = await import("../../../connectors/discord/format.js");
    vi.mocked(downloadAttachment).mockRejectedValue(new Error("download failed"));
    const deliverMessage = vi.fn();
    const connector = { ...makeConnector(), deliverMessage };
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({
      sessionKey: "sk1",
      channel: "ch1",
      user: "u1",
      userId: "u1",
      text: "Hello",
      attachments: [{ name: "file.png", url: "https://cdn.discord.com/file.png", mimeType: "image/png" }],
    });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/incoming");
    // Should still deliver despite download failure
    expect(deliverMessage).toHaveBeenCalled();
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("delivered");
  });
});

// ── POST /api/connectors/:id/proxy ─────────────────────────────────────────

describe("POST /api/connectors/:id/proxy", () => {
  it("returns 404 when connector not found", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleConnectorsRequest(
      makeReq({ action: "sendMessage" }),
      res,
      context,
      "POST",
      "/api/connectors/missing/proxy",
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("sendMessage — returns 400 when target or text missing", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "sendMessage", text: "hi" }); // missing target
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(getStatusCode(res)).toBe(400);
  });

  it("sendMessage — calls connector.sendMessage and returns ok", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "sendMessage", target: { channel: "ch1" }, text: "Hello" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(connector.sendMessage).toHaveBeenCalled();
    expect(getStatusCode(res)).toBe(200);
  });

  it("replyMessage — calls connector.replyMessage", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "replyMessage", target: { channel: "ch1" }, text: "reply" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(connector.replyMessage).toHaveBeenCalled();
    expect(getStatusCode(res)).toBe(200);
  });

  it("replyMessage — returns 400 when target or text missing", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "replyMessage" }); // missing target and text
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(getStatusCode(res)).toBe(400);
  });

  it("editMessage — calls connector.editMessage", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "editMessage", target: { channel: "ch1", messageId: "m1" }, text: "edited" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(connector.editMessage).toHaveBeenCalled();
    expect(getStatusCode(res)).toBe(200);
  });

  it("editMessage — returns 400 when target or text missing", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "editMessage" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(getStatusCode(res)).toBe(400);
  });

  it("addReaction — calls connector.addReaction", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "addReaction", target: { channel: "ch1", messageId: "m1" }, emoji: "👍" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(connector.addReaction).toHaveBeenCalled();
    expect(getStatusCode(res)).toBe(200);
  });

  it("addReaction — returns 400 when target or emoji missing", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "addReaction" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(getStatusCode(res)).toBe(400);
  });

  it("removeReaction — calls connector.removeReaction", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "removeReaction", target: { channel: "ch1", messageId: "m1" }, emoji: "👍" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(connector.removeReaction).toHaveBeenCalled();
    expect(getStatusCode(res)).toBe(200);
  });

  it("removeReaction — returns 400 when target or emoji missing", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "removeReaction" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(getStatusCode(res)).toBe(400);
  });

  it("setTypingStatus — calls connector.setTypingStatus", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "setTypingStatus", channelId: "ch1", threadTs: "ts1", status: "typing" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(connector.setTypingStatus).toHaveBeenCalled();
    expect(getStatusCode(res)).toBe(200);
  });

  it("setTypingStatus — no-op when connector lacks setTypingStatus", async () => {
    const connector = makeConnector({ setTypingStatus: undefined });
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "setTypingStatus", channelId: "ch1", status: "typing" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(getStatusCode(res)).toBe(200);
  });

  it("unknown action — returns 400", async () => {
    const connector = makeConnector();
    const connectors = new Map([["discord", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ action: "unknownAction" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/discord/proxy");
    expect(getStatusCode(res)).toBe(400);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.error).toMatch(/Unknown proxy action/i);
  });
});

// ── POST /api/connectors/:name/send ───────────────────────────────────────

describe("POST /api/connectors/:name/send", () => {
  it("returns 404 when connector not found", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleConnectorsRequest(makeReq(), res, context, "POST", "/api/connectors/missing/send");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("returns 400 when channel or text is missing", async () => {
    const connector = makeConnector();
    const connectors = new Map([["slack", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ text: "hello" }); // missing channel
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/slack/send");
    expect(getStatusCode(res)).toBe(400);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.error).toMatch(/channel and text/i);
  });

  it("sends message via connector and returns sent", async () => {
    const connector = makeConnector({ name: "slack" });
    const connectors = new Map([["slack", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ channel: "general", text: "Hello Slack!" });
    const handled = await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/slack/send");
    expect(handled).toBe(true);
    expect(connector.sendMessage).toHaveBeenCalledWith({ channel: "general", thread: undefined }, "Hello Slack!");
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("sent");
  });

  it("passes thread parameter to sendMessage", async () => {
    const connector = makeConnector({ name: "slack" });
    const connectors = new Map([["slack", connector]]);
    const context = makeContext(connectors as never);
    const res = makeRes();
    const req = makeReq({ channel: "general", text: "Reply in thread", thread: "ts123" });
    await handleConnectorsRequest(req, res, context, "POST", "/api/connectors/slack/send");
    expect(connector.sendMessage).toHaveBeenCalledWith({ channel: "general", thread: "ts123" }, "Reply in thread");
  });
});

// ── Unmatched routes ───────────────────────────────────────────────────────

describe("unmatched routes", () => {
  it("returns false for unknown route", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleConnectorsRequest(makeReq(), res, context, "GET", "/api/unknown");
    expect(handled).toBe(false);
  });
});
