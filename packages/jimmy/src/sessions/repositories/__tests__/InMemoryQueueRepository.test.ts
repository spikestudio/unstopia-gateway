import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryQueueRepository } from "../InMemoryQueueRepository.js";

describe("AC-6 InMemoryQueueRepository", () => {
  let repo: InMemoryQueueRepository;

  beforeEach(() => {
    repo = new InMemoryQueueRepository();
  });

  it("AC-6: enqueueQueueItem でアイテムを追加できる", () => {
    const id = repo.enqueueQueueItem("session-1", "key-1", "prompt text");
    expect(id).toBeDefined();

    const items = repo.getQueueItems("key-1");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(id);
    expect(items[0].status).toBe("pending");
    expect(items[0].prompt).toBe("prompt text");
  });

  it("AC-6: markQueueItemRunning でステータスを running に変更できる", () => {
    const id = repo.enqueueQueueItem("session-1", "key-2", "prompt");
    repo.markQueueItemRunning(id);

    const items = repo.getQueueItems("key-2");
    expect(items[0].status).toBe("running");
    expect(items[0].startedAt).not.toBeNull();
  });

  it("AC-6: markQueueItemCompleted でアイテムが getQueueItems から除外される", () => {
    const id = repo.enqueueQueueItem("session-1", "key-3", "prompt");
    repo.markQueueItemRunning(id);
    repo.markQueueItemCompleted(id);

    const items = repo.getQueueItems("key-3");
    expect(items).toHaveLength(0);
  });

  it("AC-6: cancelQueueItem で pending アイテムをキャンセルできる", () => {
    const id = repo.enqueueQueueItem("session-1", "key-4", "prompt");
    const result = repo.cancelQueueItem(id);
    expect(result).toBe(true);

    const items = repo.getQueueItems("key-4");
    expect(items).toHaveLength(0);
  });

  it("AC-6: cancelAllPendingQueueItems でセッションキーの全 pending をキャンセルできる", () => {
    repo.enqueueQueueItem("session-1", "key-5", "p1");
    repo.enqueueQueueItem("session-1", "key-5", "p2");
    repo.enqueueQueueItem("session-2", "key-6", "p3");

    const count = repo.cancelAllPendingQueueItems("key-5");
    expect(count).toBe(2);
    expect(repo.getQueueItems("key-5")).toHaveLength(0);
    expect(repo.getQueueItems("key-6")).toHaveLength(1);
  });

  it("AC-6: recoverStaleQueueItems で running を pending に戻せる", () => {
    const id = repo.enqueueQueueItem("session-1", "key-7", "prompt");
    repo.markQueueItemRunning(id);

    const count = repo.recoverStaleQueueItems();
    expect(count).toBe(1);

    const items = repo.getQueueItems("key-7");
    expect(items[0].status).toBe("pending");
    expect(items[0].startedAt).toBeNull();
  });

  it("AC-6: listAllPendingQueueItems で全セッションキーの pending アイテムを返す", () => {
    repo.enqueueQueueItem("session-1", "key-8", "p1");
    repo.enqueueQueueItem("session-2", "key-9", "p2");
    const id3 = repo.enqueueQueueItem("session-3", "key-10", "p3");
    repo.markQueueItemRunning(id3);

    const pending = repo.listAllPendingQueueItems();
    expect(pending).toHaveLength(2);
    expect(pending.every((i) => i.status === "pending")).toBe(true);
  });
});
