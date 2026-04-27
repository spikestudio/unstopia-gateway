/**
 * gateway/api/api-types.ts
 *
 * Named request/response types for the gateway API handlers.
 * Centralises type definitions so that each endpoint's shape is declared
 * once and referenced from handler files instead of inlined as
 * `body as Record<string, unknown>`.
 *
 * Runtime validation is NOT performed here — types are compile-time only.
 */

import type { CronJob, JsonObject } from "../../shared/types.js";

// ── Sessions ─────────────────────────────────────────────────────────────────

/** POST /api/sessions */
export interface CreateSessionBody {
  /** Primary user prompt */
  prompt?: string;
  /** Alias for prompt (legacy) */
  message?: string;
  engine?: string;
  employee?: string;
  parentSessionId?: string;
  effortLevel?: string;
  /** Array of file IDs (uploaded via /api/files) */
  attachments?: string[];
}

/** PUT /api/sessions/:id */
export interface UpdateSessionBody {
  title?: string;
}

/** POST /api/sessions/bulk-delete */
export interface BulkDeleteBody {
  ids?: unknown;
}

/** POST /api/sessions/:id/message */
export interface EnqueueMessageBody {
  message?: string;
  /** Alias for message (legacy) */
  prompt?: string;
  role?: string;
  /** Array of file IDs */
  attachments?: string[];
}

/** POST /api/sessions/stub */
export interface StubSessionBody {
  greeting?: string;
  engine?: string;
  employee?: string;
  title?: string;
}

// ── Org ──────────────────────────────────────────────────────────────────────

/** POST /api/org/cross-request */
export interface CrossRequestBody {
  fromEmployee?: string;
  service?: string;
  prompt?: string;
  parentSessionId?: string;
}

/** PATCH /api/org/employees/:name */
export interface PatchEmployeeBody {
  alwaysNotify?: unknown;
}

/** PUT /api/org/departments/:name/board */
export interface PutBoardBody extends Record<string, unknown> {}

// ── Cron ─────────────────────────────────────────────────────────────────────

/** POST /api/cron */
export interface CreateCronJobBody {
  id?: string;
  name?: string;
  enabled?: unknown;
  schedule?: string;
  timezone?: string;
  engine?: string;
  model?: string;
  employee?: string;
  prompt?: string;
  delivery?: CronJob["delivery"];
}

/** PUT /api/cron/:id — partial update, merged with existing job */
export interface UpdateCronJobBody extends Record<string, unknown> {}

// ── Connectors ───────────────────────────────────────────────────────────────

/** Attachment entry within an incoming connector message body */
export interface IncomingAttachmentEntry {
  name: string;
  url: string;
  mimeType: string;
}

/** POST /api/connectors/:id/incoming */
export interface IncomingMessageBody {
  sessionKey?: unknown;
  channel?: unknown;
  thread?: unknown;
  user?: unknown;
  userId?: unknown;
  text?: unknown;
  messageId?: unknown;
  attachments?: unknown;
  replyContext?: JsonObject;
  transportMeta?: JsonObject;
}

/** POST /api/connectors/:id/proxy */
export interface ProxyActionBody {
  action?: unknown;
  target?: unknown;
  text?: unknown;
  emoji?: unknown;
  channelId?: unknown;
  threadTs?: unknown;
  status?: unknown;
}

/** POST /api/connectors/:name/send */
export interface SendMessageBody {
  channel?: unknown;
  text?: unknown;
  thread?: unknown;
}

// ── Misc ─────────────────────────────────────────────────────────────────────

/** Response shape for GET /api/status */
export interface StatusResponse {
  status: "ok";
  uptime: number;
  port: number;
  engines: {
    default: string;
    claude: { model: string; available: boolean };
    codex: { model: string; available: boolean };
    gemini?: { model: string; available: boolean };
  };
  sessions: { total: number; running: number; active: number };
  connectors: Record<string, unknown>;
}

/** Single entry in GET /api/instances response */
export interface InstanceInfo {
  name: string;
  port: number;
  running: boolean;
  current: boolean;
}

/** POST /api/onboarding */
export interface OnboardingBody {
  portalName?: unknown;
  operatorName?: unknown;
  language?: unknown;
}

/** PUT /api/config — top-level config update body */
export interface PutConfigBody extends Record<string, unknown> {}

/** PUT /api/budgets — budget limits update body */
export interface PutBudgetsBody extends Record<string, unknown> {}
