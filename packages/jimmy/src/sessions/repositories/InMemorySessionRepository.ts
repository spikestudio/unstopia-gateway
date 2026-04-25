import { randomUUID } from "node:crypto";
import type { Session } from "../../shared/types.js";
import type {
  CreateSessionOpts,
  ISessionRepository,
  ListSessionsFilter,
  UpdateSessionFields,
} from "./ISessionRepository.js";

function getNextSessionNumber(store: Map<string, Session>): number {
  return store.size + 1;
}

function generateTitle(store: Map<string, Session>, prompt?: string): string {
  const num = getNextSessionNumber(store);
  if (!prompt) return `#${num}`;
  const cleaned = prompt.replace(/\n/g, " ").replace(/@\w+/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return `#${num}`;
  const summary = cleaned.slice(0, 30).trim();
  return `#${num} - ${summary}${cleaned.length > 30 ? "..." : ""}`;
}

export class InMemorySessionRepository implements ISessionRepository {
  private readonly store = new Map<string, Session>();

  createSession(opts: CreateSessionOpts & { prompt?: string; portalName?: string }): Session {
    const now = new Date().toISOString();
    const id = randomUUID();
    const title = opts.title ?? generateTitle(this.store, opts.prompt);
    const sessionKey = opts.sessionKey ?? opts.sourceRef;
    const connector = opts.connector ?? opts.source;

    const session: Session = {
      id,
      engine: opts.engine,
      engineSessionId: null,
      source: opts.source,
      sourceRef: opts.sourceRef,
      connector,
      sessionKey,
      replyContext: opts.replyContext ?? null,
      messageId: opts.messageId ?? null,
      transportMeta: opts.transportMeta ?? null,
      employee: opts.employee ?? null,
      model: opts.model ?? null,
      title,
      parentSessionId: opts.parentSessionId ?? null,
      effortLevel: opts.effortLevel ?? null,
      status: "idle",
      totalCost: 0,
      totalTurns: 0,
      createdAt: now,
      lastActivity: now,
      lastError: null,
    };

    this.store.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.store.get(id);
  }

  getSessionBySessionKey(sessionKey: string): Session | undefined {
    let found: Session | undefined;
    for (const session of this.store.values()) {
      if (session.sessionKey === sessionKey) {
        if (!found || session.lastActivity > found.lastActivity) {
          found = session;
        }
      }
    }
    return found;
  }

  updateSession(id: string, updates: UpdateSessionFields): Session | undefined {
    const existing = this.store.get(id);
    if (!existing) return undefined;

    const updated: Session = { ...existing };
    if (updates.engine !== undefined) updated.engine = updates.engine;
    if (updates.engineSessionId !== undefined) updated.engineSessionId = updates.engineSessionId;
    if (updates.status !== undefined) updated.status = updates.status;
    if (updates.model !== undefined) updated.model = updates.model;
    if (updates.replyContext !== undefined) updated.replyContext = updates.replyContext;
    if (updates.messageId !== undefined) updated.messageId = updates.messageId;
    if (updates.transportMeta !== undefined) updated.transportMeta = updates.transportMeta;
    if (updates.lastActivity !== undefined) updated.lastActivity = updates.lastActivity;
    if (updates.lastError !== undefined) updated.lastError = updates.lastError;
    if (updates.title !== undefined) updated.title = updates.title;

    this.store.set(id, updated);
    return updated;
  }

  listSessions(filter?: ListSessionsFilter): Session[] {
    const sessions = Array.from(this.store.values());
    const filtered = sessions.filter((s) => {
      if (filter?.status && s.status !== filter.status) return false;
      if (filter?.source && s.source !== filter.source) return false;
      if (filter?.engine && s.engine !== filter.engine) return false;
      return true;
    });
    return filtered.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  }

  deleteSession(id: string): boolean {
    return this.store.delete(id);
  }

  deleteSessions(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.store.delete(id)) count++;
    }
    return count;
  }

  recoverStaleSessions(): number {
    let count = 0;
    const now = new Date().toISOString();
    for (const [id, session] of this.store.entries()) {
      if (session.status === "running") {
        this.store.set(id, {
          ...session,
          status: "interrupted",
          lastActivity: now,
          lastError: "Interrupted: gateway restarted while session was running",
        });
        count++;
      }
    }
    return count;
  }

  getInterruptedSessions(): Session[] {
    const sessions = Array.from(this.store.values());
    return sessions
      .filter((s) => s.status === "interrupted" && s.engineSessionId !== null)
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  }

  accumulateSessionCost(id: string, cost: number, turns: number): void {
    const existing = this.store.get(id);
    if (!existing) return;
    this.store.set(id, {
      ...existing,
      totalCost: existing.totalCost + cost,
      totalTurns: existing.totalTurns + turns,
    });
  }

  duplicateSession(sourceId: string, newTitle?: string): { session: Session; messageCount: number } {
    const source = this.store.get(sourceId);
    if (!source) throw new Error(`Session ${sourceId} not found`);
    if (!source.engineSessionId)
      throw new Error(`Session ${sourceId} has no engine session ID — cannot duplicate`);

    const now = new Date().toISOString();
    const newId = randomUUID();
    const title = newTitle ?? `Copy of ${source.title || sourceId.slice(0, 8)}`;
    const newSessionKey = `web:${Date.now()}`;

    const session: Session = {
      ...source,
      id: newId,
      engineSessionId: null,
      sessionKey: newSessionKey,
      title,
      parentSessionId: null,
      status: "idle",
      totalCost: 0,
      totalTurns: 0,
      createdAt: now,
      lastActivity: now,
      lastError: null,
    };

    this.store.set(newId, session);
    return { session, messageCount: 0 };
  }
}
