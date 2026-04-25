export interface SessionMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}

export interface IMessageRepository {
  insertMessage(sessionId: string, role: string, content: string): void;
  getMessages(sessionId: string): SessionMessage[];
}
