import {
  type cancelQueueItem,
  cancelQueueItem as defaultCancelQueueItem,
  getSession as defaultGetSession,
  listAllPendingQueueItems as defaultListAllPendingQueueItems,
  updateSession as defaultUpdateSession,
  type getSession,
  type listAllPendingQueueItems,
  type updateSession,
} from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import type { ApiContext } from "../types.js";
import {
  dispatchWebSessionRun as defaultDispatchWebSessionRun,
  maybeRevertEngineOverride as defaultMaybeRevertEngineOverride,
  type dispatchWebSessionRun,
  type maybeRevertEngineOverride,
} from "./session-runner.js";
import { unwrapSession } from "./utils.js";

export interface ResumeDeps {
  listAllPendingQueueItems: typeof listAllPendingQueueItems;
  getSession: typeof getSession;
  cancelQueueItem: typeof cancelQueueItem;
  updateSession: typeof updateSession;
  maybeRevertEngineOverride: typeof maybeRevertEngineOverride;
  dispatchWebSessionRun: typeof dispatchWebSessionRun;
}

export function resumePendingWebQueueItemsImpl(context: ApiContext, deps: ResumeDeps = defaultResumeDeps): void {
  const pending = deps.listAllPendingQueueItems();
  if (pending.length === 0) return;

  let resumed = 0;
  for (const item of pending) {
    let session = unwrapSession(deps.getSession(item.sessionId));
    if (!session) {
      deps.cancelQueueItem(item.id);
      continue;
    }
    if (session.source !== "web") continue;
    session = deps.maybeRevertEngineOverride(session);

    const config = context.getConfig();
    const engine = context.sessionManager.getEngine(session.engine);
    if (!engine) {
      deps.cancelQueueItem(item.id);
      deps.updateSession(session.id, {
        status: "error",
        lastActivity: new Date().toISOString(),
        lastError: `Engine "${session.engine}" not available`,
      });
      continue;
    }

    deps.updateSession(session.id, { status: "running", lastActivity: new Date().toISOString(), lastError: null });
    deps.dispatchWebSessionRun(session, item.prompt, engine, config, context, { queueItemId: item.id });
    resumed++;
  }

  if (resumed > 0) {
    logger.info(`Re-dispatched ${resumed} pending web queue item(s) after gateway restart`);
  }
}

export const defaultResumeDeps: ResumeDeps = {
  listAllPendingQueueItems: defaultListAllPendingQueueItems,
  getSession: defaultGetSession,
  cancelQueueItem: defaultCancelQueueItem,
  updateSession: defaultUpdateSession,
  maybeRevertEngineOverride: defaultMaybeRevertEngineOverride,
  dispatchWebSessionRun: defaultDispatchWebSessionRun,
};
