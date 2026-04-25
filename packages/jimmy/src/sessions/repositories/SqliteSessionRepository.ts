import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { JsonObject, ReplyContext, Session } from "../../shared/types.js";
import type {
  CreateSessionOpts,
  ISessionRepository,
  ListSessionsFilter,
  UpdateSessionFields,
} from "./ISessionRepository.js";

function parseJsonObject(value: unknown): JsonObject | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as JsonObject;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function rowToSession(row: Record<string, unknown>): Session {
  const replyContext = parseJsonObject(row.reply_context);
  const transportMeta = parseJsonObject(row.transport_meta);
  const sessionKey = (row.session_key as string) || (row.source_ref as string);
  const connector = (row.connector as string) ?? (row.source as string) ?? null;
  return {
    id: row.id as string,
    engine: row.engine as string,
    engineSessionId: (row.engine_session_id as string) ?? null,
    source: row.source as string,
    sourceRef: row.source_ref as string,
    connector,
    sessionKey,
    replyContext: replyContext as ReplyContext | null,
    messageId: (row.message_id as string) ?? null,
    transportMeta,
    employee: (row.employee as string) ?? null,
    model: (row.model as string) ?? null,
    title: (row.title as string) ?? null,
    parentSessionId: (row.parent_session_id as string) ?? null,
    effortLevel: (row.effort_level as string) ?? null,
    status: row.status as Session["status"],
    totalCost: (row.total_cost as number) ?? 0,
    totalTurns: (row.total_turns as number) ?? 0,
    createdAt: row.created_at as string,
    lastActivity: row.last_activity as string,
    lastError: (row.last_error as string) ?? null,
  };
}

function getNextSessionNumber(db: Database.Database): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
  return row.count + 1;
}

function generateTitle(db: Database.Database, prompt?: string): string {
  const num = getNextSessionNumber(db);
  if (!prompt) return `#${num}`;
  const cleaned = prompt.replace(/\n/g, " ").replace(/@\w+/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return `#${num}`;
  const summary = cleaned.slice(0, 30).trim();
  return `#${num} - ${summary}${cleaned.length > 30 ? "..." : ""}`;
}

export class SqliteSessionRepository implements ISessionRepository {
  constructor(private readonly db: Database.Database) {}

  createSession(opts: CreateSessionOpts & { prompt?: string; portalName?: string }): Session {
    const now = new Date().toISOString();
    const id = randomUUID();
    const title = opts.title ?? generateTitle(this.db, opts.prompt);
    const sessionKey = opts.sessionKey ?? opts.sourceRef;
    const connector = opts.connector ?? opts.source;
    const replyContext = opts.replyContext ? JSON.stringify(opts.replyContext) : null;
    const transportMeta = opts.transportMeta ? JSON.stringify(opts.transportMeta) : null;

    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, engine, source, source_ref, connector, session_key, reply_context, message_id, transport_meta,
        employee, model, title, parent_session_id, effort_level, status, created_at, last_activity
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
    `);
    stmt.run(
      id,
      opts.engine,
      opts.source,
      opts.sourceRef,
      connector,
      sessionKey,
      replyContext,
      opts.messageId ?? null,
      transportMeta,
      opts.employee ?? null,
      opts.model ?? null,
      title,
      opts.parentSessionId ?? null,
      opts.effortLevel ?? null,
      now,
      now,
    );

    return {
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
  }

  getSession(id: string): Session | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToSession(row) : undefined;
  }

  getSessionBySessionKey(sessionKey: string): Session | undefined {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE session_key = ? ORDER BY last_activity DESC LIMIT 1")
      .get(sessionKey) as Record<string, unknown> | undefined;
    return row ? rowToSession(row) : undefined;
  }

  updateSession(id: string, updates: UpdateSessionFields): Session | undefined {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.engine !== undefined) {
      sets.push("engine = ?");
      values.push(updates.engine);
    }
    if (updates.engineSessionId !== undefined) {
      sets.push("engine_session_id = ?");
      values.push(updates.engineSessionId);
    }
    if (updates.status !== undefined) {
      sets.push("status = ?");
      values.push(updates.status);
    }
    if (updates.model !== undefined) {
      sets.push("model = ?");
      values.push(updates.model);
    }
    if (updates.replyContext !== undefined) {
      sets.push("reply_context = ?");
      values.push(updates.replyContext ? JSON.stringify(updates.replyContext) : null);
    }
    if (updates.messageId !== undefined) {
      sets.push("message_id = ?");
      values.push(updates.messageId);
    }
    if (updates.transportMeta !== undefined) {
      sets.push("transport_meta = ?");
      values.push(updates.transportMeta ? JSON.stringify(updates.transportMeta) : null);
    }
    if (updates.lastActivity !== undefined) {
      sets.push("last_activity = ?");
      values.push(updates.lastActivity);
    }
    if (updates.lastError !== undefined) {
      sets.push("last_error = ?");
      values.push(updates.lastError);
    }
    if (updates.title !== undefined) {
      sets.push("title = ?");
      values.push(updates.title);
    }

    if (sets.length === 0) return this.getSession(id);

    values.push(id);
    this.db.prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return this.getSession(id);
  }

  listSessions(filter?: ListSessionsFilter): Session[] {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter?.status) {
      conditions.push("status = ?");
      values.push(filter.status);
    }
    if (filter?.source) {
      conditions.push("source = ?");
      values.push(filter.source);
    }
    if (filter?.engine) {
      conditions.push("engine = ?");
      values.push(filter.engine);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM sessions ${where} ORDER BY last_activity DESC`)
      .all(...values) as Record<string, unknown>[];
    return rows.map(rowToSession);
  }

  deleteSession(id: string): boolean {
    this.db.prepare("DELETE FROM messages WHERE session_id = ?").run(id);
    const result = this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return result.changes > 0;
  }

  deleteSessions(ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(",");
    const txn = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM messages WHERE session_id IN (${placeholders})`).run(...ids);
      const result = this.db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`).run(...ids);
      return result.changes;
    });
    return txn();
  }

  recoverStaleSessions(): number {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        "UPDATE sessions SET status = 'interrupted', last_activity = ?, last_error = 'Interrupted: gateway restarted while session was running' WHERE status = 'running'",
      )
      .run(now);
    return result.changes;
  }

  getInterruptedSessions(): Session[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM sessions WHERE status = 'interrupted' AND engine_session_id IS NOT NULL ORDER BY last_activity DESC",
      )
      .all() as Record<string, unknown>[];
    return rows.map(rowToSession);
  }

  accumulateSessionCost(id: string, cost: number, turns: number): void {
    this.db
      .prepare("UPDATE sessions SET total_cost = total_cost + ?, total_turns = total_turns + ? WHERE id = ?")
      .run(cost, turns, id);
  }

  duplicateSession(sourceId: string, newTitle?: string): { session: Session; messageCount: number } {
    const source = this.getSession(sourceId);
    if (!source) throw new Error(`Session ${sourceId} not found`);
    if (!source.engineSessionId)
      throw new Error(`Session ${sourceId} has no engine session ID — cannot duplicate`);

    const now = new Date().toISOString();
    const newId = randomUUID();
    const title = newTitle ?? `Copy of ${source.title || sourceId.slice(0, 8)}`;
    const newSessionKey = `web:${Date.now()}`;

    const messages = this.db
      .prepare("SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC")
      .all(sourceId) as Array<{ role: string; content: string; timestamp: number }>;

    const txn = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO sessions (
            id, engine, engine_session_id, source, source_ref, connector, session_key,
            reply_context, message_id, transport_meta,
            employee, model, title, parent_session_id, effort_level, status,
            total_cost, total_turns, created_at, last_activity
          )
          VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'idle', 0, 0, ?, ?)
        `)
        .run(
          newId,
          source.engine,
          source.source,
          source.sourceRef,
          source.connector,
          newSessionKey,
          source.replyContext ? JSON.stringify(source.replyContext) : null,
          source.messageId,
          source.transportMeta ? JSON.stringify(source.transportMeta) : null,
          source.employee,
          source.model,
          title,
          source.effortLevel,
          now,
          now,
        );

      const insertMsg = this.db.prepare(
        "INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
      );
      for (const msg of messages) {
        insertMsg.run(randomUUID(), newId, msg.role, msg.content, msg.timestamp);
      }
    });
    txn();

    const newSession = this.getSession(newId);
    if (!newSession) throw new Error(`Failed to retrieve newly duplicated session: ${newId}`);
    return { session: newSession, messageCount: messages.length };
  }
}
