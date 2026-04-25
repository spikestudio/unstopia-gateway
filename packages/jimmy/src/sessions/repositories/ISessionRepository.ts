import type { JsonObject, ReplyContext, Session } from "../../shared/types.js";

export interface CreateSessionOpts {
  engine: string;
  source: string;
  sourceRef: string;
  connector?: string | null;
  sessionKey?: string;
  replyContext?: ReplyContext | null;
  messageId?: string;
  transportMeta?: JsonObject | null;
  employee?: string;
  model?: string;
  title?: string;
  parentSessionId?: string;
  effortLevel?: string;
}

export interface UpdateSessionFields {
  engine?: string;
  engineSessionId?: string | null;
  status?: Session["status"];
  model?: string | null;
  replyContext?: ReplyContext | null;
  messageId?: string | null;
  transportMeta?: JsonObject | null;
  lastActivity?: string;
  lastError?: string | null;
  title?: string;
}

export interface ListSessionsFilter {
  status?: Session["status"];
  source?: string;
  engine?: string;
}

export interface ISessionRepository {
  createSession(opts: CreateSessionOpts & { prompt?: string; portalName?: string }): Session;
  getSession(id: string): Session | undefined;
  getSessionBySessionKey(sessionKey: string): Session | undefined;
  updateSession(id: string, updates: UpdateSessionFields): Session | undefined;
  listSessions(filter?: ListSessionsFilter): Session[];
  deleteSession(id: string): boolean;
  deleteSessions(ids: string[]): number;
  recoverStaleSessions(): number;
  getInterruptedSessions(): Session[];
  accumulateSessionCost(id: string, cost: number, turns: number): void;
  duplicateSession(sourceId: string, newTitle?: string): { session: Session; messageCount: number };
}
