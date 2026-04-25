import { randomUUID } from "node:crypto";
import type { IQueueRepository, QueueItem } from "./IQueueRepository.js";

export class InMemoryQueueRepository implements IQueueRepository {
  private readonly store = new Map<string, QueueItem>();

  enqueueQueueItem(sessionId: string, sessionKey: string, prompt: string): string {
    const id = randomUUID();
    const pendingForKey = Array.from(this.store.values()).filter(
      (item) => item.sessionKey === sessionKey && item.status === "pending",
    );
    const maxPosition = pendingForKey.reduce((max, item) => Math.max(max, item.position), 0);
    const position = maxPosition + 1;

    const item: QueueItem = {
      id,
      sessionId,
      sessionKey,
      prompt,
      status: "pending",
      position,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };
    this.store.set(id, item);
    return id;
  }

  markQueueItemRunning(itemId: string): void {
    const item = this.store.get(itemId);
    if (!item) return;
    this.store.set(itemId, { ...item, status: "running", startedAt: new Date().toISOString() });
  }

  markQueueItemCompleted(itemId: string): void {
    const item = this.store.get(itemId);
    if (!item) return;
    this.store.set(itemId, { ...item, status: "completed", completedAt: new Date().toISOString() });
  }

  cancelQueueItem(itemId: string): boolean {
    const item = this.store.get(itemId);
    if (!item || item.status !== "pending") return false;
    this.store.set(itemId, { ...item, status: "cancelled" });
    return true;
  }

  getQueueItems(sessionKey: string): QueueItem[] {
    return Array.from(this.store.values())
      .filter((item) => item.sessionKey === sessionKey && (item.status === "pending" || item.status === "running"))
      .sort((a, b) => a.position - b.position);
  }

  cancelAllPendingQueueItems(sessionKey: string): number {
    let count = 0;
    for (const [id, item] of this.store.entries()) {
      if (item.sessionKey === sessionKey && item.status === "pending") {
        this.store.set(id, { ...item, status: "cancelled" });
        count++;
      }
    }
    return count;
  }

  recoverStaleQueueItems(): number {
    let count = 0;
    for (const [id, item] of this.store.entries()) {
      if (item.status === "running") {
        this.store.set(id, { ...item, status: "pending", startedAt: null });
        count++;
      }
    }
    return count;
  }

  listAllPendingQueueItems(): QueueItem[] {
    return Array.from(this.store.values())
      .filter((item) => item.status === "pending")
      .sort((a, b) => {
        const cmp = a.createdAt.localeCompare(b.createdAt);
        return cmp !== 0 ? cmp : a.position - b.position;
      });
  }
}
