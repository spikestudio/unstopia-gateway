import {
  notifyDiscordChannel as defaultNotifyDiscordChannel,
  notifyParentSession as defaultNotifyParentSession,
} from "../../sessions/callbacks.js";
import {
  getMessages as defaultGetMessages,
  getSession as defaultGetSession,
  insertMessage as defaultInsertMessage,
  updateSession as defaultUpdateSession,
} from "../../sessions/registry.js";
import { resolveEffort } from "../../shared/effort.js";
import { logger } from "../../shared/logger.js";
import { JINN_HOME } from "../../shared/paths.js";
import { computeNextRetryDelayMs } from "../../shared/rateLimit.js";
import type { Employee, Engine, JinnConfig, JsonObject, Session } from "../../shared/types.js";
import type { ApiContext } from "../types.js";
import { unwrapSession } from "./utils.js";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface FallbackDeps {
  updateSession: typeof defaultUpdateSession;
  insertMessage: typeof defaultInsertMessage;
  getMessages: typeof defaultGetMessages;
  getSession: typeof defaultGetSession;
  notifyDiscordChannel: typeof defaultNotifyDiscordChannel;
  notifyParentSession: typeof defaultNotifyParentSession;
}

export interface FallbackRunParams {
  prompt: string;
  systemPrompt?: string;
  rateLimit: { resetsAt?: number };
  fallbackEngineConfig: {
    bin?: string;
    model?: string;
    effortLevel?: string;
    childEffortOverride?: string;
  };
  employee: Pick<Employee, "cliFlags" | "alwaysNotify" | "effortLevel"> | undefined;
}

// ── Helper ────────────────────────────────────────────────────────────────────


// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Switch the session from Claude to a fallback engine (e.g. Codex) when a
 * rate limit is detected. Returns true if the fallback run was attempted,
 * false if fallbackEngine is null/undefined (caller should continue with the
 * default post-run logic).
 */
export async function switchToFallback(
  deps: FallbackDeps,
  session: Session,
  fallbackEngine: Engine | null | undefined,
  fallbackName: string,
  runParams: FallbackRunParams,
  config: JinnConfig,
  context: ApiContext,
): Promise<boolean> {
  if (fallbackEngine == null) {
    return false;
  }

  const { resumeAt } = computeNextRetryDelayMs(runParams.rateLimit.resetsAt);
  const until = resumeAt ?? new Date(Date.now() + 6 * 60 * 60_000);
  const syncSince = new Date().toISOString();

  const resumeText = resumeAt
    ? resumeAt.toLocaleString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const notificationText = `⚠️ Claude usage limit reached${resumeText ? `. Resets ${resumeText}` : ""}. Switching to GPT for now.`;
  deps.insertMessage(session.id, "notification", notificationText);
  context.emit("session:notification", { sessionId: session.id, message: notificationText });

  const nextMeta = { ...(session.transportMeta || {}) } as Record<string, unknown>;
  const engineSessionsRaw = nextMeta.engineSessions;
  const engineSessions =
    engineSessionsRaw && typeof engineSessionsRaw === "object" && !Array.isArray(engineSessionsRaw)
      ? { ...(engineSessionsRaw as Record<string, unknown>) }
      : {};
  if (session.engineSessionId) {
    engineSessions.claude = session.engineSessionId;
  }
  nextMeta.engineSessions = engineSessions;
  nextMeta.engineOverride = {
    originalEngine: "claude",
    originalEngineSessionId: session.engineSessionId,
    until: until.toISOString(),
    syncSince,
  };

  deps.updateSession(session.id, {
    engine: fallbackName,
    transportMeta: nextMeta as JsonObject,
    status: "running",
    lastActivity: new Date().toISOString(),
    lastError: resumeAt
      ? `Claude usage limit — using GPT until ${resumeAt.toISOString()}`
      : "Claude usage limit — using GPT temporarily",
  });

  deps.notifyDiscordChannel(
    `⚠️ Claude usage limit reached. Session ${session.id}${session.employee ? ` (${session.employee})` : ""} switching to GPT.`,
  );

  const fallbackEffort = resolveEffort(runParams.fallbackEngineConfig, session, runParams.employee);
  const codexResume = typeof engineSessions.codex === "string" ? (engineSessions.codex as string) : undefined;
  const history = deps
    .getMessages(session.id)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`);
  const historyText = history.slice(-12).join("\n\n");
  const fallbackPrompt = codexResume
    ? runParams.prompt
    : `Continue this conversation and respond to the last USER message.\n\nConversation so far:\n\n${historyText}`;

  logger.info(`[session-fallback] Switching session ${session.id} to ${fallbackName} engine`);

  const fallbackResult = await fallbackEngine.run({
    prompt: fallbackPrompt,
    resumeSessionId: codexResume,
    systemPrompt: runParams.systemPrompt,
    cwd: JINN_HOME,
    bin: runParams.fallbackEngineConfig.bin,
    model: session.model ?? runParams.fallbackEngineConfig.model,
    effortLevel: fallbackEffort,
    cliFlags: runParams.employee?.cliFlags,
    sessionId: session.id,
    onStream: (delta) => {
      context.emit("session:delta", {
        sessionId: session.id,
        type: delta.type,
        content: delta.content,
        toolName: delta.toolName,
      });
    },
  });

  if (fallbackResult.result) {
    deps.insertMessage(session.id, "assistant", fallbackResult.result);
  }

  // Persist Codex thread id so future fallbacks can resume it
  const nextEngineSessions = { ...engineSessions };
  if (fallbackResult.sessionId) {
    nextEngineSessions.codex = fallbackResult.sessionId;
  }
  const freshResult = deps.getSession(session.id);
  const freshMeta = {
    ...(unwrapSession(freshResult)?.transportMeta || nextMeta),
  } as Record<string, unknown>;
  freshMeta.engineSessions = nextEngineSessions;
  deps.updateSession(session.id, { transportMeta: freshMeta as JsonObject });

  const completedResult = deps.updateSession(session.id, {
    engineSessionId: fallbackResult.sessionId,
    status: fallbackResult.error ? "error" : "idle",
    lastActivity: new Date().toISOString(),
    lastError: fallbackResult.error ?? null,
  });
  const completed = completedResult.ok ? completedResult.value : null;
  if (completed) {
    deps.notifyParentSession(
      completed,
      {
        result: fallbackResult.result,
        error: fallbackResult.error ?? null,
        cost: fallbackResult.cost,
        durationMs: fallbackResult.durationMs,
      },
      { alwaysNotify: runParams.employee?.alwaysNotify },
    );
  }

  context.emit("session:completed", {
    sessionId: session.id,
    employee: session.employee || config.portal?.portalName || "Jinn",
    title: session.title,
    result: fallbackResult.result,
    error: fallbackResult.error || null,
    cost: fallbackResult.cost,
    durationMs: fallbackResult.durationMs,
  });

  return true;
}

// ── Default deps (production wiring) ─────────────────────────────────────────

export const defaultFallbackDeps: FallbackDeps = {
  updateSession: defaultUpdateSession,
  insertMessage: defaultInsertMessage,
  getMessages: defaultGetMessages,
  getSession: defaultGetSession,
  notifyDiscordChannel: defaultNotifyDiscordChannel,
  notifyParentSession: defaultNotifyParentSession,
};
