import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SESSIONS_DB } from "../shared/paths.js";
import type { Session } from "../shared/types.js";
import type {
  CreateSessionOpts,
  FileMeta,
  ListSessionsFilter,
  QueueItem,
  SessionMessage,
  UpdateSessionFields,
} from "./repositories/index.js";
import { SqliteFileRepository } from "./repositories/SqliteFileRepository.js";
import { SqliteMessageRepository } from "./repositories/SqliteMessageRepository.js";
import { SqliteQueueRepository } from "./repositories/SqliteQueueRepository.js";
import { SqliteSessionRepository } from "./repositories/SqliteSessionRepository.js";

// Re-export types for backward compatibility
export type { CreateSessionOpts, UpdateSessionFields, ListSessionsFilter, SessionMessage, QueueItem, FileMeta };

// ── DB infrastructure ────────────────────────────────────────────────

let _db: Database.Database;

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  engine TEXT NOT NULL,
  engine_session_id TEXT,
  source TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  connector TEXT,
  session_key TEXT,
  reply_context TEXT,
  message_id TEXT,
  transport_meta TEXT,
  employee TEXT,
  model TEXT,
  title TEXT,
  parent_session_id TEXT,
  status TEXT DEFAULT 'idle',
  created_at TEXT NOT NULL,
  last_activity TEXT NOT NULL,
  last_error TEXT
)`;

const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL
)`;

const CREATE_MESSAGES_INDEX = `
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id, timestamp)
`;

const CREATE_SESSION_KEY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_sessions_session_key ON sessions (session_key, last_activity)
`;

const CREATE_FILES_TABLE = `
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  mimetype TEXT,
  path TEXT,
  created_at TEXT NOT NULL
)
`;

export function initDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(path.dirname(SESSIONS_DB), { recursive: true });
  _db = new Database(SESSIONS_DB);
  _db.pragma("journal_mode = WAL");
  _db.exec(CREATE_TABLE);
  _db.exec(CREATE_MESSAGES_TABLE);
  _db.exec(CREATE_MESSAGES_INDEX);
  migrateSessionsSchema(_db);
  _db.exec(CREATE_SESSION_KEY_INDEX);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS queue_items (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      session_key TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_queue_session
      ON queue_items (session_key, status, position);
  `);
  _db.exec(CREATE_FILES_TABLE);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      level TEXT NOT NULL DEFAULT 'company',
      parent_id TEXT,
      department TEXT,
      owner TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES goals(id)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS budget_events (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      event_type TEXT NOT NULL,
      amount REAL NOT NULL,
      limit_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return _db;
}

export function migrateSessionsSchema(database: Database.Database): void {
  const cols = database.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  const missingColumns: Array<[string, string, string?]> = [
    ["title", "TEXT"],
    ["parent_session_id", "TEXT"],
    ["connector", "TEXT"],
    ["session_key", "TEXT"],
    ["reply_context", "TEXT"],
    ["message_id", "TEXT"],
    ["transport_meta", "TEXT"],
    ["total_cost", "REAL", "0"],
    ["total_turns", "INTEGER", "0"],
    ["effort_level", "TEXT"],
  ];

  for (const [name, type, defaultVal] of missingColumns) {
    if (!colNames.has(name)) {
      const defaultClause = defaultVal !== undefined ? ` DEFAULT ${defaultVal}` : "";
      database.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}${defaultClause}`);
    }
  }

  const refreshedCols = database.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const refreshedNames = new Set(refreshedCols.map((c) => c.name));
  if (refreshedNames.has("session_key")) {
    database.exec(
      `UPDATE sessions SET session_key = COALESCE(session_key, source_ref) WHERE session_key IS NULL OR session_key = ''`,
    );
  }
  if (refreshedNames.has("connector")) {
    database.exec(
      `UPDATE sessions SET connector = COALESCE(connector, source) WHERE connector IS NULL OR connector = ''`,
    );
  }
}

// ── Lazy singleton repository instances ──────────────────────────────

let _sessionRepo: SqliteSessionRepository | undefined;
let _messageRepo: SqliteMessageRepository | undefined;
let _queueRepo: SqliteQueueRepository | undefined;
let _fileRepo: SqliteFileRepository | undefined;

function getSessionRepo(): SqliteSessionRepository {
  return (_sessionRepo ??= new SqliteSessionRepository(initDb()));
}

function getMessageRepo(): SqliteMessageRepository {
  return (_messageRepo ??= new SqliteMessageRepository(initDb()));
}

function getQueueRepo(): SqliteQueueRepository {
  return (_queueRepo ??= new SqliteQueueRepository(initDb()));
}

function getFileRepo(): SqliteFileRepository {
  return (_fileRepo ??= new SqliteFileRepository(initDb()));
}

// ── Session façade ────────────────────────────────────────────────────

export function createSession(opts: CreateSessionOpts & { prompt?: string; portalName?: string }): Session {
  return getSessionRepo().createSession(opts);
}

export function getSession(id: string): Session | undefined {
  return getSessionRepo().getSession(id);
}

export function getSessionBySourceRef(sourceRef: string): Session | undefined {
  return getSessionRepo().getSessionBySessionKey(sourceRef);
}

export function getSessionBySessionKey(sessionKey: string): Session | undefined {
  return getSessionRepo().getSessionBySessionKey(sessionKey);
}

export function updateSession(id: string, updates: UpdateSessionFields): Session | undefined {
  return getSessionRepo().updateSession(id, updates);
}

export function listSessions(filter?: ListSessionsFilter): Session[] {
  return getSessionRepo().listSessions(filter);
}

export function recoverStaleSessions(): number {
  return getSessionRepo().recoverStaleSessions();
}

export function getInterruptedSessions(): Session[] {
  return getSessionRepo().getInterruptedSessions();
}

export function accumulateSessionCost(id: string, cost: number, turns: number): void {
  return getSessionRepo().accumulateSessionCost(id, cost, turns);
}

export function duplicateSession(sourceId: string, newTitle?: string): { session: Session; messageCount: number } {
  return getSessionRepo().duplicateSession(sourceId, newTitle);
}

export function deleteSession(id: string): boolean {
  return getSessionRepo().deleteSession(id);
}

export function deleteSessions(ids: string[]): number {
  return getSessionRepo().deleteSessions(ids);
}

// ── Message façade ────────────────────────────────────────────────────

export function insertMessage(sessionId: string, role: string, content: string): void {
  return getMessageRepo().insertMessage(sessionId, role, content);
}

export function getMessages(sessionId: string): SessionMessage[] {
  return getMessageRepo().getMessages(sessionId);
}

// ── Queue façade ──────────────────────────────────────────────────────

export function enqueueQueueItem(sessionId: string, sessionKey: string, prompt: string): string {
  return getQueueRepo().enqueueQueueItem(sessionId, sessionKey, prompt);
}

export function markQueueItemRunning(itemId: string): void {
  return getQueueRepo().markQueueItemRunning(itemId);
}

export function markQueueItemCompleted(itemId: string): void {
  return getQueueRepo().markQueueItemCompleted(itemId);
}

export function cancelQueueItem(itemId: string): boolean {
  return getQueueRepo().cancelQueueItem(itemId);
}

export function getQueueItems(sessionKey: string): QueueItem[] {
  return getQueueRepo().getQueueItems(sessionKey);
}

export function cancelAllPendingQueueItems(sessionKey: string): number {
  return getQueueRepo().cancelAllPendingQueueItems(sessionKey);
}

export function recoverStaleQueueItems(): number {
  return getQueueRepo().recoverStaleQueueItems();
}

export function listAllPendingQueueItems(): QueueItem[] {
  return getQueueRepo().listAllPendingQueueItems();
}

// ── File façade ───────────────────────────────────────────────────────

export function insertFile(meta: {
  id: string;
  filename: string;
  size: number;
  mimetype: string | null;
  path: string | null;
}): FileMeta {
  return getFileRepo().insertFile(meta);
}

export function getFile(id: string): FileMeta | undefined {
  return getFileRepo().getFile(id);
}

export function listFiles(): FileMeta[] {
  return getFileRepo().listFiles();
}

export function deleteFile(id: string): boolean {
  return getFileRepo().deleteFile(id);
}
