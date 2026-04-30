import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import {
  enqueueQueueItem as defaultEnqueueQueueItem,
  getSession as defaultGetSession,
  insertMessage as defaultInsertMessage,
  updateSession as defaultUpdateSession,
  type enqueueQueueItem,
  type getSession,
  type insertMessage,
  type updateSession,
} from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import type { Engine, JinnConfig } from "../../shared/types.js";
import { isInterruptibleEngine } from "../../shared/types.js";
import {
  getClaudeExpectedResetAt as defaultGetClaudeExpectedResetAt,
  type getClaudeExpectedResetAt,
} from "../../shared/usageAwareness.js";
import type { ApiContext } from "../types.js";
import type { EnqueueMessageBody } from "./api-types.js";
import {
  dispatchWebSessionRun as defaultDispatchWebSessionRun,
  maybeRevertEngineOverride as defaultMaybeRevertEngineOverride,
  type dispatchWebSessionRun,
  type maybeRevertEngineOverride,
} from "./session-runner.js";
import {
  badRequest,
  resolveAttachmentPaths as defaultResolveAttachmentPaths,
  json,
  notFound,
  readJsonBody,
  type resolveAttachmentPaths,
  serverError,
  unwrapSession,
} from "./utils.js";

export interface PostMessageDeps {
  getSession: typeof getSession;
  insertMessage: typeof insertMessage;
  updateSession: typeof updateSession;
  enqueueQueueItem: typeof enqueueQueueItem;
  getClaudeExpectedResetAt: typeof getClaudeExpectedResetAt;
  maybeRevertEngineOverride: typeof maybeRevertEngineOverride;
  dispatchWebSessionRun: typeof dispatchWebSessionRun;
  resolveAttachmentPaths: typeof resolveAttachmentPaths;
  getEngine: (name: string) => Engine | null;
  getConfig: () => JinnConfig;
}

export async function handlePostMessage(
  req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  deps: PostMessageDeps,
  sessionId: string,
): Promise<void> {
  let session = unwrapSession(deps.getSession(sessionId));
  if (!session) {
    notFound(res);
    return;
  }

  session = deps.maybeRevertEngineOverride(session);

  const _parsed = await readJsonBody(req, res);
  if (!_parsed.ok) return;
  const body = _parsed.body as EnqueueMessageBody;
  const prompt = (body.message as string | undefined) || (body.prompt as string | undefined);
  if (!prompt) {
    badRequest(res, "message is required");
    return;
  }

  const messageRole: string = body.role === "notification" ? "notification" : "user";
  const isNotification = messageRole === "notification";

  const config = deps.getConfig();
  const engine = deps.getEngine(session.engine);
  if (!engine) {
    serverError(res, `Engine "${session.engine}" not available`);
    return;
  }

  deps.insertMessage(session.id, messageRole, prompt);

  if (isNotification) {
    context.emit("session:notification", { sessionId: session.id, message: prompt });
  }

  if (!isNotification && session.status === "waiting") {
    const expectedResetAt = deps.getClaudeExpectedResetAt();
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
    deps.insertMessage(session.id, "notification", queuedText);
    context.emit("session:notification", { sessionId: session.id, message: queuedText });
  }

  if (session.status === "running") {
    if (
      !isNotification &&
      (config.sessions?.interruptOnNewMessage ?? true) &&
      isInterruptibleEngine(engine) &&
      engine.isAlive(session.id)
    ) {
      logger.info(`Interrupting running session ${session.id} for new message`);
      engine.kill(session.id, "Interrupted: new message received");
      await new Promise((resolve) => setTimeout(resolve, 500));
      context.emit("session:interrupted", { sessionId: session.id, reason: "new message" });
    } else {
      context.emit("session:queued", { sessionId: session.id, message: prompt });
    }
  }

  if (session.status === "interrupted") {
    logger.info(`Resuming interrupted session ${session.id} (engineSessionId: ${session.engineSessionId})`);
    deps.updateSession(session.id, {
      status: "running",
      lastActivity: new Date().toISOString(),
      lastError: null,
    });
    context.emit("session:resumed", { sessionId: session.id });
  }

  context.sessionManager.getQueue().clearCancelled(session.sessionKey || session.sourceRef || session.id);

  const attachmentPaths = deps.resolveAttachmentPaths(body.attachments);
  const sessionKey = session.sessionKey || session.sourceRef || session.id;
  const queueItemId = deps.enqueueQueueItem(session.id, sessionKey, prompt);
  context.emit("queue:updated", { sessionId: session.id, sessionKey });

  deps.dispatchWebSessionRun(session, prompt, engine, config, context, {
    queueItemId,
    attachments: attachmentPaths.length > 0 ? attachmentPaths : undefined,
  });

  json(res, { status: "queued", sessionId: session.id });
}

/**
 * Registry-backed deps for handlePostMessage.
 * getEngine and getConfig must always be provided by the caller — they are
 * context-specific and cannot be defaulted statically.
 */
export const basePostMessageDeps: Omit<PostMessageDeps, "getEngine" | "getConfig"> = {
  getSession: defaultGetSession,
  insertMessage: defaultInsertMessage,
  updateSession: defaultUpdateSession,
  enqueueQueueItem: defaultEnqueueQueueItem,
  getClaudeExpectedResetAt: defaultGetClaudeExpectedResetAt,
  maybeRevertEngineOverride: defaultMaybeRevertEngineOverride,
  dispatchWebSessionRun: defaultDispatchWebSessionRun,
  resolveAttachmentPaths: defaultResolveAttachmentPaths,
};
