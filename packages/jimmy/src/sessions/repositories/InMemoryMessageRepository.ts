import { randomUUID } from "node:crypto";
import type { IMessageRepository, SessionMessage } from "./IMessageRepository.js";

export class InMemoryMessageRepository implements IMessageRepository {
  private readonly store = new Map<string, SessionMessage[]>();

  insertMessage(sessionId: string, role: string, content: string): void {
    const message: SessionMessage = {
      id: randomUUID(),
      role,
      content,
      timestamp: Date.now(),
    };
    const existing = this.store.get(sessionId) ?? [];
    this.store.set(sessionId, [...existing, message]);
  }

  getMessages(sessionId: string): SessionMessage[] {
    return [...(this.store.get(sessionId) ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  }
}
