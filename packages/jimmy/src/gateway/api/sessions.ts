import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import { forkEngineSession } from "../../sessions/fork.js";
import {
  cancelAllPendingQueueItems,
  cancelQueueItem,
  createSession,
  deleteSession,
  deleteSessions,
  duplicateSession,
  enqueueQueueItem,
  getMessages,
  getQueueItems,
  getSession,
  insertMessage,
  listSessions,
  updateSession,
} from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import { JINN_HOME } from "../../shared/paths.js";
import type { JsonObject } from "../../shared/types.js";
import { isInterruptibleEngine } from "../../shared/types.js";
import { getClaudeExpectedResetAt } from "../../shared/usageAwareness.js";
import type { ApiContext } from "../types.js";
import {
  dispatchWebSessionRun,
  loadRawTranscript,
  loadTranscriptMessages,
  maybeRevertEngineOverride,
} from "./session-runner.js";
import {
  badRequest,
  json,
  matchRoute,
  notFound,
  readJsonBody,
  resolveAttachmentPaths,
  serializeSession,
  serverError,
} from "./utils.js";

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
    const body = _parsed.body as Record<string, unknown>;
    const ids: string[] = Array.isArray(body.ids) ? (body.ids as string[]) : [];
    if (ids.length === 0) {
      badRequest(res, "ids array is required");
      return true;
    }

    // Kill any live engine processes before deleting
    for (const id of ids) {
      const session = getSession(id);
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
    const body = _parsed.body as Record<string, unknown>;
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
    const body = _parsed.body as Record<string, unknown>;
    const prompt = (body.prompt as string | undefined) || (body.message as string | undefined);
    if (!prompt) {
      badRequest(res, "prompt or message is required");
      return true;
    }
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
      parentSessionId: body.parentSessionId as string | undefined,
      effortLevel: body.effortLevel as string | undefined,
      prompt,
      portalName: config.portal?.portalName,
    });
    logger.info(`Web session created: ${session.id}`);
    insertMessage(session.id, "user", prompt);

    // Run engine asynchronously — respond immediately, push result via WebSocket
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

    // Set status to "running" synchronously BEFORE returning the response.
    updateSession(session.id, {
      status: "running",
      lastActivity: new Date().toISOString(),
    });
    session.status = "running";

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

  // GET /api/sessions/:id
  let params = matchRoute("/api/sessions/:id", pathname);
  if (method === "GET" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    let messages = getMessages(params.id);

    // Backfill from Claude Code's JSONL transcript if our DB has no messages
    if (messages.length === 0 && session.engineSessionId) {
      const transcriptMessages = loadTranscriptMessages(session.engineSessionId);
      if (transcriptMessages.length > 0) {
        for (const tm of transcriptMessages) {
          insertMessage(params.id, tm.role, tm.content);
        }
        messages = getMessages(params.id);
      }
    }

    // Support ?last=N to return only the N most recent messages
    const lastN = parseInt(url.searchParams.get("last") || "0", 10);
    if (lastN > 0 && messages.length > lastN) {
      messages = messages.slice(-lastN);
    }

    json(res, { ...serializeSession(session, context), messages });
    return true;
  }

  // PUT /api/sessions/:id
  params = matchRoute("/api/sessions/:id", pathname);
  if (method === "PUT" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;
    const updates: import("../../sessions/registry.js").UpdateSessionFields = {};
    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        badRequest(res, "title must be a string");
        return true;
      }
      const trimmed = body.title.trim();
      if (!trimmed) {
        badRequest(res, "title must not be empty");
        return true;
      }
      updates.title = trimmed.slice(0, 200);
    }
    if (Object.keys(updates).length === 0) {
      badRequest(res, "no valid fields to update");
      return true;
    }
    const updated = updateSession(params.id, updates);
    if (!updated) {
      notFound(res);
      return true;
    }
    context.emit("session:updated", { sessionId: params.id });
    json(res, serializeSession(updated, context));
    return true;
  }

  // DELETE /api/sessions/:id
  params = matchRoute("/api/sessions/:id", pathname);
  if (method === "DELETE" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }

    // Kill any live engine process for this session before deleting it.
    const engine = context.sessionManager.getEngine(session.engine);
    if (engine && isInterruptibleEngine(engine) && engine.isAlive(params.id)) {
      logger.info(`Killing live engine process for deleted session ${params.id}`);
      engine.kill(params.id);
    }

    const deleted = deleteSession(params.id);
    if (!deleted) {
      notFound(res);
      return true;
    }
    logger.info(`Session deleted: ${params.id}`);
    context.emit("session:deleted", { sessionId: params.id });
    json(res, { status: "deleted" });
    return true;
  }

  // POST /api/sessions/:id/stop
  params = matchRoute("/api/sessions/:id/stop", pathname);
  if (method === "POST" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    const engine = context.sessionManager.getEngine(session.engine);
    if (engine && isInterruptibleEngine(engine) && engine.isAlive(params.id)) {
      engine.kill(params.id, "Interrupted by user");
    }
    context.sessionManager.getQueue().clearQueue(session.sessionKey || session.sourceRef || session.id);
    updateSession(params.id, { status: "idle", lastActivity: new Date().toISOString(), lastError: null });
    context.emit("session:stopped", { sessionId: params.id });
    json(res, { status: "stopped", sessionId: params.id });
    return true;
  }

  // POST /api/sessions/:id/reset — clear stuck session state (stale engine IDs, errors)
  params = matchRoute("/api/sessions/:id/reset", pathname);
  if (method === "POST" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    const engine = context.sessionManager.getEngine(session.engine);
    if (engine && isInterruptibleEngine(engine) && engine.isAlive(params.id)) {
      engine.kill(params.id, "Interrupted by reset");
    }
    context.sessionManager.getQueue().clearQueue(session.sessionKey || session.sourceRef || session.id);
    const meta = { ...(session.transportMeta || {}) } as Record<string, unknown>;
    delete meta.engineSessions;
    delete meta.engineOverride;
    updateSession(params.id, {
      status: "idle",
      engineSessionId: null,
      lastActivity: new Date().toISOString(),
      lastError: null,
      transportMeta: meta as JsonObject,
    });
    logger.info(
      `Session ${params.id} reset via API (cleared engineSessions, engineOverride, engineSessionId, lastError)`,
    );
    context.emit("session:updated", { sessionId: params.id });
    json(res, { status: "reset", sessionId: params.id });
    return true;
  }

  // POST /api/sessions/:id/duplicate — duplicate a session (snapshot fork)
  params = matchRoute("/api/sessions/:id/duplicate", pathname);
  if (method === "POST" && params) {
    const source = getSession(params.id);
    if (!source) {
      notFound(res);
      return true;
    }
    if (!source.engineSessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session has no engine session ID — cannot duplicate" }));
      return true;
    }

    let newSessionId: string | null = null;
    try {
      // 1. Duplicate session + messages in the registry
      const { session: newSession, messageCount } = duplicateSession(params.id);
      newSessionId = newSession.id;

      // 2. Fork the engine session (Claude/Codex/Gemini)
      const forkResult = forkEngineSession(source.engine, source.engineSessionId, JINN_HOME);

      // 3. Store the new engine session ID
      updateSession(newSession.id, { engineSessionId: forkResult.engineSessionId });

      const result = getSession(newSession.id);
      if (!result) {
        serverError(res, "Failed to retrieve duplicated session");
        return true;
      }
      logger.info(
        `Session duplicated: ${params.id} → ${newSession.id} (engine: ${forkResult.engineSessionId}, ${messageCount} messages)`,
      );
      context.emit("session:created", { sessionId: newSession.id });
      json(res, serializeSession(result, context));
      return true;
    } catch (err) {
      // Clean up orphaned session if the engine fork failed after DB insert
      if (newSessionId) {
        try {
          deleteSession(newSessionId);
        } catch {
          /* best effort */
        }
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to duplicate session ${params.id}: ${errMsg}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Duplicate failed: ${errMsg}` }));
      return true;
    }
  }

  // DELETE /api/sessions/:id/queue/:itemId — cancel specific item
  const queueItemParams = matchRoute("/api/sessions/:id/queue/:itemId", pathname);
  if (method === "DELETE" && queueItemParams) {
    const session = getSession(queueItemParams.id);
    if (!session) {
      notFound(res);
      return true;
    }
    const cancelled = cancelQueueItem(queueItemParams.itemId);
    if (!cancelled) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Item not found or already running" }));
      return true;
    }
    context.emit("queue:updated", { sessionId: queueItemParams.id, sessionKey: session.sessionKey });
    json(res, { status: "cancelled", itemId: queueItemParams.itemId });
    return true;
  }

  // GET /api/sessions/:id/queue
  params = matchRoute("/api/sessions/:id/queue", pathname);
  if (method === "GET" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    const items = getQueueItems(session.sessionKey || session.sourceRef || session.id);
    json(res, items);
    return true;
  }

  // DELETE /api/sessions/:id/queue — clear all pending
  params = matchRoute("/api/sessions/:id/queue", pathname);
  if (method === "DELETE" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    const sessionKey = session.sessionKey || session.sourceRef || session.id;
    context.sessionManager.getQueue().clearQueue(sessionKey);
    const cancelled = cancelAllPendingQueueItems(sessionKey);
    context.emit("queue:updated", { sessionId: params.id, sessionKey, depth: 0 });
    json(res, { status: "cleared", cancelled });
    return true;
  }

  // POST /api/sessions/:id/queue/pause
  params = matchRoute("/api/sessions/:id/queue/pause", pathname);
  if (method === "POST" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    const sessionKey = session.sessionKey || session.sourceRef || session.id;
    context.sessionManager.getQueue().pauseQueue(sessionKey);
    context.emit("queue:updated", { sessionId: params.id, sessionKey, paused: true });
    json(res, { status: "paused", sessionId: params.id });
    return true;
  }

  // POST /api/sessions/:id/queue/resume
  params = matchRoute("/api/sessions/:id/queue/resume", pathname);
  if (method === "POST" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    const sessionKey = session.sessionKey || session.sourceRef || session.id;
    context.sessionManager.getQueue().resumeQueue(sessionKey);
    context.emit("queue:updated", { sessionId: params.id, sessionKey, paused: false });
    json(res, { status: "resumed", sessionId: params.id });
    return true;
  }

  // GET /api/sessions/:id/children
  params = matchRoute("/api/sessions/:id/children", pathname);
  if (method === "GET" && params) {
    const children = listSessions().filter((s) => s.parentSessionId === params?.id);
    json(
      res,
      children.map((child) => serializeSession(child, context)),
    );
    return true;
  }

  // GET /api/sessions/:id/transcript — return raw Claude Code session transcript
  params = matchRoute("/api/sessions/:id/transcript", pathname);
  if (method === "GET" && params) {
    const session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    if (!session.engineSessionId) {
      json(res, []);
      return true;
    }
    const entries = loadRawTranscript(session.engineSessionId);
    json(res, entries);
    return true;
  }

  // POST /api/sessions/:id/message
  params = matchRoute("/api/sessions/:id/message", pathname);
  if (method === "POST" && params) {
    let session = getSession(params.id);
    if (!session) {
      notFound(res);
      return true;
    }
    session = maybeRevertEngineOverride(session);
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;
    const prompt = (body.message as string | undefined) || (body.prompt as string | undefined);
    if (!prompt) {
      badRequest(res, "message is required");
      return true;
    }

    // Allow internal callers (e.g. child session callbacks) to specify a non-user role
    const messageRole: string = body.role === "notification" ? "notification" : "user";
    const isNotification = messageRole === "notification";

    const config = context.getConfig();
    const engine = context.sessionManager.getEngine(session.engine);
    if (!engine) {
      serverError(res, `Engine "${session.engine}" not available`);
      return true;
    }

    // Persist the message immediately
    insertMessage(session.id, messageRole, prompt);

    // Emit notification event for UI display (renders as system banner, not user bubble)
    if (isNotification) {
      context.emit("session:notification", { sessionId: session.id, message: prompt });
      // Don't return early — fall through to enqueue + dispatch so the engine
      // (e.g. the COO) actually processes the notification and can respond.
    }

    if (!isNotification && session.status === "waiting") {
      const expectedResetAt = getClaudeExpectedResetAt();
      const resumeText = expectedResetAt
        ? expectedResetAt.toLocaleString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;
      const queuedText = `⏳ Still paused due to Claude usage limit${resumeText ? ` (resets ${resumeText})` : ""}. Your message is queued and will run automatically.`;
      insertMessage(session.id, "notification", queuedText);
      context.emit("session:notification", { sessionId: session.id, message: queuedText });
    }

    // If a turn is already running, check whether we should interrupt or queue.
    // Notifications (child completion callbacks) should never interrupt — just queue.
    if (session.status === "running") {
      if (
        !isNotification &&
        (config.sessions?.interruptOnNewMessage ?? true) &&
        isInterruptibleEngine(engine) &&
        engine.isAlive(session.id)
      ) {
        logger.info(`Interrupting running session ${session.id} for new message`);
        engine.kill(session.id, "Interrupted: new message received");
        // Wait briefly for the process to exit so the queue slot frees up
        await new Promise((resolve) => setTimeout(resolve, 500));
        context.emit("session:interrupted", { sessionId: session.id, reason: "new message" });
      } else {
        context.emit("session:queued", { sessionId: session.id, message: prompt });
      }
    }

    // If session was interrupted by a restart, clear the error and resume
    if (session.status === "interrupted") {
      logger.info(`Resuming interrupted session ${session.id} (engineSessionId: ${session.engineSessionId})`);
      updateSession(session.id, {
        status: "running",
        lastActivity: new Date().toISOString(),
        lastError: null,
      });
      context.emit("session:resumed", { sessionId: session.id });
    }

    // Clear any pending cancellation so the new message runs normally.
    context.sessionManager.getQueue().clearCancelled(session.sessionKey || session.sourceRef || session.id);

    const attachmentPaths = resolveAttachmentPaths(body.attachments);

    const sessionKey = session.sessionKey || session.sourceRef || session.id;
    const queueItemId = enqueueQueueItem(session.id, sessionKey, prompt);
    context.emit("queue:updated", { sessionId: session.id, sessionKey });

    dispatchWebSessionRun(session, prompt, engine, config, context, {
      queueItemId,
      attachments: attachmentPaths.length > 0 ? attachmentPaths : undefined,
    });

    json(res, { status: "queued", sessionId: session.id });
    return true;
  }

  return false;
}

export { resumePendingWebQueueItemsImpl } from "./session-runner.js";
