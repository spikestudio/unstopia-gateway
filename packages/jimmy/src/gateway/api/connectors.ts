import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import QRCode from "qrcode";
import type { WhatsAppConnector } from "../../connectors/whatsapp/index.js";
import { TMP_DIR } from "../../shared/paths.js";
import type { IncomingMessage, JsonObject, Target } from "../../shared/types.js";
import type { ApiContext } from "../types.js";
import { badRequest, json, matchRoute, notFound, readJsonBody } from "./utils.js";

export async function handleConnectorsRequest(
  req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  method: string,
  pathname: string,
): Promise<boolean> {
  // POST /api/connectors/reload — stop all instance connectors and restart from config
  if (method === "POST" && pathname === "/api/connectors/reload") {
    if (!context.reloadConnectorInstances) {
      json(res, { error: "Connector reload not available" }, 501);
      return true;
    }
    try {
      const result = await context.reloadConnectorInstances();
      context.emit("connectors:reloaded", result);
      json(res, result);
      return true;
    } catch (err) {
      json(res, { error: err instanceof Error ? err.message : String(err) }, 500);
      return true;
    }
  }

  // GET /api/connectors/whatsapp/qr — return current QR code as PNG data URL
  if (method === "GET" && pathname === "/api/connectors/whatsapp/qr") {
    const waConnector = context.connectors.get("whatsapp");
    if (!waConnector) {
      notFound(res);
      return true;
    }
    const qrString = (waConnector as WhatsAppConnector).getQrCode();
    if (!qrString) {
      json(res, { qr: null });
      return true;
    }
    const dataUrl = await QRCode.toDataURL(qrString, { width: 256, margin: 2 });
    json(res, { qr: dataUrl });
    return true;
  }

  // GET /api/connectors — list available connectors
  if (method === "GET" && pathname === "/api/connectors") {
    const connectors = Array.from(context.connectors.entries()).map(([instanceId, connector]) => ({
      name: connector.name,
      instanceId,
      employee: connector.getEmployee?.() ?? undefined,
      ...connector.getHealth(),
    }));
    json(res, connectors);
    return true;
  }

  // POST /api/connectors/:id/incoming — receive proxied Discord messages from primary instance
  // Supports both the legacy /api/connectors/discord/incoming and named instance ids
  let params = matchRoute("/api/connectors/:id/incoming", pathname);
  if (method === "POST" && params && params.id) {
    // Try the exact instance id first, then fall back to "discord" for the legacy path
    const connector =
      context.connectors.get(params.id) ?? (params.id === "discord" ? context.connectors.get("discord") : undefined);
    if (!connector) {
      notFound(res);
      return true;
    }
    if (!("deliverMessage" in connector)) {
      json(res, { error: "Discord connector is not in remote mode" }, 400);
      return true;
    }

    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;

    // Download attachments from Discord CDN URLs to local temp
    const { downloadAttachment } = await import("../../connectors/discord/format.js");
    const rawAttachments = Array.isArray(body.attachments)
      ? (body.attachments as { name: string; url: string; mimeType: string }[])
      : [];
    const attachments = await Promise.all(
      rawAttachments.map(async (att) => {
        if (att.url) {
          try {
            const localPath = await downloadAttachment(att.url, TMP_DIR, att.name);
            return { name: att.name, url: att.url, mimeType: att.mimeType, localPath };
          } catch {
            return { name: att.name, url: att.url, mimeType: att.mimeType };
          }
        }
        return att;
      }),
    );

    const incomingMsg: IncomingMessage = {
      connector: params.id,
      source: "discord",
      sessionKey: body.sessionKey as string,
      channel: body.channel as string,
      thread: body.thread as string | undefined,
      user: body.user as string,
      userId: body.userId as string,
      text: body.text as string,
      messageId: body.messageId as string | undefined,
      attachments,
      replyContext: (body.replyContext as JsonObject | undefined) || {},
      transportMeta: body.transportMeta as JsonObject | undefined,
      raw: body,
    };

    (connector as { deliverMessage: (msg: IncomingMessage) => void }).deliverMessage(incomingMsg);
    json(res, { status: "delivered" });
    return true;
  }

  // POST /api/connectors/:id/proxy — proxy connector operations from remote instances
  // Supports both the legacy /api/connectors/discord/proxy and named instance ids
  params = matchRoute("/api/connectors/:id/proxy", pathname);
  if (method === "POST" && params && params.id) {
    const connector =
      context.connectors.get(params.id) ?? (params.id === "discord" ? context.connectors.get("discord") : undefined);
    if (!connector) {
      notFound(res);
      return true;
    }

    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;

    const action = body.action as string;
    const target = body.target as Target | undefined;
    let messageId: string | undefined;

    const bodyText = body.text as string | undefined;
    const bodyEmoji = body.emoji as string | undefined;
    const bodyChannelId = (body.channelId as string | undefined) ?? "";
    const bodyThreadTs = body.threadTs as string | undefined;
    const bodyStatus = (body.status as string | undefined) ?? "";
    switch (action) {
      case "sendMessage":
        if (!target || !bodyText) {
          badRequest(res, "target and text are required");
          return true;
        }
        messageId = (await connector.sendMessage(target, bodyText)) as string | undefined;
        break;
      case "replyMessage":
        if (!target || !bodyText) {
          badRequest(res, "target and text are required");
          return true;
        }
        messageId = (await connector.replyMessage(target, bodyText)) as string | undefined;
        break;
      case "editMessage":
        if (!target || !bodyText) {
          badRequest(res, "target and text are required");
          return true;
        }
        await connector.editMessage(target, bodyText);
        break;
      case "addReaction":
        if (!target || !bodyEmoji) {
          badRequest(res, "target and emoji are required");
          return true;
        }
        await connector.addReaction(target, bodyEmoji);
        break;
      case "removeReaction":
        if (!target || !bodyEmoji) {
          badRequest(res, "target and emoji are required");
          return true;
        }
        await connector.removeReaction(target, bodyEmoji);
        break;
      case "setTypingStatus":
        if (connector.setTypingStatus) {
          await connector.setTypingStatus(bodyChannelId, bodyThreadTs, bodyStatus);
        }
        break;
      default:
        badRequest(res, `Unknown proxy action: ${action}`);
        return true;
    }

    json(res, { status: "ok", messageId });
    return true;
  }

  // POST /api/connectors/:name/send — send a message via a connector
  params = matchRoute("/api/connectors/:name/send", pathname);
  if (method === "POST" && params) {
    const connector = context.connectors.get(params.name);
    if (!connector) {
      notFound(res);
      return true;
    }
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;
    if (!body.channel || !body.text) {
      badRequest(res, "channel and text are required");
      return true;
    }
    await connector.sendMessage(
      { channel: body.channel as string, thread: body.thread as string | undefined },
      body.text as string,
    );
    json(res, { status: "sent" });
    return true;
  }

  return false;
}
