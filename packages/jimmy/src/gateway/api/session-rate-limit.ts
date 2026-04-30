import {
  notifyDiscordChannel as defaultNotifyDiscordChannel,
  notifyParentSession as defaultNotifyParentSession,
  notifyRateLimited as defaultNotifyRateLimited,
  notifyRateLimitResumed as defaultNotifyRateLimitResumed,
  type notifyDiscordChannel,
  type notifyParentSession,
  type notifyRateLimited,
  type notifyRateLimitResumed,
} from "../../sessions/callbacks.js";
import {
  getSession as defaultGetSession,
  insertMessage as defaultInsertMessage,
  updateSession as defaultUpdateSession,
  type getSession,
  type insertMessage,
  type updateSession,
} from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import { JINN_HOME } from "../../shared/paths.js";
import {
  computeNextRetryDelayMs,
  computeRateLimitDeadlineMs,
  detectRateLimit as defaultDetectRateLimit,
  type detectRateLimit,
} from "../../shared/rateLimit.js";
import type { Employee, Engine, JinnConfig, Session } from "../../shared/types.js";
import { recordClaudeRateLimit } from "../../shared/usageAwareness.js";
import type { ApiContext } from "../types.js";

export interface RateLimitDeps {
  computeNextRetryDelayMs: typeof computeNextRetryDelayMs;
  computeRateLimitDeadlineMs: typeof computeRateLimitDeadlineMs;
  detectRateLimit: typeof detectRateLimit;
  notifyRateLimited: typeof notifyRateLimited;
  notifyRateLimitResumed: typeof notifyRateLimitResumed;
  notifyDiscordChannel: typeof notifyDiscordChannel;
  notifyParentSession: typeof notifyParentSession;
  updateSession: typeof updateSession;
  insertMessage: typeof insertMessage;
  getSession: typeof getSession;
  recordClaudeRateLimit: typeof recordClaudeRateLimit;
}

export interface RetryRunParams {
  prompt: string;
  systemPrompt: string;
  engineConfig: { bin?: string; model?: string };
  effortLevel: string | undefined;
  employee: Pick<Employee, "cliFlags" | "alwaysNotify"> | undefined;
  attachments?: string[];
}

/**
 * レートリミット検出後の waiting 状態移行・通知処理。
 * @returns 初回リトライまでの待機時間とリトライ期限
 */
export async function handleRateLimit(
  deps: RateLimitDeps,
  session: Session,
  rateLimit: { limited: true; resetsAt?: number },
  resultError: string | undefined,
  context: ApiContext,
): Promise<{ delayMs: number; deadlineMs: number }> {
  const { delayMs, resumeAt } = deps.computeNextRetryDelayMs(rateLimit.resetsAt);
  const deadlineMs = deps.computeRateLimitDeadlineMs(
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
    `Web session ${session.id} hit Claude usage limit — will auto-retry ${
      resumeAt ? `at ${resumeAt.toISOString()}` : `in ${Math.round(delayMs / 1000)}s`
    }`,
  );

  deps.notifyDiscordChannel(
    `⚠️ Claude usage limit reached. Session ${session.id}${session.employee ? ` (${session.employee})` : ""} paused${resumeText ? ` until ${resumeText}` : ""}.`,
  );

  const notificationText = `⏳ Claude usage limit reached${resumeText ? `. Resets ${resumeText}` : ""} — I'll continue automatically.`;
  deps.insertMessage(session.id, "notification", notificationText);
  context.emit("session:notification", { sessionId: session.id, message: notificationText });

  const waitingSessionResult = deps.updateSession(session.id, {
    status: "waiting",
    lastActivity: new Date().toISOString(),
    lastError: resumeAt
      ? `Claude usage limit — resumes ${resumeAt.toISOString()}`
      : "Claude usage limit — waiting for reset",
  });
  const waitingSession =
    (waitingSessionResult.ok ? waitingSessionResult.value : null) ?? ({ ...session, status: "waiting" } as Session);

  deps.notifyRateLimited(
    waitingSession,
    resumeAt ? resumeAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : undefined,
  );

  context.emit("session:rate-limited", {
    sessionId: session.id,
    employee: session.employee,
    error: resultError,
    resetsAt: rateLimit.resetsAt ?? null,
  });

  return { delayMs, deadlineMs };
}

/**
 * レートリミット解除まで繰り返しリトライするループ。
 * 成功時: notifyRateLimitResumed を呼び出して終了。
 * タイムアウト: session を error 状態に更新して終了。
 */
export async function retryUntilDeadline(
  deps: RateLimitDeps,
  session: Session,
  deadlineMs: number,
  initialDelayMs: number,
  engine: Engine,
  runParams: RetryRunParams,
  config: JinnConfig,
  context: ApiContext,
): Promise<void> {
  const heartbeat = setInterval(() => {
    deps.updateSession(session.id, { status: "waiting", lastActivity: new Date().toISOString() });
  }, 60_000);

  try {
    let attempt = 0;
    let nextDelayMs = initialDelayMs;

    while (Date.now() < deadlineMs) {
      await new Promise<void>((r) => setTimeout(r, nextDelayMs));
      attempt++;

      const sessionResult = deps.getSession(session.id);
      const current = sessionResult.ok ? sessionResult.value : null;
      if (!current || current.status === "error") {
        logger.info(`Web session ${session.id} stopped while waiting for usage reset`);
        return;
      }

      logger.info(`Web session ${session.id} retrying after usage limit (attempt ${attempt})`);

      const retryResult = await engine.run({
        prompt: runParams.prompt,
        resumeSessionId: current.engineSessionId ?? undefined,
        systemPrompt: runParams.systemPrompt,
        cwd: JINN_HOME,
        bin: runParams.engineConfig.bin,
        model: current.model ?? runParams.engineConfig.model,
        effortLevel: runParams.effortLevel,
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

      const retryInterrupted = retryResult.error?.startsWith("Interrupted");
      const retryRateLimit = !retryInterrupted ? deps.detectRateLimit(retryResult) : { limited: false as const };

      if (retryRateLimit.limited) {
        deps.recordClaudeRateLimit(retryRateLimit.resetsAt);
        logger.info(`Web session ${session.id} still rate limited (attempt ${attempt})`);
        const next = deps.computeNextRetryDelayMs(retryRateLimit.resetsAt);
        nextDelayMs = next.delayMs;
        deps.updateSession(session.id, {
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
        deps.insertMessage(session.id, "assistant", retryResult.result);
      }

      const completedResult = deps.updateSession(session.id, {
        ...(retryResult.sessionId?.trim() ? { engineSessionId: retryResult.sessionId } : {}),
        status: retryResult.error ? "error" : "idle",
        lastActivity: new Date().toISOString(),
        lastError: retryResult.error ?? null,
      });
      const completed = completedResult.ok ? completedResult.value : null;

      if (completed) {
        deps.notifyRateLimitResumed(completed);
        deps.notifyDiscordChannel(
          `✅ Claude usage limit cleared. Session ${session.id}${session.employee ? ` (${session.employee})` : ""} resumed.`,
        );
        deps.notifyParentSession(
          completed,
          {
            result: retryResult.result,
            error: retryResult.error ?? null,
            cost: retryResult.cost,
            durationMs: retryResult.durationMs,
          },
          { alwaysNotify: runParams.employee?.alwaysNotify },
        );
      }

      context.emit("session:completed", {
        sessionId: session.id,
        employee: session.employee || config.portal?.portalName || "Jinn",
        title: session.title,
        result: retryResult.result,
        error: retryResult.error || null,
        cost: retryResult.cost,
        durationMs: retryResult.durationMs,
      });

      logger.info(`Web session ${session.id} resumed after usage reset`);
      return;
    }

    // リトライ期限切れ
    deps.notifyDiscordChannel(
      `❌ Claude usage limit did not clear in time. Session ${session.id}${session.employee ? ` (${session.employee})` : ""} has been stopped.`,
    );
    const erroredResult = deps.updateSession(session.id, {
      status: "error",
      lastActivity: new Date().toISOString(),
      lastError: "Claude usage limit did not clear in time",
    });
    const errored = erroredResult.ok ? erroredResult.value : null;
    if (errored) {
      deps.notifyParentSession(
        errored,
        { error: "Claude usage limit did not clear in time" },
        { alwaysNotify: runParams.employee?.alwaysNotify },
      );
    }
    context.emit("session:completed", {
      sessionId: session.id,
      result: null,
      error: "Claude usage limit did not clear in time",
    });
    logger.warn(`Web session ${session.id} exhausted usage limit retries`);
  } finally {
    clearInterval(heartbeat);
  }
}

export const defaultRateLimitDeps: RateLimitDeps = {
  computeNextRetryDelayMs,
  computeRateLimitDeadlineMs,
  detectRateLimit: defaultDetectRateLimit,
  notifyRateLimited: defaultNotifyRateLimited,
  notifyRateLimitResumed: defaultNotifyRateLimitResumed,
  notifyDiscordChannel: defaultNotifyDiscordChannel,
  notifyParentSession: defaultNotifyParentSession,
  updateSession: defaultUpdateSession,
  insertMessage: defaultInsertMessage,
  getSession: defaultGetSession,
  recordClaudeRateLimit,
};
