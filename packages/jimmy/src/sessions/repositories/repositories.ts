import type { IFileRepository } from "./IFileRepository.js";
import type { IMessageRepository } from "./IMessageRepository.js";
import type { IQueueRepository } from "./IQueueRepository.js";
import type { ISessionRepository } from "./ISessionRepository.js";

export interface Repositories {
  sessions: ISessionRepository;
  messages: IMessageRepository;
  queue: IQueueRepository;
  files: IFileRepository;
}
