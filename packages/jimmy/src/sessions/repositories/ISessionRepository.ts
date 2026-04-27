import type { RepositoryError } from "../../shared/errors.js";
import type { Result } from "../../shared/result.js";
import type { JsonObject, ReplyContext, Session } from "../../shared/types.js";

export type { RepositoryError };

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
  /** セッションを ID で検索する。存在しない場合は Ok<null> を返す */
  getSession(id: string): Result<Session | null, RepositoryError>;
  /** セッションキーでセッションを検索する。存在しない場合は Ok<null> を返す */
  getSessionBySessionKey(sessionKey: string): Result<Session | null, RepositoryError>;
  /** セッションを更新する。成功時 Ok<Session>、対象不在時 Ok<null>、DB エラー時 Err<RepositoryError> を返す */
  updateSession(id: string, updates: UpdateSessionFields): Result<Session | null, RepositoryError>;
  listSessions(filter?: ListSessionsFilter): Session[];
  deleteSession(id: string): boolean;
  deleteSessions(ids: string[]): number;
  recoverStaleSessions(): number;
  getInterruptedSessions(): Session[];
  accumulateSessionCost(id: string, cost: number, turns: number): void;
  duplicateSession(sourceId: string, newTitle?: string): { session: Session; messageCount: number };
  /** AC-E021-05: セッションを ID で検索し Result で返す */
  findById(id: string): Result<Session | null, RepositoryError>;
  /** AC-E021-05: セッションキーで検索し Result で返す */
  findByKey(sessionKey: string): Result<Session | null, RepositoryError>;
  /** AC-E021-06: セッションを保存し Result で返す */
  save(session: Omit<Session, "id" | "createdAt" | "lastActivity">): Result<Session, RepositoryError>;
  /** AC-E021-06: セッションを更新し Result で返す */
  update(id: string, fields: Partial<Session>): Result<Session | null, RepositoryError>;
}
