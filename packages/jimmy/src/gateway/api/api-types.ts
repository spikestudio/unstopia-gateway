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

import type { CronJob, JsonObject, Target } from "../../shared/types.js";

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
  ids?: string[];
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
  alwaysNotify?: boolean;
}

/** PUT /api/org/departments/:name/board — arbitrary board state, shape varies by department */
export type PutBoardBody = Record<string, unknown>;

// ── Cron ─────────────────────────────────────────────────────────────────────

/** POST /api/cron */
export interface CreateCronJobBody {
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: string;
  timezone?: string;
  engine?: string;
  model?: string;
  employee?: string;
  prompt?: string;
  delivery?: CronJob["delivery"];
}

/** PUT /api/cron/:id — partial update merged with existing job (any subset of CreateCronJobBody) */
export type UpdateCronJobBody = Partial<CreateCronJobBody>;

// ── Connectors ───────────────────────────────────────────────────────────────

/** Attachment entry within an incoming connector message body */
export interface IncomingAttachmentEntry {
  name: string;
  url: string;
  mimeType: string;
}

/** POST /api/connectors/:id/incoming */
export interface IncomingMessageBody {
  sessionKey?: string;
  channel?: string;
  thread?: string;
  user?: string;
  userId?: string;
  text?: string;
  messageId?: string;
  attachments?: IncomingAttachmentEntry[];
  replyContext?: JsonObject;
  transportMeta?: JsonObject;
}

/** POST /api/connectors/:id/proxy */
export interface ProxyActionBody {
  action?: string;
  target?: Target;
  text?: string;
  emoji?: string;
  channelId?: string;
  threadTs?: string;
  status?: string;
}

/** POST /api/connectors/:name/send */
export interface SendMessageBody {
  channel?: string;
  text?: string;
  thread?: string;
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
  portalName?: string;
  operatorName?: string;
  language?: string;
}

/** PUT /api/config — top-level config update (known top-level keys; values are validated at runtime) */
export interface PutConfigBody {
  gateway?: Record<string, unknown>;
  engines?: Record<string, unknown>;
  connectors?: Record<string, unknown>;
  portal?: Record<string, unknown>;
  mcp?: Record<string, unknown>;
  [key: string]: unknown;
}

/** PUT /api/budgets — budget limits update body */
export interface PutBudgetsBody {
  employees?: Record<string, number>;
  [key: string]: unknown;
}
