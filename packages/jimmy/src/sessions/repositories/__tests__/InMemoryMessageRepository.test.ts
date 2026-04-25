import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryMessageRepository } from "../InMemoryMessageRepository.js";

describe("AC-6 InMemoryMessageRepository", () => {
  let repo: InMemoryMessageRepository;

  beforeEach(() => {
    repo = new InMemoryMessageRepository();
  });

  it("AC-6: insertMessage でメッセージを追加できる", () => {
    repo.insertMessage("session-1", "user", "hello");
    const messages = repo.getMessages("session-1");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("hello");
  });

  it("AC-6: getMessages で複数メッセージをタイムスタンプ順に返す", () => {
    repo.insertMessage("session-2", "user", "first");
    repo.insertMessage("session-2", "assistant", "second");
    repo.insertMessage("session-2", "user", "third");

    const messages = repo.getMessages("session-2");
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe("first");
    expect(messages[1].content).toBe("second");
    expect(messages[2].content).toBe("third");
  });

  it("AC-6: 存在しないセッションは空配列を返す", () => {
    const messages = repo.getMessages("nonexistent");
    expect(messages).toEqual([]);
  });
});
