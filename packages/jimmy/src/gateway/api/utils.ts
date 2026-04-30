import fs from "node:fs";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import http from "node:http";
import path from "node:path";
import { getFile } from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import { FILES_DIR } from "../../shared/paths.js";
import type { Result } from "../../shared/result.js";
import type { Session } from "../../shared/types.js";
import type { ApiContext } from "../types.js";

export function unwrapSession<E>(result: Result<Session | null, E>): Session | null {
  return result.ok ? result.value : null;
}

export function readBody(req: HttpRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

export function readBodyRaw(req: HttpRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function readJsonBody(
  req: HttpRequest,
  res: ServerResponse,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const raw = await readBody(req);
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    badRequest(res, "Invalid JSON in request body");
    return { ok: false };
  }
}

/** Resolve an array of file IDs to local filesystem paths for engine consumption. */
export function resolveAttachmentPaths(fileIds: unknown): string[] {
  if (!Array.isArray(fileIds)) return [];
  const paths: string[] = [];
  for (const id of fileIds) {
    if (typeof id !== "string" || !id.trim()) continue;
    const meta = getFile(id);
    if (!meta) {
      logger.warn(`Attachment file not found: ${id}`);
      continue;
    }
    const filePath = path.join(FILES_DIR, meta.id, path.basename(meta.filename));
    if (fs.existsSync(filePath)) {
      paths.push(filePath);
    } else if (meta.path && fs.existsSync(meta.path)) {
      paths.push(meta.path);
    } else {
      logger.warn(`Attachment file missing on disk: ${id} (${meta.filename})`);
    }
  }
  return paths;
}

export function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function notFound(res: ServerResponse): void {
  json(res, { error: "Not found" }, 404);
}

export function badRequest(res: ServerResponse, message: string): void {
  json(res, { error: message }, 400);
}

export function serverError(res: ServerResponse, message: string): void {
  json(res, { error: message }, 500);
}

const SANITIZED_KEYS = new Set(["token", "botToken", "signingSecret", "appToken"]);

export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    // Skip sanitized secret placeholders — keep original value
    if (SANITIZED_KEYS.has(key) && sv === "***") continue;
    if (Array.isArray(sv)) {
      // For arrays (e.g. instances), preserve secrets from matching items
      if (Array.isArray(tv)) {
        result[key] = sv.map((item: unknown) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            const srcItem = item as Record<string, unknown>;
            // Find matching target item by id
            const matchTarget = (tv as unknown[]).find(
              (t) => t && typeof t === "object" && (t as Record<string, unknown>).id === srcItem.id,
            ) as Record<string, unknown> | undefined;
            if (matchTarget) return deepMerge(matchTarget, srcItem);
          }
          return item;
        });
      } else {
        result[key] = sv;
      }
    } else if (
      sv &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

export function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export function serializeSession(session: Session, context: ApiContext): Session {
  const queue = context.sessionManager.getQueue();
  const queueDepth = queue.getPendingCount(session.sessionKey || session.sourceRef);
  const transportState = queue.getTransportState(session.sessionKey || session.sourceRef, session.status);
  return {
    ...session,
    queueDepth,
    transportState,
  };
}

export function checkInstanceHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({ hostname: "localhost", port, path: "/api/status", timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

export function stripAnsi(str: string): string {
  // ESC char (0x1b) via split/join avoids control character in regex literal
  return str.split("\u001b[").reduce((acc, part, i) => {
    if (i === 0) return part;
    const end = part.search(/[a-zA-Z]/);
    return end === -1 ? acc + part : acc + part.slice(end + 1);
  }, "");
}
