import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { IQueueRepository, QueueItem } from "./IQueueRepository.js";

export class SqliteQueueRepository implements IQueueRepository {
  constructor(private readonly db: Database.Database) {}

  enqueueQueueItem(sessionId: string, sessionKey: string, prompt: string): string {
    const id = randomUUID();
    const position = (
      this.db
        .prepare(
          "SELECT COALESCE(MAX(position), 0) + 1 as pos FROM queue_items WHERE session_key = ? AND status = 'pending'",
        )
        .get(sessionKey) as { pos: number }
    ).pos;
    this.db
      .prepare(
        "INSERT INTO queue_items (id, session_id, session_key, prompt, status, position, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
      )
      .run(id, sessionId, sessionKey, prompt, position, new Date().toISOString());
    return id;
  }

  markQueueItemRunning(itemId: string): void {
    this.db
      .prepare("UPDATE queue_items SET status = 'running', started_at = ? WHERE id = ?")
      .run(new Date().toISOString(), itemId);
  }

  markQueueItemCompleted(itemId: string): void {
    this.db
      .prepare("UPDATE queue_items SET status = 'completed', completed_at = ? WHERE id = ?")
      .run(new Date().toISOString(), itemId);
  }

  cancelQueueItem(itemId: string): boolean {
    const result = this.db
      .prepare("UPDATE queue_items SET status = 'cancelled' WHERE id = ? AND status = 'pending'")
      .run(itemId);
    return result.changes > 0;
  }

  getQueueItems(sessionKey: string): QueueItem[] {
    return this.db
      .prepare(
        "SELECT id, session_id as sessionId, session_key as sessionKey, prompt, status, position, created_at as createdAt, started_at as startedAt, completed_at as completedAt FROM queue_items WHERE session_key = ? AND status IN ('pending', 'running') ORDER BY position ASC",
      )
      .all(sessionKey) as QueueItem[];
  }

  cancelAllPendingQueueItems(sessionKey: string): number {
    const result = this.db
      .prepare("UPDATE queue_items SET status = 'cancelled' WHERE session_key = ? AND status = 'pending'")
      .run(sessionKey);
    return result.changes;
  }

  recoverStaleQueueItems(): number {
    const result = this.db
      .prepare("UPDATE queue_items SET status = 'pending', started_at = NULL WHERE status = 'running'")
      .run();
    return result.changes;
  }

  listAllPendingQueueItems(): QueueItem[] {
    return this.db
      .prepare(
        "SELECT id, session_id as sessionId, session_key as sessionKey, prompt, status, position, created_at as createdAt, started_at as startedAt, completed_at as completedAt FROM queue_items WHERE status = 'pending' ORDER BY created_at ASC, position ASC",
      )
      .all() as QueueItem[];
  }
}
