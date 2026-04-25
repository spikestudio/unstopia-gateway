export interface QueueItem {
  id: string;
  sessionId: string;
  sessionKey: string;
  prompt: string;
  status: "pending" | "running" | "cancelled" | "completed";
  position: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface IQueueRepository {
  enqueueQueueItem(sessionId: string, sessionKey: string, prompt: string): string;
  markQueueItemRunning(itemId: string): void;
  markQueueItemCompleted(itemId: string): void;
  cancelQueueItem(itemId: string): boolean;
  getQueueItems(sessionKey: string): QueueItem[];
  cancelAllPendingQueueItems(sessionKey: string): number;
  recoverStaleQueueItems(): number;
  listAllPendingQueueItems(): QueueItem[];
}
