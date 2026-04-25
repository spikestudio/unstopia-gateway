import fs from "node:fs";
import path from "node:path";
import {
  notifyDiscordChannel,
  notifyParentSession,
  notifyRateLimited,
  notifyRateLimitResumed,
} from "../../sessions/callbacks.js";
import { buildContext } from "../../sessions/context.js";
import {
  cancelQueueItem,
  getMessages,
  getSession,
  insertMessage,
  listAllPendingQueueItems,
  updateSession,
} from "../../sessions/registry.js";
import { resolveEffort } from "../../shared/effort.js";
import { logger } from "../../shared/logger.js";
import { JINN_HOME } from "../../shared/paths.js";
import { computeNextRetryDelayMs, computeRateLimitDeadlineMs, detectRateLimit } from "../../shared/rateLimit.js";
import type { Engine, JinnConfig, JsonObject, Session } from "../../shared/types.js";
import { recordClaudeRateLimit } from "../../shared/usageAwareness.js";
import type { ApiContext } from "../types.js";

// ── Transcript helpers ────────────────────────────────────────────────────────

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

export function loadRawTranscript(engineSessionId: string): TranscriptEntry[] {
  const claudeProjectsDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude", "projects");
  if (!fs.existsSync(claudeProjectsDir)) return [];

  const projectDirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true });
  for (const dir of projectDirs) {
    if (!dir.isDirectory()) continue;
    const jsonlPath = path.join(claudeProjectsDir, dir.name, `${engineSessionId}.jsonl`);
    if (!fs.existsSync(jsonlPath)) continue;

    const entries: TranscriptEntry[] = [];
    const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").filter(Boolean);
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
      } catch {}
    }
    return entries;
  }
  return [];
}

export function loadTranscriptMessages(engineSessionId: string): Array<{ role: string; content: string }> {
  const claudeProjectsDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude", "projects");
  if (!fs.existsSync(claudeProjectsDir)) return [];

  const projectDirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true });
  for (const dir of projectDirs) {
    if (!dir.isDirectory()) continue;
    const jsonlPath = path.join(claudeProjectsDir, dir.name, `${engineSessionId}.jsonl`);
    if (!fs.existsSync(jsonlPath)) continue;

    const messages: Array<{ role: string; content: string }> = [];
    const lines = fs.readFileSync(jsonlPath, "utf-8").trim().split("\n").filter(Boolean);
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
      } catch {}
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
  return (
    updateSession(session.id, {
      engine: originalEngine,
      engineSessionId: restoredSessionId,
      transportMeta: nextMeta as JsonObject,
      lastError: null,
    }) ?? session
  );
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
  const currentSession = getSession(session.id);
  if (!currentSession) {
    logger.info(`Skipping deleted web session ${session.id} before run start`);
    return;
  }
  logger.info(
    `Web session ${currentSession.id} running engine "${currentSession.engine}" (model: ${currentSession.model || "default"})`,
  );

  // Ensure status is "running" (may already be set by the POST handler)
  const currentStatus = getSession(currentSession.id);
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

    if (!getSession(currentSession.id)) {
      logger.info(`Skipping completion for deleted web session ${currentSession.id}`);
      return;
    }

    const wasInterrupted = result.error?.startsWith("Interrupted");
    const rateLimit = !wasInterrupted ? detectRateLimit(result) : { limited: false as const };

    if (rateLimit.limited) {
      recordClaudeRateLimit(rateLimit.resetsAt);
      const strategy = config.sessions?.rateLimitStrategy ?? "fallback";

      // Optional fallback: switch to GPT (Codex) while Claude resets
      if (currentSession.engine === "claude" && strategy === "fallback") {
        const fallbackName = config.sessions?.fallbackEngine ?? "codex";
        const fallbackEngine = context.sessionManager.getEngine(fallbackName);
        if (fallbackEngine) {
          const { resumeAt } = computeNextRetryDelayMs(rateLimit.resetsAt);
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
          insertMessage(currentSession.id, "notification", notificationText);
          context.emit("session:notification", { sessionId: currentSession.id, message: notificationText });

          const nextMeta = { ...(currentSession.transportMeta || {}) } as Record<string, unknown>;
          const engineSessionsRaw = nextMeta.engineSessions;
          const engineSessions =
            engineSessionsRaw && typeof engineSessionsRaw === "object" && !Array.isArray(engineSessionsRaw)
              ? { ...(engineSessionsRaw as Record<string, unknown>) }
              : {};
          if (currentSession.engineSessionId) {
            engineSessions.claude = currentSession.engineSessionId;
          }
          nextMeta.engineSessions = engineSessions;
          nextMeta.engineOverride = {
            originalEngine: "claude",
            originalEngineSessionId: currentSession.engineSessionId,
            until: until.toISOString(),
            syncSince,
          };

          updateSession(currentSession.id, {
            engine: fallbackName,
            transportMeta: nextMeta as JsonObject,
            status: "running",
            lastActivity: new Date().toISOString(),
            lastError: resumeAt
              ? `Claude usage limit — using GPT until ${resumeAt.toISOString()}`
              : "Claude usage limit — using GPT temporarily",
          });

          notifyDiscordChannel(
            `⚠️ Claude usage limit reached. Session ${currentSession.id}${currentSession.employee ? ` (${currentSession.employee})` : ""} switching to GPT.`,
          );

          const fallbackConfig = config.engines.codex;
          const fallbackEffort = resolveEffort(fallbackConfig, currentSession, employee);
          const codexResume = typeof engineSessions.codex === "string" ? (engineSessions.codex as string) : undefined;
          const history = getMessages(currentSession.id)
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`);
          const historyText = history.slice(-12).join("\n\n");
          const fallbackPrompt = codexResume
            ? prompt
            : `Continue this conversation and respond to the last USER message.\n\nConversation so far:\n\n${historyText}`;
          const fallbackResult = await fallbackEngine.run({
            prompt: fallbackPrompt,
            resumeSessionId: codexResume,
            systemPrompt,
            cwd: JINN_HOME,
            bin: fallbackConfig.bin,
            model: currentSession.model ?? fallbackConfig.model,
            effortLevel: fallbackEffort,
            cliFlags: employee?.cliFlags,
            sessionId: currentSession.id,
            onStream: (delta) => {
              context.emit("session:delta", {
                sessionId: currentSession.id,
                type: delta.type,
                content: delta.content,
                toolName: delta.toolName,
              });
            },
          });

          if (fallbackResult.result) {
            insertMessage(currentSession.id, "assistant", fallbackResult.result);
          }

          // Persist Codex thread id so future fallbacks can resume it
          const nextEngineSessions = { ...engineSessions };
          if (fallbackResult.sessionId) {
            nextEngineSessions.codex = fallbackResult.sessionId;
          }
          const metaAfter = { ...(getSession(currentSession.id)?.transportMeta || nextMeta) } as Record<
            string,
            unknown
          >;
          metaAfter.engineSessions = nextEngineSessions;
          updateSession(currentSession.id, { transportMeta: metaAfter as JsonObject });

          const completedFallback = updateSession(currentSession.id, {
            engineSessionId: fallbackResult.sessionId,
            status: fallbackResult.error ? "error" : "idle",
            lastActivity: new Date().toISOString(),
            lastError: fallbackResult.error ?? null,
          });
          if (completedFallback) {
            notifyParentSession(
              completedFallback,
              {
                result: fallbackResult.result,
                error: fallbackResult.error ?? null,
                cost: fallbackResult.cost,
                durationMs: fallbackResult.durationMs,
              },
              { alwaysNotify: employee?.alwaysNotify },
            );
          }

          context.emit("session:completed", {
            sessionId: currentSession.id,
            employee: currentSession.employee || config.portal?.portalName || "Jinn",
            title: currentSession.title,
            result: fallbackResult.result,
            error: fallbackResult.error || null,
            cost: fallbackResult.cost,
            durationMs: fallbackResult.durationMs,
          });

          return;
        }
      }

      // Otherwise: wait until reset and retry automatically
      const { delayMs, resumeAt } = computeNextRetryDelayMs(rateLimit.resetsAt);
      const deadlineMs = computeRateLimitDeadlineMs(
        rateLimit.resetsAt,
        rateLimit.resetsAt ? 30 * 60_000 : 6 * 60 * 60_000,
      );

      const resumeText = resumeAt
        ? resumeAt.toLocaleString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;

      logger.info(
        `Web session ${currentSession.id} hit Claude usage limit — will auto-retry ${resumeAt ? `at ${resumeAt.toISOString()}` : `in ${Math.round(delayMs / 1000)}s`}`,
      );

      notifyDiscordChannel(
        `⚠️ Claude usage limit reached. Session ${currentSession.id}${currentSession.employee ? ` (${currentSession.employee})` : ""} paused${resumeText ? ` until ${resumeText}` : ""}.`,
      );

      const notificationText = `⏳ Claude usage limit reached${resumeText ? `. Resets ${resumeText}` : ""} — I'll continue automatically.`;
      insertMessage(currentSession.id, "notification", notificationText);
      context.emit("session:notification", { sessionId: currentSession.id, message: notificationText });

      const waitingSession = updateSession(currentSession.id, {
        ...(result.sessionId?.trim() ? { engineSessionId: result.sessionId } : {}),
        status: "waiting",
        lastActivity: new Date().toISOString(),
        lastError: resumeAt
          ? `Claude usage limit — resumes ${resumeAt.toISOString()}`
          : "Claude usage limit — waiting for reset",
      });

      notifyRateLimited(
        (waitingSession ?? { ...currentSession, status: "waiting" }) as Session,
        resumeAt ? resumeAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : undefined,
      );

      context.emit("session:rate-limited", {
        sessionId: currentSession.id,
        employee: currentSession.employee,
        error: result.error,
        resetsAt: rateLimit.resetsAt ?? null,
      });

      // Keep lastActivity fresh while waiting (UI / status endpoints)
      const heartbeat = setInterval(() => {
        updateSession(currentSession.id, { status: "waiting", lastActivity: new Date().toISOString() });
      }, 60_000);

      try {
        let attempt = 0;
        let nextDelayMs = delayMs;

        while (Date.now() < deadlineMs) {
          await new Promise<void>((r) => setTimeout(r, nextDelayMs));
          attempt++;

          const current = getSession(currentSession.id);
          if (!current || current.status === "error") {
            logger.info(`Web session ${currentSession.id} stopped while waiting for usage reset`);
            return;
          }

          logger.info(`Web session ${currentSession.id} retrying after usage limit (attempt ${attempt})`);

          const retryResult = await engine.run({
            prompt,
            resumeSessionId: current.engineSessionId ?? undefined,
            systemPrompt,
            cwd: JINN_HOME,
            bin: engineConfig.bin,
            model: current.model ?? engineConfig.model,
            effortLevel,
            cliFlags: employee?.cliFlags,
            sessionId: currentSession.id,
            onStream: (delta) => {
              context.emit("session:delta", {
                sessionId: currentSession.id,
                type: delta.type,
                content: delta.content,
                toolName: delta.toolName,
              });
            },
          });

          const retryInterrupted = retryResult.error?.startsWith("Interrupted");
          const retryRateLimit = !retryInterrupted ? detectRateLimit(retryResult) : { limited: false as const };

          if (retryRateLimit.limited) {
            recordClaudeRateLimit(retryRateLimit.resetsAt);
            logger.info(`Web session ${currentSession.id} still rate limited (attempt ${attempt})`);
            const next = computeNextRetryDelayMs(retryRateLimit.resetsAt);
            nextDelayMs = next.delayMs;
            updateSession(currentSession.id, {
              ...(retryResult.sessionId?.trim() ? { engineSessionId: retryResult.sessionId } : {}),
              status: "waiting",
              lastActivity: new Date().toISOString(),
              lastError: next.resumeAt
                ? `Claude usage limit — resumes ${next.resumeAt.toISOString()}`
                : "Claude usage limit — waiting for reset",
            });
            continue;
          }

          if (retryResult.result) {
            insertMessage(currentSession.id, "assistant", retryResult.result);
          }

          const completedAfterRetry = updateSession(currentSession.id, {
            ...(retryResult.sessionId?.trim() ? { engineSessionId: retryResult.sessionId } : {}),
            status: retryResult.error ? "error" : "idle",
            lastActivity: new Date().toISOString(),
            lastError: retryResult.error ?? null,
          });

          if (completedAfterRetry) {
            notifyRateLimitResumed(completedAfterRetry);
            notifyDiscordChannel(
              `✅ Claude usage limit cleared. Session ${currentSession.id}${currentSession.employee ? ` (${currentSession.employee})` : ""} resumed.`,
            );
            notifyParentSession(
              completedAfterRetry,
              {
                result: retryResult.result,
                error: retryResult.error ?? null,
                cost: retryResult.cost,
                durationMs: retryResult.durationMs,
              },
              { alwaysNotify: employee?.alwaysNotify },
            );
          }

          context.emit("session:completed", {
            sessionId: currentSession.id,
            employee: currentSession.employee || config.portal?.portalName || "Jinn",
            title: currentSession.title,
            result: retryResult.result,
            error: retryResult.error || null,
            cost: retryResult.cost,
            durationMs: retryResult.durationMs,
          });

          logger.info(`Web session ${currentSession.id} resumed after usage reset`);
          return;
        }

        // Exhausted waiting window
        notifyDiscordChannel(
          `❌ Claude usage limit did not clear in time. Session ${currentSession.id}${currentSession.employee ? ` (${currentSession.employee})` : ""} has been stopped.`,
        );
        const erroredSession = updateSession(currentSession.id, {
          status: "error",
          lastActivity: new Date().toISOString(),
          lastError: "Claude usage limit did not clear in time",
        });
        if (erroredSession) {
          notifyParentSession(
            erroredSession,
            { error: "Claude usage limit did not clear in time" },
            { alwaysNotify: employee?.alwaysNotify },
          );
        }
        context.emit("session:completed", {
          sessionId: currentSession.id,
          result: null,
          error: "Claude usage limit did not clear in time",
        });
        logger.warn(`Web session ${currentSession.id} exhausted usage limit retries`);
        return;
      } finally {
        clearInterval(heartbeat);
      }
    }

    // Persist the assistant response
    if (result.result) {
      insertMessage(currentSession.id, "assistant", result.result);
    }

    const completedSession = updateSession(currentSession.id, {
      ...(result.sessionId?.trim() ? { engineSessionId: result.sessionId } : {}),
      status: result.error ? "error" : "idle",
      lastActivity: new Date().toISOString(),
      lastError: result.error ?? null,
    });
    if (syncRequested && !rateLimit.limited && !wasInterrupted) {
      const meta = (getSession(currentSession.id)?.transportMeta || currentSession.transportMeta || {}) as Record<
        string,
        unknown
      >;
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
    if (!getSession(currentSession.id)) {
      logger.info(`Skipping error handling for deleted web session ${currentSession.id}: ${errMsg}`);
      return;
    }
    const erroredSession = updateSession(currentSession.id, {
      status: "error",
      lastActivity: new Date().toISOString(),
      lastError: errMsg,
    });
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

// ── resumePendingWebQueueItems ────────────────────────────────────────────────

export function resumePendingWebQueueItemsImpl(context: ApiContext): void {
  const pending = listAllPendingQueueItems();
  if (pending.length === 0) return;

  let resumed = 0;
  for (const item of pending) {
    let session = getSession(item.sessionId);
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
