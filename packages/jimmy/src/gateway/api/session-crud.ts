import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import { forkEngineSession } from "../../sessions/fork.js";
import {
  type deleteSession,
  type duplicateSession,
  type getMessages,
  type getSession,
  type insertMessage,
  type listSessions,
  type updateSession,
  type UpdateSessionFields,
  deleteSession as defaultDeleteSession,
  duplicateSession as defaultDuplicateSession,
  getMessages as defaultGetMessages,
  getSession as defaultGetSession,
  insertMessage as defaultInsertMessage,
  listSessions as defaultListSessions,
  updateSession as defaultUpdateSession,
} from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import { JINN_HOME } from "../../shared/paths.js";
import type { JsonObject } from "../../shared/types.js";
import { isInterruptibleEngine } from "../../shared/types.js";
import type { ApiContext } from "../types.js";
import type { UpdateSessionBody } from "./api-types.js";
import { loadRawTranscript, loadTranscriptMessages } from "./session-runner.js";
import { badRequest, json, notFound, readJsonBody, serializeSession, serverError, unwrapSession } from "./utils.js";

export interface CrudDeps {
  getSession: typeof getSession;
  updateSession: typeof updateSession;
  deleteSession: typeof deleteSession;
  insertMessage: typeof insertMessage;
  getMessages: typeof getMessages;
  listSessions: typeof listSessions;
  duplicateSession: typeof duplicateSession;
}


export async function getSessionHandler(
  _req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  deps: CrudDeps,
  sessionId: string,
  url: URL,
): Promise<void> {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) { notFound(res); return; }

  let messages = deps.getMessages(sessionId);

  if (messages.length === 0 && session.engineSessionId) {
    const transcriptMessages = loadTranscriptMessages(session.engineSessionId);
    if (transcriptMessages.length > 0) {
      for (const tm of transcriptMessages) {
        deps.insertMessage(sessionId, tm.role, tm.content);
      }
      messages = deps.getMessages(sessionId);
    }
  }

  const lastN = parseInt(url.searchParams.get("last") || "0", 10);
  if (lastN > 0 && messages.length > lastN) {
    messages = messages.slice(-lastN);
  }

  json(res, { ...serializeSession(session, context), messages });
}

export async function updateSessionHandler(
  req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  deps: CrudDeps,
  sessionId: string,
): Promise<void> {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) { notFound(res); return; }

  const _parsed = await readJsonBody(req, res);
  if (!_parsed.ok) return;
  const body = _parsed.body as UpdateSessionBody;
  const updates: UpdateSessionFields = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      badRequest(res, "title must be a string");
      return;
    }
    const trimmed = body.title.trim();
    if (!trimmed) {
      badRequest(res, "title must not be empty");
      return;
    }
    updates.title = trimmed.slice(0, 200);
  }

  if (Object.keys(updates).length === 0) {
    badRequest(res, "no valid fields to update");
    return;
  }

  const updatedResult = deps.updateSession(sessionId, updates);
  const updated = updatedResult.ok ? updatedResult.value : null;
  if (!updated) { notFound(res); return; }

  context.emit("session:updated", { sessionId });
  json(res, serializeSession(updated, context));
}

export function deleteSessionHandler(
  res: ServerResponse,
  context: ApiContext,
  deps: CrudDeps,
  sessionId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) { notFound(res); return; }

  const engine = context.sessionManager.getEngine(session.engine);
  if (engine && isInterruptibleEngine(engine) && engine.isAlive(sessionId)) {
    logger.info(`Killing live engine process for deleted session ${sessionId}`);
    engine.kill(sessionId);
  }

  const deleted = deps.deleteSession(sessionId);
  if (!deleted) { notFound(res); return; }

  logger.info(`Session deleted: ${sessionId}`);
  context.emit("session:deleted", { sessionId });
  json(res, { status: "deleted" });
}

export function stopSession(
  res: ServerResponse,
  context: ApiContext,
  deps: CrudDeps,
  sessionId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) { notFound(res); return; }

  const engine = context.sessionManager.getEngine(session.engine);
  if (engine && isInterruptibleEngine(engine) && engine.isAlive(sessionId)) {
    engine.kill(sessionId, "Interrupted by user");
  }
  context.sessionManager.getQueue().clearQueue(session.sessionKey || session.sourceRef || session.id);
  deps.updateSession(sessionId, { status: "idle", lastActivity: new Date().toISOString(), lastError: null });
  context.emit("session:stopped", { sessionId });
  json(res, { status: "stopped", sessionId });
}

export function resetSession(
  res: ServerResponse,
  context: ApiContext,
  deps: CrudDeps,
  sessionId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) { notFound(res); return; }

  const engine = context.sessionManager.getEngine(session.engine);
  if (engine && isInterruptibleEngine(engine) && engine.isAlive(sessionId)) {
    engine.kill(sessionId, "Interrupted by reset");
  }
  context.sessionManager.getQueue().clearQueue(session.sessionKey || session.sourceRef || session.id);
  const meta = { ...(session.transportMeta || {}) } as Record<string, unknown>;
  delete meta.engineSessions;
  delete meta.engineOverride;
  deps.updateSession(sessionId, {
    status: "idle",
    engineSessionId: null,
    lastActivity: new Date().toISOString(),
    lastError: null,
    transportMeta: meta as JsonObject,
  });
  logger.info(`Session ${sessionId} reset via API (cleared engineSessions, engineOverride, engineSessionId, lastError)`);
  context.emit("session:updated", { sessionId });
  json(res, { status: "reset", sessionId });
}

export async function duplicateSessionHandler(
  res: ServerResponse,
  context: ApiContext,
  deps: CrudDeps,
  sessionId: string,
): Promise<void> {
  const source = unwrapSession(deps.getSession(sessionId));
  if (!source) { notFound(res); return; }
  if (!source.engineSessionId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Session has no engine session ID — cannot duplicate" }));
    return;
  }

  let newSessionId: string | null = null;
  try {
    const { session: newSession, messageCount } = deps.duplicateSession(sessionId);
    newSessionId = newSession.id;

    const forkResult = forkEngineSession(source.engine, source.engineSessionId, JINN_HOME);
    deps.updateSession(newSession.id, { engineSessionId: forkResult.engineSessionId });

    const result = unwrapSession(deps.getSession(newSession.id));
    if (!result) { serverError(res, "Failed to retrieve duplicated session"); return; }

    logger.info(`Session duplicated: ${sessionId} → ${newSession.id} (engine: ${forkResult.engineSessionId}, ${messageCount} messages)`);
    context.emit("session:created", { sessionId: newSession.id });
    json(res, serializeSession(result, context));
  } catch (err) {
    if (newSessionId) {
      try { deps.deleteSession(newSessionId); } catch { /* best effort */ }
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to duplicate session ${sessionId}: ${errMsg}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Duplicate failed: ${errMsg}` }));
  }
}

export function getChildren(
  res: ServerResponse,
  context: ApiContext,
  deps: CrudDeps,
  sessionId: string,
): void {
  const children = deps.listSessions().filter((s) => s.parentSessionId === sessionId);
  json(res, children.map((child) => serializeSession(child, context)));
}

export function getTranscript(
  res: ServerResponse,
  _context: ApiContext,
  deps: CrudDeps,
  sessionId: string,
): void {
  const session = unwrapSession(deps.getSession(sessionId));
  if (!session) { notFound(res); return; }
  if (!session.engineSessionId) { json(res, []); return; }
  json(res, loadRawTranscript(session.engineSessionId));
}

export const defaultCrudDeps: CrudDeps = {
  getSession: defaultGetSession,
  updateSession: defaultUpdateSession,
  deleteSession: defaultDeleteSession,
  insertMessage: defaultInsertMessage,
  getMessages: defaultGetMessages,
  listSessions: defaultListSessions,
  duplicateSession: defaultDuplicateSession,
};
