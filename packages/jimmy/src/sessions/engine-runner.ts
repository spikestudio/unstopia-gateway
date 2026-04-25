import fs from "node:fs";
import { checkBudget } from "../gateway/budgets.js";
import type { Repositories } from "./repositories/index.js";
import { scanOrg } from "../gateway/org.js";
import { resolveOrgHierarchy } from "../gateway/org-hierarchy.js";
import { cleanupMcpConfigFile, resolveMcpServers, writeMcpConfigFile } from "../mcp/resolver.js";
import { resolveEffort } from "../shared/effort.js";
import { logger } from "../shared/logger.js";
import { JINN_HOME } from "../shared/paths.js";
import {
  computeNextRetryDelayMs,
  computeRateLimitDeadlineMs,
  detectRateLimit,
  isDeadSessionError,
} from "../shared/rateLimit.js";
import type {
  Connector,
  Employee,
  Engine,
  IncomingMessage,
  JinnConfig,
  JsonObject,
  Session,
  Target,
} from "../shared/types.js";
import {
  getClaudeExpectedResetAt,
  isLikelyNearClaudeUsageLimit,
  recordClaudeRateLimit,
} from "../shared/usageAwareness.js";
import { notifyDiscordChannel, notifyParentSession, notifyRateLimited, notifyRateLimitResumed } from "./callbacks.js";
import { buildContext } from "./context.js";

export function mergeTransportMeta(
  existing: Session["transportMeta"],
  incoming: IncomingMessage["transportMeta"],
): Session["transportMeta"] {
  const baseExisting =
    existing && typeof existing === "object" && !Array.isArray(existing) ? (existing as Record<string, unknown>) : {};
  const baseIncoming =
    incoming && typeof incoming === "object" && !Array.isArray(incoming) ? (incoming as Record<string, unknown>) : {};

  const merged: Record<string, unknown> = { ...baseExisting, ...baseIncoming };

  // Preserve Jinn internal keys from being overwritten by transport adapters.
  for (const key of ["engineOverride", "engineSessions", "claudeSyncSince"]) {
    if (baseExisting[key] !== undefined) merged[key] = baseExisting[key];
  }

  return merged as JsonObject;
}

export async function runSession(
  session: Session,
  msg: IncomingMessage,
  attachments: string[],
  connector: Connector,
  target: Target,
  engines: Map<string, Engine>,
  config: JinnConfig,
  getConnectors: () => Map<string, Connector>,
  employee?: Employee,
  repos?: Repositories,
): Promise<void> {
  const engine = engines.get(session.engine);
  if (!engine) {
    logger.error(`Engine "${session.engine}" not found for session ${session.id}`);
    await connector.replyMessage(target, `Error: engine "${session.engine}" not available.`);
    return;
  }

  repos?.messages.insertMessage(session.id, "user", msg.text);

  const capabilities = connector.getCapabilities();
  const decorateMessages = session.source !== "cron";

  if (decorateMessages && capabilities.reactions) {
    await connector.addReaction(target, "eyes").catch(() => {});
  }

  // Set native typing indicator (Slack assistant.threads.setStatus)
  const threadTs = target.thread || target.messageTs;
  if (decorateMessages && connector.setTypingStatus) {
    await connector.setTypingStatus(target.channel, threadTs, "is thinking...").catch(() => {});
  }

  repos?.sessions.updateSession(session.id, {
    status: "running",
    replyContext: msg.replyContext,
    messageId: msg.messageId ?? null,
    transportMeta: mergeTransportMeta(session.transportMeta, msg.transportMeta),
    lastActivity: new Date().toISOString(),
  });

  // Resolve MCP config before try block so it's accessible in catch for cleanup
  let mcpConfigPath: string | undefined;

  let hierarchy: import("../shared/types.js").OrgHierarchy | undefined;
  try {
    hierarchy = resolveOrgHierarchy(scanOrg());
  } catch {
    /* fallback to filesystem scan in context builder */
  }

  try {
    const connectorNames = [...getConnectors().keys()];
    const systemPrompt = buildContext({
      source: session.source,
      channel: msg.channel,
      thread: msg.thread,
      user: msg.user,
      employee,
      connectors: connectorNames,
      config,
      sessionId: session.id,
      channelName: (msg.transportMeta?.channelName as string) || undefined,
      hierarchy,
    });

    const engineConfig =
      session.engine === "codex"
        ? config.engines.codex
        : session.engine === "gemini"
          ? (config.engines.gemini ?? config.engines.claude)
          : config.engines.claude;
    if (session.engine === "claude") {
      const mcpConfig = resolveMcpServers(config.mcp, employee);
      if (Object.keys(mcpConfig.mcpServers).length > 0) {
        mcpConfigPath = writeMcpConfigFile(mcpConfig, session.id);
      }
    }

    const effortLevel = resolveEffort(engineConfig, session, employee);

    // If we previously switched to GPT while Claude was rate-limited, inject a sync transcript
    // so Claude can resume with full context when it comes back online.
    const syncSinceIso = (session.transportMeta as Record<string, unknown> | null)?.claudeSyncSince;
    let promptToRun = msg.text;
    const syncSinceMs = typeof syncSinceIso === "string" ? new Date(syncSinceIso).getTime() : NaN;
    const syncRequested =
      session.engine === "claude" && typeof syncSinceIso === "string" && Number.isFinite(syncSinceMs);
    if (syncRequested) {
      const sinceMessages = (repos?.messages.getMessages(session.id) ?? [])
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.timestamp >= syncSinceMs)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`);
      const transcript = sinceMessages.slice(-20).join("\n\n");
      promptToRun = `We temporarily switched to GPT due to a Claude usage limit. Sync your context with this transcript (most recent last), then respond to the last USER message.\n\n${transcript}`;
    }

    // Budget enforcement — check BEFORE engine.run()
    if (session.employee) {
      const configAsUnknown = config as unknown as Record<string, unknown>;
      const budgetConfig =
        configAsUnknown.budgets !== undefined
          ? ((configAsUnknown.budgets as Record<string, unknown>).employees as Record<string, number> | undefined)
          : undefined;
      if (budgetConfig && session.employee in budgetConfig) {
        const budgetStatus = checkBudget(session.employee, budgetConfig);
        if (budgetStatus === "paused") {
          logger.warn(`Session ${session.id} blocked: employee "${session.employee}" has exceeded their budget`);
          const pausedMsg = `Budget limit exceeded for employee "${session.employee}". Session blocked.`;
          repos?.sessions.updateSession(session.id, {
            status: "error",
            lastActivity: new Date().toISOString(),
            lastError: pausedMsg,
          });
          if (decorateMessages && connector.setTypingStatus) {
            await connector.setTypingStatus(target.channel, threadTs, "").catch(() => {});
          }
          await connector.replyMessage(target, `⛔ ${pausedMsg}`).catch(() => {});
          if (decorateMessages && capabilities.reactions) {
            await connector.removeReaction(target, "eyes").catch(() => {});
          }
          return;
        }
      }
    }

    // Heuristic preflight warning: Claude usage limits don't expose a precise "remaining" budget.
    // If we've hit the limit recently and this looks like a heavy turn, warn before we spend time.
    if (decorateMessages && session.engine === "claude" && isLikelyNearClaudeUsageLimit()) {
      const modelName = (session.model ?? engineConfig.model ?? "").toLowerCase();
      const heavyEffort = ["high", "xhigh", "max"].includes((effortLevel || "").toLowerCase());
      const heavyModel = modelName.includes("opus");
      const looksBig = attachments.length > 0 || msg.text.length > 6000;
      if ((heavyEffort || heavyModel) && looksBig) {
        const expectedResetAt = getClaudeExpectedResetAt();
        const resumeText = expectedResetAt
          ? expectedResetAt.toLocaleString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;
        await connector
          .replyMessage(
            target,
            `⚠️ Heads up: Claude usage limits were hit recently, and this looks like a bigger task. If you're near the limit, it may pause${resumeText ? ` until ~${resumeText}` : ""}.`,
          )
          .catch(() => {});
      }
    }

    const result = await engine.run({
      prompt: promptToRun,
      resumeSessionId: session.engineSessionId ?? undefined,
      systemPrompt,
      cwd: JINN_HOME,
      bin: engineConfig.bin,
      model: session.model ?? engineConfig.model,
      effortLevel,
      cliFlags: employee?.cliFlags,
      mcpConfigPath,
      attachments: attachments.length > 0 ? attachments : undefined,
      sessionId: session.id,
    });

    const wasInterrupted = result.error?.startsWith("Interrupted");

    // Dead session detection: if the engine session ID is stale (expired/invalid),
    // clear cached engine sessions from transportMeta so the next attempt starts fresh.
    // Also sets a flag so we skip the rate-limit retry loop below (a dead session
    // error can contain text like "429" that would otherwise match RATE_LIMIT_ERROR_RE).
    const isDead = !wasInterrupted && isDeadSessionError(result);
    if (isDead) {
      logger.warn(`Dead session detected for ${session.id} — clearing stale engine IDs`);
      const meta = { ...(session.transportMeta || {}) } as Record<string, unknown>;
      delete meta.engineSessions;
      delete meta.engineOverride;
      repos?.sessions.updateSession(session.id, {
        engineSessionId: null,
        transportMeta: meta as JsonObject,
      });
      // Update local reference so subsequent code doesn't re-read stale IDs
      session = { ...session, engineSessionId: null, transportMeta: meta as JsonObject };
    }

    // Detect rate limit / usage limit errors and auto-retry.
    // Skip entirely for dead sessions — they are not rate limits.
    const rateLimit = !wasInterrupted && !isDead ? detectRateLimit(result) : { limited: false as const };
    if (rateLimit.limited) {
      recordClaudeRateLimit(rateLimit.resetsAt);

      const strategy = config.sessions?.rateLimitStrategy ?? "fallback";

      // Optional fallback: switch to GPT (Codex) while Claude resets
      if (session.engine === "claude" && strategy === "fallback") {
        const fallbackName = config.sessions?.fallbackEngine ?? "codex";
        const fallbackEngine = engines.get(fallbackName);
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

          notifyDiscordChannel(
            `⚠️ Claude usage limit reached. Session ${session.id}${session.employee ? ` (${session.employee})` : ""} switching to GPT.`,
          );

          await connector
            .replyMessage(
              target,
              `⚠️ Claude usage limit reached${resumeText ? `. Resets ${resumeText}` : ""}. Switching to GPT for now.`,
            )
            .catch(() => {});

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

          repos?.sessions.updateSession(session.id, {
            engine: fallbackName,
            // Keep Claude engine_session_id intact for later restore; Codex will return its own thread id.
            transportMeta: nextMeta as JsonObject,
            status: "running",
            lastActivity: new Date().toISOString(),
            lastError: resumeAt
              ? `Claude usage limit — using GPT until ${resumeAt.toISOString()}`
              : "Claude usage limit — using GPT temporarily",
          });

          const fallbackConfig = config.engines.codex;
          const fallbackEffort = resolveEffort(fallbackConfig, session, employee);
          const codexResume = typeof engineSessions.codex === "string" ? (engineSessions.codex as string) : undefined;
          const history = (repos?.messages.getMessages(session.id) ?? [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`);
          const historyText = history.slice(-12).join("\n\n");
          const fallbackPrompt = codexResume
            ? msg.text
            : `Continue this conversation and respond to the last USER message.\n\nConversation so far:\n\n${historyText}`;
          const fallbackResult = await fallbackEngine.run({
            prompt: fallbackPrompt,
            resumeSessionId: codexResume,
            systemPrompt,
            cwd: JINN_HOME,
            bin: fallbackConfig.bin,
            model: session.model ?? fallbackConfig.model,
            effortLevel: fallbackEffort,
            cliFlags: employee?.cliFlags,
            attachments: attachments.length > 0 ? attachments : undefined,
            sessionId: session.id,
          });

          const fallbackText = fallbackResult.result?.trim()
            ? fallbackResult.result
            : fallbackResult.error || "(No response from engine)";

          repos?.messages.insertMessage(session.id, "assistant", fallbackText);
          if (fallbackResult.cost || fallbackResult.numTurns) {
            repos?.sessions.accumulateSessionCost(session.id, fallbackResult.cost ?? 0, fallbackResult.numTurns ?? 1);
          }

          // Persist Codex thread id so future fallbacks can resume it
          const nextEngineSessions = { ...engineSessions };
          if (fallbackResult.sessionId) {
            nextEngineSessions.codex = fallbackResult.sessionId;
          }
          const metaAfter = {
            ...(repos?.sessions.getSessionBySessionKey(msg.sessionKey)?.transportMeta || nextMeta),
          } as Record<string, unknown>;
          metaAfter.engineSessions = nextEngineSessions;
          repos?.sessions.updateSession(session.id, { transportMeta: metaAfter as JsonObject });

          if (decorateMessages && connector.setTypingStatus) {
            await connector.setTypingStatus(target.channel, threadTs, "").catch(() => {});
          }
          await connector.replyMessage(target, fallbackText).catch(() => {});
          if (decorateMessages && capabilities.reactions) {
            await connector.removeReaction(target, "eyes").catch(() => {});
          }

          const updated = repos?.sessions.updateSession(session.id, {
            engineSessionId: fallbackResult.sessionId,
            status: fallbackResult.error ? "error" : "idle",
            replyContext: msg.replyContext,
            messageId: msg.messageId ?? null,
            transportMeta: mergeTransportMeta(
              repos?.sessions.getSessionBySessionKey(msg.sessionKey)?.transportMeta ?? session.transportMeta,
              msg.transportMeta,
            ),
            lastActivity: new Date().toISOString(),
            lastError: fallbackResult.error ?? null,
          });
          if (updated) {
            notifyParentSession(
              updated,
              {
                result: fallbackResult.result,
                error: fallbackResult.error ?? null,
                cost: fallbackResult.cost,
                durationMs: fallbackResult.durationMs,
              },
              { alwaysNotify: employee?.alwaysNotify },
              repos?.sessions,
            );
          }
          return;
        }
      }

      const waitEmoji = "hourglass_flowing_sand";

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
        `Session ${session.id} hit Claude usage limit — will auto-retry ${resumeAt ? `at ${resumeAt.toISOString()}` : `in ${Math.round(delayMs / 1000)}s`}`,
      );

      // Send hardcoded Discord notification — does not depend on LLM
      notifyDiscordChannel(
        `⚠️ Claude usage limit reached. Session ${session.id}${session.employee ? ` (${session.employee})` : ""} paused${resumeText ? ` until ${resumeText}` : ""}.`,
      );

      // Clear "thinking" UI and show waiting state
      if (decorateMessages && connector.setTypingStatus) {
        await connector.setTypingStatus(target.channel, threadTs, "").catch(() => {});
      }
      if (decorateMessages && capabilities.reactions) {
        await connector.removeReaction(target, "eyes").catch(() => {});
        await connector.addReaction(target, waitEmoji).catch(() => {});
      }

      const waitingSession =
        repos?.sessions.updateSession(session.id, {
          ...(result.sessionId?.trim() ? { engineSessionId: result.sessionId } : {}),
          status: "waiting",
          lastActivity: new Date().toISOString(),
          lastError: resumeAt
            ? `Claude usage limit — resumes ${resumeAt.toISOString()}`
            : "Claude usage limit — waiting for reset",
        }) ?? session;

      notifyRateLimited(
        waitingSession,
        resumeAt ? resumeAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : undefined,
      );

      await connector
        .replyMessage(
          target,
          `⏳ Claude usage limit reached${resumeText ? `. Resets ${resumeText}` : ""} — I'll continue automatically.`,
        )
        .catch(() => {});

      // Keep lastActivity fresh while waiting (UI / status endpoints)
      const heartbeat = setInterval(() => {
        repos?.sessions.updateSession(session.id, { status: "waiting", lastActivity: new Date().toISOString() });
      }, 60_000);

      try {
        let attempt = 0;
        let nextDelayMs = delayMs;

        while (Date.now() < deadlineMs) {
          await new Promise((r) => setTimeout(r, nextDelayMs));
          attempt++;

          // Check if session was stopped while waiting
          const currentSession = repos?.sessions.getSessionBySessionKey(msg.sessionKey);
          if (!currentSession || currentSession.status === "error") {
            logger.info(`Session ${session.id} stopped while waiting for usage reset`);
            return;
          }

          // Show active processing again
          if (decorateMessages && connector.setTypingStatus) {
            await connector.setTypingStatus(target.channel, threadTs, "is thinking...").catch(() => {});
          }
          if (decorateMessages && capabilities.reactions) {
            await connector.removeReaction(target, waitEmoji).catch(() => {});
            await connector.addReaction(target, "eyes").catch(() => {});
          }

          logger.info(`Session ${session.id} retrying after usage limit (attempt ${attempt})`);
          const retryResult = await engine.run({
            prompt: msg.text,
            resumeSessionId: currentSession.engineSessionId ?? undefined,
            systemPrompt,
            cwd: JINN_HOME,
            bin: engineConfig.bin,
            model: currentSession.model ?? engineConfig.model,
            effortLevel,
            cliFlags: employee?.cliFlags,
            mcpConfigPath,
            attachments: attachments.length > 0 ? attachments : undefined,
            sessionId: session.id,
          });

          const retryInterrupted = retryResult.error?.startsWith("Interrupted");
          const retryRateLimit = !retryInterrupted ? detectRateLimit(retryResult) : { limited: false as const };
          if (retryRateLimit.limited) {
            recordClaudeRateLimit(retryRateLimit.resetsAt);
            logger.info(`Session ${session.id} still rate limited (attempt ${attempt})`);

            const next = computeNextRetryDelayMs(retryRateLimit.resetsAt);
            nextDelayMs = next.delayMs;

            // Return to waiting UI state
            if (decorateMessages && connector.setTypingStatus) {
              await connector.setTypingStatus(target.channel, threadTs, "").catch(() => {});
            }
            if (decorateMessages && capabilities.reactions) {
              await connector.removeReaction(target, "eyes").catch(() => {});
              await connector.addReaction(target, waitEmoji).catch(() => {});
            }

            repos?.sessions.updateSession(session.id, {
              ...(retryResult.sessionId?.trim() ? { engineSessionId: retryResult.sessionId } : {}),
              status: "waiting",
              lastActivity: new Date().toISOString(),
              lastError: next.resumeAt
                ? `Claude usage limit — resumes ${next.resumeAt.toISOString()}`
                : "Claude usage limit — waiting for reset",
            });

            continue;
          }

          // Success or different error — handle normally
          const retryText = retryResult.result?.trim()
            ? retryResult.result
            : retryResult.error || "(No response from engine)";

          repos?.messages.insertMessage(session.id, "assistant", retryText);
          if (retryResult.cost || retryResult.numTurns) {
            repos?.sessions.accumulateSessionCost(session.id, retryResult.cost ?? 0, retryResult.numTurns ?? 1);
          }

          // Clear typing indicator & reactions
          if (decorateMessages && connector.setTypingStatus) {
            await connector.setTypingStatus(target.channel, threadTs, "").catch(() => {});
          }
          if (decorateMessages && capabilities.reactions) {
            await connector.removeReaction(target, "eyes").catch(() => {});
            await connector.removeReaction(target, waitEmoji).catch(() => {});
          }

          await connector.replyMessage(target, retryText).catch(() => {});
          const retryUpdated = repos?.sessions.updateSession(session.id, {
            ...(retryResult.sessionId?.trim() ? { engineSessionId: retryResult.sessionId } : {}),
            status: retryResult.error ? "error" : "idle",
            replyContext: msg.replyContext,
            messageId: msg.messageId ?? null,
            transportMeta: msg.transportMeta ?? null,
            lastActivity: new Date().toISOString(),
            lastError: retryResult.error ?? null,
          });
          if (retryUpdated) {
            notifyRateLimitResumed(retryUpdated);
            notifyDiscordChannel(
              `✅ Claude usage limit cleared. Session ${session.id}${session.employee ? ` (${session.employee})` : ""} resumed.`,
            );
            notifyParentSession(
              retryUpdated,
              {
                result: retryResult.result,
                error: retryResult.error ?? null,
                cost: retryResult.cost,
                durationMs: retryResult.durationMs,
              },
              { alwaysNotify: employee?.alwaysNotify },
              repos?.sessions,
            );
          }
          logger.info(`Session ${session.id} resumed after usage reset`);
          return;
        }

        // Exhausted waiting window
        notifyDiscordChannel(
          `❌ Claude usage limit did not clear in time. Session ${session.id}${session.employee ? ` (${session.employee})` : ""} has been stopped.`,
        );
        await connector
          .replyMessage(target, "Usage limit didn't reset in time. Please try again later.")
          .catch(() => {});
        repos?.sessions.updateSession(session.id, {
          status: "error",
          lastActivity: new Date().toISOString(),
          lastError: "Claude usage limit did not clear in time",
        });

        // Clear reactions on failure
        if (decorateMessages && capabilities.reactions) {
          await connector.removeReaction(target, "eyes").catch(() => {});
          await connector.removeReaction(target, waitEmoji).catch(() => {});
        }
        return;
      } finally {
        clearInterval(heartbeat);
      }
    }

    const responseText = result.result?.trim() ? result.result : result.error || "(No response from engine)";

    repos?.messages.insertMessage(session.id, "assistant", responseText);
    if (result.cost || result.numTurns) {
      repos?.sessions.accumulateSessionCost(session.id, result.cost ?? 0, result.numTurns ?? 1);
    }
    if (decorateMessages && connector.setTypingStatus) {
      await connector.setTypingStatus(target.channel, threadTs, "").catch(() => {});
    }
    if (!wasInterrupted) {
      await connector.replyMessage(target, responseText);
    }
    if (decorateMessages && capabilities.reactions) {
      await connector.removeReaction(target, "eyes").catch(() => {});
    }
    const updatedSession = repos?.sessions.updateSession(session.id, {
      ...(result.sessionId?.trim() ? { engineSessionId: result.sessionId } : {}),
      status: wasInterrupted ? "idle" : result.error ? "error" : "idle",
      replyContext: msg.replyContext,
      messageId: msg.messageId ?? null,
      transportMeta: (() => {
        const merged = mergeTransportMeta(
          repos?.sessions.getSessionBySessionKey(msg.sessionKey)?.transportMeta ?? session.transportMeta,
          msg.transportMeta,
        ) as Record<string, unknown>;
        if (syncRequested && !rateLimit.limited && !wasInterrupted) {
          delete merged.claudeSyncSince;
        }
        return merged as JsonObject;
      })(),
      lastActivity: new Date().toISOString(),
      lastError: wasInterrupted ? null : (result.error ?? null),
    });
    if (updatedSession) {
      notifyParentSession(
        updatedSession,
        {
          result: result.result,
          error: wasInterrupted ? null : (result.error ?? null),
          cost: result.cost,
          durationMs: result.durationMs,
        },
        { alwaysNotify: employee?.alwaysNotify },
        repos?.sessions,
      );
    }

    logger.info(
      `Session ${session.id} completed in ${result.durationMs ?? 0}ms` +
        (result.cost ? ` ($${result.cost.toFixed(4)})` : ""),
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Session ${session.id} error: ${errMsg}`);

    const erroredSession = repos?.sessions.updateSession(session.id, {
      status: "error",
      lastActivity: new Date().toISOString(),
      lastError: errMsg,
    });
    if (erroredSession) {
      notifyParentSession(erroredSession, { error: errMsg }, { alwaysNotify: employee?.alwaysNotify }, repos?.sessions);
    }

    // Clear typing indicator on error
    if (decorateMessages && connector.setTypingStatus) {
      await connector.setTypingStatus(target.channel, threadTs, "").catch(() => {});
    }

    await connector.replyMessage(target, `Error: ${errMsg}`).catch(() => {});

    if (decorateMessages && capabilities.reactions) {
      await connector.removeReaction(target, "eyes").catch(() => {});
      await connector.removeReaction(target, "hourglass_flowing_sand").catch(() => {});
    }
  } finally {
    // Clean up temp attachment files downloaded from Slack
    for (const filePath of attachments) {
      try {
        fs.rmSync(filePath, { force: true });
      } catch {
        // Ignore cleanup errors — best effort
      }
    }

    if (mcpConfigPath) cleanupMcpConfigFile(session.id);
  }
}
