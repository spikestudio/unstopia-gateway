import { logger } from "../../shared/logger.js";
import type {
  Connector,
  ConnectorCapabilities,
  ConnectorHealth,
  CronDelivery,
  IncomingMessage,
  ReplyContext,
  Target,
} from "../../shared/types.js";

const capabilities: ConnectorCapabilities = {
  threading: false,
  messageEdits: false,
  reactions: false,
  attachments: false,
};

export class CronConnector implements Connector {
  name = "cron";
  constructor(
    private readonly connectors: Map<string, Connector>,
    private readonly delivery?: CronDelivery,
  ) {}

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  getCapabilities(): ConnectorCapabilities {
    return capabilities;
  }

  getHealth(): ConnectorHealth {
    return {
      status: "running",
      capabilities,
    };
  }

  reconstructTarget(replyContext: ReplyContext): Target {
    return {
      channel: typeof replyContext.channel === "string" ? replyContext.channel : "",
      thread: typeof replyContext.thread === "string" ? replyContext.thread : undefined,
      messageTs: typeof replyContext.messageTs === "string" ? replyContext.messageTs : undefined,
      replyContext,
    };
  }

  async sendMessage(target: Target, text: string): Promise<string | undefined> {
    return this.forward(target, text, false);
  }

  async replyMessage(target: Target, text: string): Promise<string | undefined> {
    return this.forward(target, text, true);
  }

  async addReaction(): Promise<void> {}

  async removeReaction(): Promise<void> {}

  async editMessage(target: Target, text: string): Promise<void> {
    if (!this.delivery) return;
    const connector = this.connectors.get(this.delivery.connector);
    if (!connector?.getCapabilities().messageEdits) return;
    await connector.editMessage(target, text);
  }

  // CronConnector is send-only; message reception is not applicable
  onMessage(_handler: (msg: IncomingMessage) => void): void {}

  private async forward(target: Target, text: string, asReply: boolean): Promise<string | undefined> {
    if (!this.delivery) return undefined;

    const connector = this.connectors.get(this.delivery.connector);
    if (!connector) {
      logger.warn(`Cron delivery connector "${this.delivery.connector}" not found`);
      return undefined;
    }

    const resolvedTarget: Target = {
      channel: target.channel || this.delivery.channel,
      thread: target.thread,
      messageTs: target.messageTs,
      replyContext: target.replyContext,
    };

    if (asReply) {
      return connector.replyMessage(resolvedTarget, text);
    }
    return connector.sendMessage(resolvedTarget, text);
  }
}
