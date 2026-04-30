import fs, { type Dirent } from "node:fs";
import path from "node:path";
import { notifyParentSession } from "../../sessions/callbacks.js";
import { buildContext } from "../../sessions/context.js";
import { getMessages, getSession, insertMessage, updateSession } from "../../sessions/registry.js";
import { resolveEffort } from "../../shared/effort.js";
import { logger } from "../../shared/logger.js";
import { JINN_HOME } from "../../shared/paths.js";
import { detectRateLimit } from "../../shared/rateLimit.js";
import type { Engine, JinnConfig, JsonObject, Session } from "../../shared/types.js";
import { recordClaudeRateLimit } from "../../shared/usageAwareness.js";
import type { ApiContext } from "../types.js";
import { defaultFallbackDeps, switchToFallback } from "./session-fallback.js";
import { defaultRateLimitDeps, handleRateLimit, retryUntilDeadline } from "./session-rate-limit.js";
import { unwrapSession } from "./utils.js";

// ── Transcript helpers ────────────────────────────────────────────────────────

export interface TranscriptReader {
  existsSync(path: string): boolean;
  readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  readFileSync(path: string, encoding: "utf-8"): string;
}

const defaultReader: TranscriptReader = fs;

export interface TranscriptContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  id?: string;
}

export interface TranscriptEntry {
  role: "user" | "assistant" | "system";
  content: TranscriptContentBlock[];
}

export function loadRawTranscript(engineSessionId: string, reader?: TranscriptReader): TranscriptEntry[] {
  const r = reader ?? defaultReader;
  const claudeProjectsDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude", "projects");
  if (!r.existsSync(claudeProjectsDir)) return [];

  const projectDirs = r.readdirSync(claudeProjectsDir, { withFileTypes: true });
  for (const dir of projectDirs) {
    if (!dir.isDirectory()) continue;
    const jsonlPath = path.join(claudeProjectsDir, dir.name, `${engineSessionId}.jsonl`);
    if (!r.existsSync(jsonlPath)) continue;

    const entries: TranscriptEntry[] = [];
    const lines = r.readFileSync(jsonlPath, "utf-8").trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const type = obj.type;
        if (type !== "user" && type !== "assistant") continue;
        const msg = obj.message;
        if (!msg) continue;

        const rawContent = msg.content;
        const blocks: TranscriptContentBlock[] = [];

        if (typeof rawContent === "string") {
          if (rawContent.trim()) blocks.push({ type: "text", text: rawContent });
        } else if (Array.isArray(rawContent)) {
          for (const block of rawContent) {
            if (!block || typeof block !== "object") continue;
            const b = block as Record<string, unknown>;
            const blockType = String(b.type || "");
            if (blockType === "text") {
              blocks.push({ type: "text", text: String(b.text || "") });
            } else if (blockType === "tool_use") {
              blocks.push({
                type: "tool_use",
                name: String(b.name || ""),
                input: (b.input as Record<string, unknown>) || {},
              });
            } else if (blockType === "tool_result") {
              const resultContent = b.content;
              let resultText: string;
              if (typeof resultContent === "string") {
                resultText = resultContent;
              } else if (Array.isArray(resultContent)) {
                resultText = (resultContent as Record<string, unknown>[])
                  .filter((rc) => rc.type === "text")
                  .map((rc) => String(rc.text || ""))
                  .join("");
              } else {
                resultText = "";
              }
              blocks.push({ type: "tool_result", text: resultText });
            } else if (blockType === "thinking") {
              blocks.push({ type: "thinking", text: String(b.thinking || b.text || "") });
            }
          }
        }

        if (blocks.length > 0) {
          entries.push({ role: type as "user" | "assistant", content: blocks });
        }
      } catch (e) {
        logger.debug(`Skipping malformed JSONL line in transcript: ${e}`);
      }
    }
    return entries;
  }
  return [];
}

export function loadTranscriptMessages(
  engineSessionId: string,
  reader?: TranscriptReader,
): Array<{ role: string; content: string }> {
  const r = reader ?? defaultReader;
  const claudeProjectsDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude", "projects");
  if (!r.existsSync(claudeProjectsDir)) return [];

  const projectDirs = r.readdirSync(claudeProjectsDir, { withFileTypes: true });
  for (const dir of projectDirs) {
    if (!dir.isDirectory()) continue;
    const jsonlPath = path.join(claudeProjectsDir, dir.name, `${engineSessionId}.jsonl`);
    if (!r.existsSync(jsonlPath)) continue;

    const messages: Array<{ role: string; content: string }> = [];
    const lines = r.readFileSync(jsonlPath, "utf-8").trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const type = obj.type;
        if (type !== "user" && type !== "assistant") continue;
        const msg = obj.message;
        if (!msg) continue;

        let content = msg.content;
        if (Array.isArray(content)) {
          content = content
            .filter((b: Record<string, unknown>) => b.type === "text")
            .map((b: Record<string, unknown>) => b.text)
            .join("");
        }
        if (typeof content === "string" && content.trim()) {
          messages.push({ role: type, content: content.trim() });
        }
      } catch (e) {
        logger.debug(`Skipping malformed JSONL line in transcript: ${e}`);
      }
    }
    return messages;
  }
  return [];
}

// ── Engine override / dispatch helpers ───────────────────────────────────────

export function maybeRevertEngineOverride(session: Session): Session {
  const meta = (session.transportMeta || {}) as Record<string, unknown>;
  const override = meta.engineOverride as Record<string, unknown> | undefined;
  if (!override) return session;

  const originalEngine = typeof override.originalEngine === "string" ? override.originalEngine : null;
  const originalEngineSessionId =
    typeof override.originalEngineSessionId === "string" ? override.originalEngineSessionId : null;
  const syncSince = typeof override.syncSince === "string" ? override.syncSince : null;
  const untilIso = typeof override.until === "string" ? override.until : null;
  if (!originalEngine || !untilIso) return session;

  const until = new Date(untilIso);
  if (Number.isNaN(until.getTime())) return session;
  if (until.getTime() > Date.now()) return session;

  const engineSessionsRaw = meta.engineSessions;
  const engineSessions =
    engineSessionsRaw && typeof engineSessionsRaw === "object" && !Array.isArray(engineSessionsRaw)
      ? { ...(engineSessionsRaw as Record<string, unknown>) }
      : {};

  if (session.engine && session.engineSessionId) {
    engineSessions[String(session.engine)] = session.engineSessionId;
  }

  const restoredSessionId =
    originalEngineSessionId ??
    (typeof engineSessions[originalEngine] === "string" ? (engineSessions[originalEngine] as string) : null);

  const nextMeta = { ...meta, engineSessions } as Record<string, unknown>;
  if (originalEngine === "claude" && syncSince && session.engine !== "claude") {
    nextMeta.claudeSyncSince = syncSince;
  }
  delete (nextMeta as Record<string, unknown>).engineOverride;
  const updateResult = updateSession(session.id, {
    engine: originalEngine,
    engineSessionId: restoredSessionId,
    transportMeta: nextMeta as JsonObject,
    lastError: null,
  });
  if (updateResult.ok && updateResult.value) return updateResult.value;
  return session;
}

export function dispatchWebSessionRun(
  session: Session,
  prompt: string,
  engine: Engine,
  config: JinnConfig,
  context: ApiContext,
  opts?: { delayMs?: number; queueItemId?: string; attachments?: string[] },
): void {
  const run = async () => {
    await context.sessionManager.getQueue().enqueue(
      session.sessionKey || session.sourceRef,
      async () => {
        context.emit("session:started", { sessionId: session.id });
        await runWebSession(session, prompt, engine, config, context, opts?.attachments);
      },
      opts?.queueItemId,
    );
  };

  const launch = () => {
    run().catch((err) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Web session ${session.id} dispatch error: ${errMsg}`);
      updateSession(session.id, {
        status: "error",
        lastActivity: new Date().toISOString(),
        lastError: errMsg,
      });
      context.emit("session:completed", {
        sessionId: session.id,
        result: null,
        error: errMsg,
      });
    });
  };

  if (opts?.delayMs && opts.delayMs > 0) {
    setTimeout(launch, opts.delayMs);
  } else {
    launch();
  }
}

// ── runWebSession ─────────────────────────────────────────────────────────────

export async function runWebSession(
  session: Session,
  prompt: string,
  engine: Engine,
  config: JinnConfig,
  context: ApiContext,
  attachments?: string[],
): Promise<void> {
  const currentSession = unwrapSession(getSession(session.id));
  if (!currentSession) {
    logger.info(`Skipping deleted web session ${session.id} before run start`);
    return;
  }
  logger.info(
    `Web session ${currentSession.id} running engine "${currentSession.engine}" (model: ${currentSession.model || "default"})`,
  );

  // Ensure status is "running" (may already be set by the POST handler)
  const currentStatus = unwrapSession(getSession(currentSession.id));
  if (currentStatus && currentStatus.status !== "running") {
    updateSession(currentSession.id, {
      status: "running",
      lastActivity: new Date().toISOString(),
    });
  }

  // If this session has an assigned employee, load their persona
  let employee: import("../../shared/types.js").Employee | undefined;
  if (currentSession.employee) {
    const { findEmployee, scanOrg } = await import("../org.js");
    const registry = scanOrg();
    employee = findEmployee(currentSession.employee, registry);
  }

  const { scanOrg: scanOrgForHierarchy } = await import("../org.js");
  const { resolveOrgHierarchy } = await import("../org-hierarchy.js");
  const orgHierarchy = resolveOrgHierarchy(scanOrgForHierarchy());

  try {
    const systemPrompt = buildContext({
      source: "web",
      channel: currentSession.sourceRef,
      user: "web-user",
      employee,
      connectors: Array.from(context.connectors.keys()),
      config,
      sessionId: currentSession.id,
      hierarchy: orgHierarchy,
    });

    const engineConfig =
      currentSession.engine === "codex"
        ? config.engines.codex
        : currentSession.engine === "gemini"
          ? (config.engines.gemini ?? config.engines.claude)
          : config.engines.claude;
    const effortLevel = resolveEffort(engineConfig, currentSession, employee);

    let lastHeartbeatAt = 0;
    const runHeartbeat = setInterval(() => {
      updateSession(currentSession.id, {
        status: "running",
        lastActivity: new Date().toISOString(),
      });
    }, 5000);

    const syncSinceIso = (currentSession.transportMeta as Record<string, unknown> | null)?.claudeSyncSince;
    const syncSinceMs = typeof syncSinceIso === "string" ? new Date(syncSinceIso).getTime() : NaN;
    const syncRequested =
      currentSession.engine === "claude" && typeof syncSinceIso === "string" && Number.isFinite(syncSinceMs);
    const promptToRun = syncRequested
      ? (() => {
          const sinceMessages = getMessages(currentSession.id)
            .filter((m) => (m.role === "user" || m.role === "assistant") && m.timestamp >= syncSinceMs)
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`);
          const transcript = sinceMessages.slice(-20).join("\n\n");
          return `We temporarily switched to GPT due to a Claude usage limit. Sync your context with this transcript (most recent last), then respond to the last USER message.\n\n${transcript}`;
        })()
      : prompt;

    const result = await engine
      .run({
        prompt: promptToRun,
        resumeSessionId: currentSession.engineSessionId ?? undefined,
        systemPrompt,
        cwd: JINN_HOME,
        bin: engineConfig.bin,
        model: currentSession.model ?? engineConfig.model,
        effortLevel,
        cliFlags: employee?.cliFlags,
        attachments: attachments?.length ? attachments : undefined,
        sessionId: currentSession.id,
        onStream: (delta) => {
          const now = Date.now();
          if (now - lastHeartbeatAt >= 2000) {
            lastHeartbeatAt = now;
            updateSession(currentSession.id, {
              status: "running",
              lastActivity: new Date(now).toISOString(),
            });
          }
          try {
            context.emit("session:delta", {
              sessionId: currentSession.id,
              type: delta.type,
              content: delta.content,
              toolName: delta.toolName,
            });
          } catch (err) {
            logger.warn(
              `Failed to emit stream delta for session ${currentSession.id}: ${err instanceof Error ? err.message : err}`,
            );
          }
        },
      })
      .finally(() => {
        clearInterval(runHeartbeat);
      });

    if (!unwrapSession(getSession(currentSession.id))) {
      logger.info(`Skipping completion for deleted web session ${currentSession.id}`);
      return;
    }

    const wasInterrupted = result.error?.startsWith("Interrupted");
    const rateLimit = !wasInterrupted ? detectRateLimit(result) : { limited: false as const };

    if (rateLimit.limited) {
      recordClaudeRateLimit(rateLimit.resetsAt);
      const strategy = config.sessions?.rateLimitStrategy ?? "fallback";

      if (currentSession.engine === "claude" && strategy === "fallback") {
        const fallbackName = config.sessions?.fallbackEngine ?? "codex";
        const fallbackEngine = context.sessionManager.getEngine(fallbackName);
        const handled = await switchToFallback(
          defaultFallbackDeps,
          currentSession,
          fallbackEngine ?? null,
          fallbackName,
          { prompt, systemPrompt, rateLimit, fallbackEngineConfig: config.engines.codex, employee },
          config,
          context,
        );
        if (handled) return;
      }

      const { delayMs, deadlineMs } = await handleRateLimit(
        defaultRateLimitDeps,
        currentSession,
        { limited: true, resetsAt: rateLimit.resetsAt },
        result.error,
        context,
      );
      await retryUntilDeadline(
        defaultRateLimitDeps,
        currentSession,
        deadlineMs,
        delayMs,
        engine,
        { prompt, systemPrompt, engineConfig, effortLevel, employee, attachments },
        config,
        context,
      );
      return;
    }

    // Persist the assistant response
    if (result.result) {
      insertMessage(currentSession.id, "assistant", result.result);
    }

    const completedSessionResult = updateSession(currentSession.id, {
      ...(result.sessionId?.trim() ? { engineSessionId: result.sessionId } : {}),
      status: result.error ? "error" : "idle",
      lastActivity: new Date().toISOString(),
      lastError: result.error ?? null,
    });
    const completedSession = completedSessionResult.ok ? completedSessionResult.value : null;
    if (syncRequested && !rateLimit.limited && !wasInterrupted) {
      const meta = (unwrapSession(getSession(currentSession.id))?.transportMeta ||
        currentSession.transportMeta ||
        {}) as Record<string, unknown>;
      if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        const nextMeta = { ...meta } as Record<string, unknown>;
        delete nextMeta.claudeSyncSince;
        updateSession(currentSession.id, { transportMeta: nextMeta as JsonObject });
      }
    }
    if (completedSession) {
      notifyParentSession(
        completedSession,
        { result: result.result, error: result.error ?? null, cost: result.cost, durationMs: result.durationMs },
        { alwaysNotify: employee?.alwaysNotify },
      );
    }

    context.emit("session:completed", {
      sessionId: currentSession.id,
      employee: currentSession.employee || config.portal?.portalName || "Jinn",
      title: currentSession.title,
      result: result.result,
      error: result.error || null,
      cost: result.cost,
      durationMs: result.durationMs,
    });

    logger.info(
      `Web session ${currentSession.id} completed` +
        (result.durationMs ? ` in ${result.durationMs}ms` : "") +
        (result.cost ? ` ($${result.cost.toFixed(4)})` : ""),
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (!unwrapSession(getSession(currentSession.id))) {
      logger.info(`Skipping error handling for deleted web session ${currentSession.id}: ${errMsg}`);
      return;
    }
    const erroredSessionResult2 = updateSession(currentSession.id, {
      status: "error",
      lastActivity: new Date().toISOString(),
      lastError: errMsg,
    });
    const erroredSession = erroredSessionResult2.ok ? erroredSessionResult2.value : null;
    if (erroredSession) {
      notifyParentSession(erroredSession, { error: errMsg }, { alwaysNotify: employee?.alwaysNotify });
    }
    context.emit("session:completed", {
      sessionId: currentSession.id,
      result: null,
      error: errMsg,
    });
    logger.error(`Web session ${currentSession.id} error: ${errMsg}`);
  }
}
