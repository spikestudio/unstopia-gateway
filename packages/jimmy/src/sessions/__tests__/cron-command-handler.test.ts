import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Connector, CronJob, Target } from "../../shared/types.js";

vi.mock("../../cron/jobs.js", () => ({
  loadJobs: vi.fn(),
}));

vi.mock("../../cron/scheduler.js", () => ({
  triggerCronJob: vi.fn(),
  setCronJobEnabled: vi.fn(),
}));

import { loadJobs } from "../../cron/jobs.js";
import { setCronJobEnabled, triggerCronJob } from "../../cron/scheduler.js";
import { handleCronCommand } from "../cron-command-handler.js";

function makeConnector(): { replyMessage: ReturnType<typeof vi.fn>; name: string } & Partial<Connector> {
  return { name: "test", replyMessage: vi.fn().mockResolvedValue(undefined) };
}

const target: Target = { channel: "ch" };

const sampleJob: CronJob = {
  id: "job-1",
  name: "Nightly Report",
  enabled: true,
  schedule: "0 0 * * *",
  prompt: "Generate report",
};

describe("handleCronCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("/cron list（サブコマンドなし / 'list'）", () => {
    it("ジョブがない場合は 'No cron jobs configured.' を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([]);
      const connector = makeConnector();

      const result = await handleCronCommand("/cron", connector as unknown as Connector, target);

      expect(result).toBe(true);
      expect(connector.replyMessage).toHaveBeenCalledWith(target, "No cron jobs configured.");
    });

    it("ジョブがある場合はリスト形式で返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([sampleJob]);
      const connector = makeConnector();

      await handleCronCommand("/cron list", connector as unknown as Connector, target);

      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("Nightly Report");
      expect(message).toContain("job-1");
      expect(message).toContain("enabled");
    });

    it("無効なジョブは 'disabled' と表示する", async () => {
      vi.mocked(loadJobs).mockReturnValue([{ ...sampleJob, enabled: false }]);
      const connector = makeConnector();

      await handleCronCommand("/cron", connector as unknown as Connector, target);

      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("disabled");
    });
  });

  describe("/cron run", () => {
    it("ジョブ名なしでは使用方法を返す", async () => {
      const connector = makeConnector();

      await handleCronCommand("/cron run", connector as unknown as Connector, target);

      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("Usage:");
    });

    it("ジョブが見つかった場合は 'Triggered' を返す", async () => {
      vi.mocked(triggerCronJob).mockResolvedValue(sampleJob);
      const connector = makeConnector();

      await handleCronCommand("/cron run job-1", connector as unknown as Connector, target);

      expect(vi.mocked(triggerCronJob)).toHaveBeenCalledWith("job-1");
      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("Triggered");
      expect(message).toContain("Nightly Report");
    });

    it("ジョブが見つからない場合は 'not found' を返す", async () => {
      vi.mocked(triggerCronJob).mockResolvedValue(undefined);
      const connector = makeConnector();

      await handleCronCommand("/cron run unknown-job", connector as unknown as Connector, target);

      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("not found");
    });
  });

  describe("/cron enable / disable", () => {
    it("ジョブ名なしでは使用方法を返す", async () => {
      const connector = makeConnector();

      await handleCronCommand("/cron enable", connector as unknown as Connector, target);

      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("Usage:");
    });

    it("enable でジョブを有効化する", async () => {
      vi.mocked(setCronJobEnabled).mockReturnValue({ ...sampleJob, enabled: true });
      const connector = makeConnector();

      await handleCronCommand("/cron enable job-1", connector as unknown as Connector, target);

      expect(vi.mocked(setCronJobEnabled)).toHaveBeenCalledWith("job-1", true);
      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("enabled");
    });

    it("disable でジョブを無効化する", async () => {
      vi.mocked(setCronJobEnabled).mockReturnValue({ ...sampleJob, enabled: false });
      const connector = makeConnector();

      await handleCronCommand("/cron disable job-1", connector as unknown as Connector, target);

      expect(vi.mocked(setCronJobEnabled)).toHaveBeenCalledWith("job-1", false);
      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("disabled");
    });

    it("ジョブが見つからない場合は 'not found' を返す", async () => {
      vi.mocked(setCronJobEnabled).mockReturnValue(undefined);
      const connector = makeConnector();

      await handleCronCommand("/cron enable missing", connector as unknown as Connector, target);

      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("not found");
    });
  });

  describe("不明なサブコマンド", () => {
    it("使用方法ガイドを返す", async () => {
      const connector = makeConnector();

      const result = await handleCronCommand("/cron foobar", connector as unknown as Connector, target);

      const [, message] = connector.replyMessage.mock.calls[0];
      expect(message).toContain("Usage:");
      expect(result).toBe(true);
    });
  });
});
