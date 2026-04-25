import type { Repositories } from "./repositories/index.js";
import { logger } from "../shared/logger.js";
import type { Connector, Engine, IncomingMessage, JinnConfig, RouteOptions, Session } from "../shared/types.js";
import { getClaudeExpectedResetAt } from "../shared/usageAwareness.js";
import { handleCronCommand } from "./cron-command-handler.js";
import { mergeTransportMeta, runSession } from "./engine-runner.js";
import { SessionQueue } from "./queue.js";
import type { ISessionRepository } from "./repositories/index.js";

export type { RouteOptions } from "../shared/types.js";

function maybeRevertEngineOverride(session: Session, sessionRepo: ISessionRepository): Session {
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

  // Preserve the current engine session ID under its engine key
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
    sessionRepo.updateSession(session.id, {
      engine: originalEngine,
      engineSessionId: restoredSessionId,
      transportMeta: nextMeta as import("../shared/types.js").JsonObject,
      lastError: null,
    }) ?? session
  );
}

export class SessionManager {
  private config: JinnConfig;
  private engines: Map<string, Engine>;
  private queue = new SessionQueue();
  private connectorProvider: () => Map<string, Connector> = () => new Map();
  private repos: Repositories;

  constructor(
    config: JinnConfig,
    engines: Map<string, Engine>,
    _connectorNames: string[] = [],
    repos: Repositories,
  ) {
    this.config = config;
    this.engines = engines;
    this.repos = repos;
  }

  setConnectorProvider(provider: () => Map<string, Connector>): void {
    this.connectorProvider = provider;
  }

  getEngine(name: string): Engine | undefined {
    return this.engines.get(name);
  }

  getQueue(): SessionQueue {
    return this.queue;
  }

  async route(
    msg: IncomingMessage,
    connector: Connector,
    opts: RouteOptions = {},
  ): Promise<{ sessionId: string } | undefined> {
    if (await this.handleCommand(msg, connector)) return;

    let session = this.repos.sessions.getSessionBySessionKey(msg.sessionKey);
    if (!session) {
      session = this.repos.sessions.createSession({
        engine: opts.engine ?? opts.employee?.engine ?? this.config.engines.default,
        source: msg.source,
        sourceRef: msg.sessionKey,
        connector: msg.connector,
        sessionKey: msg.sessionKey,
        replyContext: msg.replyContext,
        messageId: msg.messageId,
        transportMeta: msg.transportMeta,
        employee: opts.employee?.name ?? undefined,
        model: opts.model ?? opts.employee?.model ?? undefined,
        title: opts.title,
        prompt: msg.text,
        portalName: this.config.portal?.portalName,
      });
      logger.info(
        `Created new session ${session.id} for ${msg.sessionKey}` +
          (opts.employee ? ` (employee: ${opts.employee.name})` : ""),
      );
    } else {
      const mergedMeta = mergeTransportMeta(session.transportMeta, msg.transportMeta);
      session =
        this.repos.sessions.updateSession(session.id, {
          replyContext: msg.replyContext,
          messageId: msg.messageId ?? null,
          transportMeta: mergedMeta,
          ...(opts.model ? { model: opts.model } : {}),
        }) ?? session;
    }

    session = maybeRevertEngineOverride(session, this.repos.sessions);

    const target = connector.reconstructTarget(msg.replyContext);
    target.messageTs ??= msg.messageId;

    const attachmentPaths = msg.attachments
      .map((attachment) => attachment.localPath)
      .filter((filePath): filePath is string => !!filePath);

    if (session.status === "waiting") {
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
          `⏳ Still paused due to Claude usage limit${resumeText ? ` (resets ${resumeText})` : ""}. I queued this message and will respond automatically.`,
        )
        .catch(() => {});
    }

    if (session.status === "running" && this.queue.isRunning(msg.sessionKey) && connector.getCapabilities().reactions) {
      await connector.addReaction(target, "clock1").catch(() => {});
    }

    const sessionId = session.id;

    await this.queue.enqueue(msg.sessionKey, () =>
      runSession(
        session as Session,
        msg,
        attachmentPaths,
        connector,
        target,
        this.engines,
        this.config,
        this.connectorProvider,
        opts.employee,
        this.repos,
      ),
    );

    return { sessionId };
  }

  async handleCommand(msg: IncomingMessage, connector: Connector): Promise<boolean> {
    const text = msg.text.trim();
    const target = connector.reconstructTarget(msg.replyContext);
    target.messageTs ??= msg.messageId;

    if (text === "/new" || text.startsWith("/new ")) {
      this.resetSession(msg.sessionKey);
      await connector.replyMessage(target, "Session reset. Starting fresh.");
      logger.info(`Session reset for ${msg.sessionKey}`);
      return true;
    }

    if (text === "/status" || text.startsWith("/status ")) {
      const session = this.repos.sessions.getSessionBySessionKey(msg.sessionKey);
      if (!session) {
        await connector.replyMessage(target, "No active session for this conversation.");
        return true;
      }

      const queueDepth = this.queue.getPendingCount(session.sessionKey);
      const transportState = this.queue.getTransportState(session.sessionKey, session.status);
      const info = [
        `Session: ${session.id}`,
        `Engine: ${session.engine}`,
        `Connector: ${session.connector || session.source}`,
        `Model: ${session.model || this.config.engines[session.engine as "claude" | "codex" | "gemini"]?.model || "default"}`,
        `State: ${transportState}`,
        `Queue depth: ${queueDepth}`,
        `Created: ${session.createdAt}`,
        `Last activity: ${session.lastActivity}`,
        session.lastError ? `Last error: ${session.lastError}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await connector.replyMessage(target, info);
      return true;
    }

    if (text.startsWith("/model")) {
      const nextModel = text.slice("/model".length).trim();
      if (!nextModel) {
        await connector.replyMessage(target, "Usage: /model <model-name>");
        return true;
      }

      const session = this.repos.sessions.getSessionBySessionKey(msg.sessionKey);
      if (!session) {
        await connector.replyMessage(target, "No active session for this conversation.");
        return true;
      }

      this.repos.sessions.updateSession(session.id, {
        model: nextModel,
        lastActivity: new Date().toISOString(),
      });
      await connector.replyMessage(target, `Model updated to \`${nextModel}\` for this session.`);
      return true;
    }

    if (text === "/doctor" || text.startsWith("/doctor ")) {
      const connectors = Array.from(this.connectorProvider().values());
      const connectorLines =
        connectors.length > 0
          ? connectors.map((candidate) => {
              const health = candidate.getHealth();
              return `- ${candidate.name}: ${health.status}${health.detail ? ` (${health.detail})` : ""}`;
            })
          : ["- none"];
      const info = [
        `Default engine: ${this.config.engines.default}`,
        `Claude: ${this.config.engines.claude.model}`,
        `Codex: ${this.config.engines.codex.model}`,
        ...(this.config.engines.gemini ? [`Gemini: ${this.config.engines.gemini.model}`] : []),
        "Connectors:",
        ...connectorLines,
      ].join("\n");
      await connector.replyMessage(target, info);
      return true;
    }

    if (text.startsWith("/cron")) {
      return handleCronCommand(text, connector, target);
    }

    return false;
  }

  resetSession(sessionKey: string): void {
    const session = this.repos.sessions.getSessionBySessionKey(sessionKey);
    if (session) {
      this.repos.sessions.deleteSession(session.id);
      logger.info(`Deleted session ${session.id}`);
    }
  }
}
