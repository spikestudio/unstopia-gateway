import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { IMessageRepository, SessionMessage } from "./IMessageRepository.js";

export class SqliteMessageRepository implements IMessageRepository {
  constructor(private readonly db: Database.Database) {}

  insertMessage(sessionId: string, role: string, content: string): void {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)")
      .run(id, sessionId, role, content, Date.now());
  }

  getMessages(sessionId: string): SessionMessage[] {
    return this.db
      .prepare(
        "SELECT id, role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC",
      )
      .all(sessionId) as SessionMessage[];
  }
}
