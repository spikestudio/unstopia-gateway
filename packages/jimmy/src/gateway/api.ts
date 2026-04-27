import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import { logger } from "../shared/logger.js";
import { handleConnectorsRequest } from "./api/connectors.js";
import { handleCronRequest } from "./api/cron.js";
import { handleMiscRequest } from "./api/misc.js";
import { handleOrgRequest } from "./api/org.js";
import { handleSessionsRequest, resumePendingWebQueueItemsImpl } from "./api/sessions.js";
import { handleSkillsRequest } from "./api/skills.js";
import { handleSttRequest } from "./api/stt.js";
import { json, serverError } from "./api/utils.js";
import type { ApiContext } from "./types.js";

export type { ApiContext } from "./types.js";

export function resumePendingWebQueueItems(context: ApiContext): void {
  resumePendingWebQueueItemsImpl(context);
}

export async function handleApiRequest(req: HttpRequest, res: ServerResponse, context: ApiContext): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  try {
    if (await handleSessionsRequest(req, res, context, method, pathname, url)) return;
    if (await handleCronRequest(req, res, context, method, pathname)) return;
    if (await handleOrgRequest(req, res, context, method, pathname)) return;
    if (await handleSkillsRequest(req, res, context, method, pathname, url)) return;
    if (await handleConnectorsRequest(req, res, context, method, pathname)) return;
    if (await handleSttRequest(req, res, context, method, pathname, url)) return;
    if (await handleMiscRequest(req, res, context, method, pathname, url)) return;

    json(res, { error: "Not found" }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`API error: ${msg}`);
    serverError(res, msg);
  }
}
