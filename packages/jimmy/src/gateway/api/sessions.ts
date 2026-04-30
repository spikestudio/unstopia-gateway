import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import {
  createSession,
  deleteSessions,
  enqueueQueueItem,
  getSession,
  insertMessage,
  listSessions,
  updateSession,
} from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import type { Result } from "../../shared/result.js";
import type { Session } from "../../shared/types.js";
import { isInterruptibleEngine } from "../../shared/types.js";
import type { ApiContext } from "../types.js";
import type { BulkDeleteBody, CreateSessionBody, StubSessionBody } from "./api-types.js";
import {
  defaultCrudDeps,
  deleteSessionHandler,
  duplicateSessionHandler,
  getChildren,
  getSessionHandler,
  getTranscript,
  resetSession,
  stopSession,
  updateSessionHandler,
} from "./session-crud.js";
import { defaultPostMessageDeps, handlePostMessage } from "./session-message.js";
import {
  defaultQueueHandlerDeps,
  handleCancelQueueItem,
  handleClearQueue,
  handleGetQueue,
  handlePauseQueue,
  handleResumeQueue,
} from "./session-queue-handlers.js";
import { dispatchWebSessionRun } from "./session-runner.js";
import {
  badRequest,
  json,
  matchRoute,
  readJsonBody,
  resolveAttachmentPaths,
  serializeSession,
} from "./utils.js";

// ── Result unwrap helpers ────────────────────────────────────────────────────

function unwrapSession<E>(result: Result<Session | null, E>): Session | null {
  return result.ok ? result.value : null;
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function handleSessionsRequest(
  req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  method: string,
  pathname: string,
  url: URL,
): Promise<boolean> {
  // GET /api/sessions
  if (method === "GET" && pathname === "/api/sessions") {
    const sessions = listSessions();
    json(
      res,
      sessions.map((session) => serializeSession(session, context)),
    );
    return true;
  }

  // GET /api/sessions/interrupted — list sessions that can be resumed after a restart
  if (method === "GET" && pathname === "/api/sessions/interrupted") {
    const { getInterruptedSessions } = await import("../../sessions/registry.js");
    const interrupted = getInterruptedSessions();
    json(
      res,
      interrupted.map((session) => serializeSession(session, context)),
    );
    return true;
  }

  // POST /api/sessions/bulk-delete
  if (method === "POST" && pathname === "/api/sessions/bulk-delete") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as BulkDeleteBody;
    const ids: string[] = Array.isArray(body.ids) ? (body.ids as string[]) : [];
    if (ids.length === 0) {
      badRequest(res, "ids array is required");
      return true;
    }

    // Kill any live engine processes before deleting
    for (const id of ids) {
      const session = unwrapSession(getSession(id));
      if (!session) continue;
      const engine = context.sessionManager.getEngine(session.engine);
      if (engine && isInterruptibleEngine(engine) && engine.isAlive(id)) {
        engine.kill(id);
      }
    }

    const count = deleteSessions(ids);
    for (const id of ids) {
      context.emit("session:deleted", { sessionId: id });
    }
    logger.info(`Bulk deleted ${count} sessions`);
    json(res, { status: "deleted", count });
    return true;
  }

  // POST /api/sessions/stub — create a session with a pre-populated assistant
  // message but do NOT run the engine. Used for lazy onboarding.
  if (method === "POST" && pathname === "/api/sessions/stub") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as StubSessionBody;
    const greeting = (body.greeting as string | undefined) || "Hey! Say hi when you're ready to get started.";
    const config = context.getConfig();
    const engineName = (body.engine as string | undefined) || config.engines.default;
    const sessionKey = `web:${Date.now()}`;
    const session = createSession({
      engine: engineName,
      source: "web",
      sourceRef: sessionKey,
      connector: "web",
      sessionKey,
      replyContext: { source: "web" },
      employee: body.employee as string | undefined,
      title: body.title as string | undefined,
      portalName: config.portal?.portalName,
    });
    insertMessage(session.id, "assistant", greeting);
    logger.info(`Stub session created: ${session.id}`);
    json(res, serializeSession(session, context), 201);
    return true;
  }

  // POST /api/sessions
  if (method === "POST" && pathname === "/api/sessions") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as CreateSessionBody;
    const prompt = (body.prompt as string | undefined) || (body.message as string | undefined);
    if (!prompt) {
      badRequest(res, "prompt or message is required");
      return true;
    }
    const config = context.getConfig();
    const engineName = (body.engine as string | undefined) || config.engines.default;
    const sessionKey = `web:${Date.now()}`;
    let session = createSession({
      engine: engineName,
      source: "web",
      sourceRef: sessionKey,
      connector: "web",
      sessionKey,
      replyContext: { source: "web" },
      employee: body.employee as string | undefined,
      parentSessionId: body.parentSessionId as string | undefined,
      effortLevel: body.effortLevel as string | undefined,
      prompt,
      portalName: config.portal?.portalName,
    });
    logger.info(`Web session created: ${session.id}`);
    insertMessage(session.id, "user", prompt);

    const engine = context.sessionManager.getEngine(engineName);
    if (!engine) {
      updateSession(session.id, {
        status: "error",
        lastError: `Engine "${engineName}" not available`,
      });
      json(
        res,
        {
          ...serializeSession(
            { ...session, status: "error", lastError: `Engine "${engineName}" not available` },
            context,
          ),
        },
        201,
      );
      return true;
    }

    const runningResult = updateSession(session.id, {
      status: "running",
      lastActivity: new Date().toISOString(),
    });
    if (runningResult.ok && runningResult.value) {
      session = runningResult.value;
    } else {
      session = { ...session, status: "running" };
    }

    const attachmentPaths = resolveAttachmentPaths(body.attachments);
    const queueSessionKey = session.sessionKey || session.sourceRef || session.id;
    const queueItemId = enqueueQueueItem(session.id, queueSessionKey, prompt);
    context.emit("queue:updated", { sessionId: session.id, sessionKey: queueSessionKey });

    dispatchWebSessionRun(session, prompt, engine, config, context, {
      queueItemId,
      attachments: attachmentPaths.length > 0 ? attachmentPaths : undefined,
    });

    json(res, serializeSession(session, context), 201);
    return true;
  }

  // ── Per-session routes (:id) ────────────────────────────────────────────────

  // GET /api/sessions/:id
  let params = matchRoute("/api/sessions/:id", pathname);
  if (method === "GET" && params) {
    await getSessionHandler(req, res, context, defaultCrudDeps, params.id, url);
    return true;
  }

  // PUT /api/sessions/:id
  params = matchRoute("/api/sessions/:id", pathname);
  if (method === "PUT" && params) {
    await updateSessionHandler(req, res, context, defaultCrudDeps, params.id);
    return true;
  }

  // DELETE /api/sessions/:id
  params = matchRoute("/api/sessions/:id", pathname);
  if (method === "DELETE" && params) {
    deleteSessionHandler(res, context, defaultCrudDeps, params.id);
    return true;
  }

  // POST /api/sessions/:id/stop
  params = matchRoute("/api/sessions/:id/stop", pathname);
  if (method === "POST" && params) {
    stopSession(res, context, defaultCrudDeps, params.id);
    return true;
  }

  // POST /api/sessions/:id/reset
  params = matchRoute("/api/sessions/:id/reset", pathname);
  if (method === "POST" && params) {
    resetSession(res, context, defaultCrudDeps, params.id);
    return true;
  }

  // POST /api/sessions/:id/duplicate
  params = matchRoute("/api/sessions/:id/duplicate", pathname);
  if (method === "POST" && params) {
    await duplicateSessionHandler(res, context, defaultCrudDeps, params.id);
    return true;
  }

  // DELETE /api/sessions/:id/queue/:itemId — cancel specific item
  const queueItemParams = matchRoute("/api/sessions/:id/queue/:itemId", pathname);
  if (method === "DELETE" && queueItemParams) {
    handleCancelQueueItem(res, context, defaultQueueHandlerDeps, queueItemParams.id, queueItemParams.itemId);
    return true;
  }

  // GET /api/sessions/:id/queue
  params = matchRoute("/api/sessions/:id/queue", pathname);
  if (method === "GET" && params) {
    handleGetQueue(res, context, defaultQueueHandlerDeps, params.id);
    return true;
  }

  // DELETE /api/sessions/:id/queue — clear all pending
  params = matchRoute("/api/sessions/:id/queue", pathname);
  if (method === "DELETE" && params) {
    handleClearQueue(res, context, defaultQueueHandlerDeps, params.id);
    return true;
  }

  // POST /api/sessions/:id/queue/pause
  params = matchRoute("/api/sessions/:id/queue/pause", pathname);
  if (method === "POST" && params) {
    handlePauseQueue(res, context, defaultQueueHandlerDeps, params.id);
    return true;
  }

  // POST /api/sessions/:id/queue/resume
  params = matchRoute("/api/sessions/:id/queue/resume", pathname);
  if (method === "POST" && params) {
    handleResumeQueue(res, context, defaultQueueHandlerDeps, params.id);
    return true;
  }

  // GET /api/sessions/:id/children
  params = matchRoute("/api/sessions/:id/children", pathname);
  if (method === "GET" && params) {
    getChildren(res, context, defaultCrudDeps, params.id);
    return true;
  }

  // GET /api/sessions/:id/transcript
  params = matchRoute("/api/sessions/:id/transcript", pathname);
  if (method === "GET" && params) {
    getTranscript(res, context, defaultCrudDeps, params.id);
    return true;
  }

  // POST /api/sessions/:id/message
  params = matchRoute("/api/sessions/:id/message", pathname);
  if (method === "POST" && params) {
    const deps = {
      ...defaultPostMessageDeps,
      getEngine: (name: string) => context.sessionManager.getEngine(name) ?? null,
      getConfig: () => context.getConfig(),
    };
    await handlePostMessage(req, res, context, deps, params.id);
    return true;
  }

  return false;
}

export { resumePendingWebQueueItemsImpl } from "./session-runner.js";
