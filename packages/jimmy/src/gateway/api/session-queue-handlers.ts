import type { ServerResponse } from "node:http";
import {
  type cancelAllPendingQueueItems,
  type cancelQueueItem,
  cancelAllPendingQueueItems as defaultCancelAllPendingQueueItems,
  cancelQueueItem as defaultCancelQueueItem,
  getQueueItems as defaultGetQueueItems,
  getSession as defaultGetSession,
  type getQueueItems,
  type getSession,
} from "../../sessions/registry.js";
import type { ApiContext } from "../types.js";
import { json, notFound, unwrapSession } from "./utils.js";

export interface QueueHandlerDeps {
  getSession: typeof getSession;
  getQueueItems: typeof getQueueItems;
  cancelQueueItem: typeof cancelQueueItem;
  cancelAllPendingQueueItems: typeof cancelAllPendingQueueItems;
}

export function handleGetQueue(
  res: ServerResponse,
  _context: ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) {
    notFound(res);
    return;
  }
  const items = deps.getQueueItems(session.sessionKey || session.sourceRef || session.id);
  json(res, items);
}

export function handleClearQueue(
  res: ServerResponse,
  context: ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) {
    notFound(res);
    return;
  }
  const sessionKey = session.sessionKey || session.sourceRef || session.id;
  context.sessionManager.getQueue().clearQueue(sessionKey);
  const cancelled = deps.cancelAllPendingQueueItems(sessionKey);
  context.emit("queue:updated", { sessionId, sessionKey, depth: 0 });
  json(res, { status: "cleared", cancelled });
}

export function handleCancelQueueItem(
  res: ServerResponse,
  context: ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
  itemId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) {
    notFound(res);
    return;
  }
  const cancelled = deps.cancelQueueItem(itemId);
  if (!cancelled) {
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Item not found or already running" }));
    return;
  }
  context.emit("queue:updated", { sessionId, sessionKey: session.sessionKey });
  json(res, { status: "cancelled", itemId });
}

export function handlePauseQueue(
  res: ServerResponse,
  context: ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) {
    notFound(res);
    return;
  }
  const sessionKey = session.sessionKey || session.sourceRef || session.id;
  context.sessionManager.getQueue().pauseQueue(sessionKey);
  context.emit("queue:updated", { sessionId, sessionKey, paused: true });
  json(res, { status: "paused", sessionId });
}

export function handleResumeQueue(
  res: ServerResponse,
  context: ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) {
    notFound(res);
    return;
  }
  const sessionKey = session.sessionKey || session.sourceRef || session.id;
  context.sessionManager.getQueue().resumeQueue(sessionKey);
  context.emit("queue:updated", { sessionId, sessionKey, paused: false });
  json(res, { status: "resumed", sessionId });
}

export const defaultQueueHandlerDeps: QueueHandlerDeps = {
  getSession: defaultGetSession,
  getQueueItems: defaultGetQueueItems,
  cancelQueueItem: defaultCancelQueueItem,
  cancelAllPendingQueueItems: defaultCancelAllPendingQueueItems,
};
