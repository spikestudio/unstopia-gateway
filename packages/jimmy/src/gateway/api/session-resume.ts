import {
  cancelQueueItem,
  getSession,
  listAllPendingQueueItems,
  updateSession,
} from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import type { ApiContext } from "../types.js";
import { unwrapSession } from "./utils.js";
import { dispatchWebSessionRun, maybeRevertEngineOverride } from "./session-runner.js";


export function resumePendingWebQueueItemsImpl(context: ApiContext): void {
  const pending = listAllPendingQueueItems();
  if (pending.length === 0) return;

  let resumed = 0;
  for (const item of pending) {
    let session = unwrapSession(getSession(item.sessionId));
    if (!session) {
      cancelQueueItem(item.id);
      continue;
    }
    if (session.source !== "web") continue;
    session = maybeRevertEngineOverride(session);

    const config = context.getConfig();
    const engine = context.sessionManager.getEngine(session.engine);
    if (!engine) {
      cancelQueueItem(item.id);
      updateSession(session.id, {
        status: "error",
        lastActivity: new Date().toISOString(),
        lastError: `Engine "${session.engine}" not available`,
      });
      continue;
    }

    updateSession(session.id, { status: "running", lastActivity: new Date().toISOString(), lastError: null });
    dispatchWebSessionRun(session, item.prompt, engine, config, context, { queueItemId: item.id });
    resumed++;
  }

  if (resumed > 0) {
    logger.info(`Re-dispatched ${resumed} pending web queue item(s) after gateway restart`);
  }
}
