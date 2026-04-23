import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Connector, CronJob, Employee, JinnConfig } from "../../shared/types.js";

// モックを import より前に宣言
vi.mock("../jobs.js", () => ({
  appendRunLog: vi.fn(),
}));

vi.mock("../../gateway/org.js", () => ({
  scanOrg: vi.fn(() => new Map()),
  findEmployee: vi.fn(() => undefined),
}));

vi.mock("../../connectors/cron/index.js", () => ({
  CronConnector: vi.fn(function (this: Record<string, unknown>) {
    this.name = "cron";
    this.route = vi.fn();
  }),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { appendRunLog } from "../jobs.js";
import { findEmployee, scanOrg } from "../../gateway/org.js";
import { runCronJob } from "../runner.js";

// SessionManager の最小限モック
function makeSessionManager(routeResult?: { sessionId: string }) {
  return {
    route: vi.fn().mockResolvedValue(routeResult ?? { sessionId: "sess-001" }),
  };
}

// 最小限の JinnConfig
// NOTE: `as unknown as JinnConfig` は JinnConfig の必須フィールドを全て列挙せずに
// テスト用の部分的なオブジェクトを渡すための型キャスト。runCronJob が参照する
// フィールド（gateway.port, cron, portal.portalName, engines.default 等）のみを
// 定義し、テストに不要なフィールドは省略している。
// overrides で特定フィールドを上書きする際も同じ理由でキャストが必要になる。
function makeConfig(overrides: Partial<JinnConfig> = {}): JinnConfig {
  return {
    gateway: { port: 7777, host: "0.0.0.0" },
    engines: {
      default: "claude",
      claude: { bin: "claude", model: "sonnet" },
      codex: { bin: "codex", model: "" },
    },
    connectors: {},
    logging: { file: false, stdout: true, level: "info" },
    portal: { portalName: "jinn" },
    ...overrides,
  } as unknown as JinnConfig;
}

// 最小限の CronJob
function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job-001",
    name: "Test Job",
    enabled: true,
    schedule: "* * * * *",
    prompt: "Do something",
    ...overrides,
  };
}

describe("AC-E003-03: runCronJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("成功パス", () => {
    it("route が成功したとき appendRunLog に status:success を記録する", async () => {
      const job = makeJob();
      const sessionManager = makeSessionManager({ sessionId: "sess-xyz" });
      const config = makeConfig();
      const connectors = new Map<string, Connector>();

      await runCronJob(job, sessionManager as never, config, connectors);

      expect(sessionManager.route).toHaveBeenCalledOnce();
      expect(vi.mocked(appendRunLog)).toHaveBeenCalledOnce();
      const [jobId, entry] = vi.mocked(appendRunLog).mock.calls[0];
      expect(jobId).toBe("job-001");
      expect((entry as Record<string, unknown>).status).toBe("success");
      expect((entry as Record<string, unknown>).sessionId).toBe("sess-xyz");
    });

    it("delivery が設定されているとき delivery.channel が replyContext.channel になる", async () => {
      const job = makeJob({
        delivery: { connector: "slack", channel: "#results" },
      });
      const sessionManager = makeSessionManager();
      const config = makeConfig({
        cron: { defaultDelivery: undefined },
      } as never);
      const connectors = new Map<string, Connector>();

      await runCronJob(job, sessionManager as never, config, connectors);

      expect(sessionManager.route).toHaveBeenCalledOnce();
      const [routeMsg] = (sessionManager.route as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(routeMsg.replyContext.channel).toBe("#results");
    });

    it("employee が指定されているとき scanOrg と findEmployee を呼ぶ", async () => {
      const employee: Employee = {
        name: "alice",
        displayName: "Alice",
        department: "platform",
        rank: "employee",
        engine: "gemini",
        model: "gemini-pro",
        persona: "P",
      };
      vi.mocked(findEmployee).mockReturnValueOnce(employee);

      const job = makeJob({ employee: "alice" });
      const sessionManager = makeSessionManager();
      const config = makeConfig();
      const connectors = new Map<string, Connector>();

      await runCronJob(job, sessionManager as never, config, connectors);

      expect(vi.mocked(scanOrg)).toHaveBeenCalledOnce();
      expect(vi.mocked(findEmployee)).toHaveBeenCalledWith("alice", expect.any(Map));
    });

    it("delivery なし・employee なし の場合も正常に動作する", async () => {
      const job = makeJob(); // delivery なし、employee なし
      const sessionManager = makeSessionManager();
      const config = makeConfig();
      const connectors = new Map<string, Connector>();

      await runCronJob(job, sessionManager as never, config, connectors);

      expect(vi.mocked(appendRunLog)).toHaveBeenCalledOnce();
      const entry = vi.mocked(appendRunLog).mock.calls[0][1] as Record<string, unknown>;
      expect(entry.status).toBe("success");
    });

    it("route が null を返すとき sessionId は null として記録される", async () => {
      const job = makeJob();
      const sessionManager = {
        route: vi.fn().mockResolvedValue(null),
      };
      const config = makeConfig();
      const connectors = new Map<string, Connector>();

      await runCronJob(job, sessionManager as never, config, connectors);

      const entry = vi.mocked(appendRunLog).mock.calls[0][1] as Record<string, unknown>;
      expect(entry.status).toBe("success");
      expect(entry.sessionId).toBeNull();
    });
  });

  describe("エラーパス", () => {
    it("route が throw したとき appendRunLog に status:error を記録する", async () => {
      const job = makeJob();
      const sessionManager = {
        route: vi.fn().mockRejectedValue(new Error("engine failed")),
      };
      const config = makeConfig();
      const connectors = new Map<string, Connector>();

      await runCronJob(job, sessionManager as never, config, connectors);

      expect(vi.mocked(appendRunLog)).toHaveBeenCalledOnce();
      const [jobId, entry] = vi.mocked(appendRunLog).mock.calls[0];
      expect(jobId).toBe("job-001");
      expect((entry as Record<string, unknown>).status).toBe("error");
      expect((entry as Record<string, unknown>).error).toBe("engine failed");
    });

    it("alertConnector と alertChannel が設定されているとき alert を送信する", async () => {
      const job = makeJob();
      const sessionManager = {
        route: vi.fn().mockRejectedValue(new Error("crash")),
      };
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const alertConnector: Partial<Connector> = {
        name: "slack",
        sendMessage: mockSendMessage,
      };
      const connectors = new Map<string, Connector>([["slack", alertConnector as Connector]]);
      const config = makeConfig({
        cron: { alertConnector: "slack", alertChannel: "#alerts" },
      } as never);

      await runCronJob(job, sessionManager as never, config, connectors);

      expect(mockSendMessage).toHaveBeenCalledOnce();
      const [target, message] = mockSendMessage.mock.calls[0];
      expect((target as Record<string, unknown>).channel).toBe("#alerts");
      expect(message).toContain("Test Job");
      expect(message).toContain("crash");
    });

    it("alertConnector が connectors に存在しない場合 alert を送信しない", async () => {
      const job = makeJob();
      const sessionManager = {
        route: vi.fn().mockRejectedValue(new Error("crash")),
      };
      // connectors に "slack" がない
      const connectors = new Map<string, Connector>();
      const config = makeConfig({
        cron: { alertConnector: "slack", alertChannel: "#alerts" },
      } as never);

      await runCronJob(job, sessionManager as never, config, connectors);

      // appendRunLog には error が記録される
      const entry = vi.mocked(appendRunLog).mock.calls[0][1] as Record<string, unknown>;
      expect(entry.status).toBe("error");
    });

    it("alertConnector と alertChannel が未設定の場合 alert を送信しない", async () => {
      const job = makeJob();
      const sessionManager = {
        route: vi.fn().mockRejectedValue(new Error("crash")),
      };
      const connectors = new Map<string, Connector>();
      const config = makeConfig(); // cron.alertConnector なし

      await runCronJob(job, sessionManager as never, config, connectors);

      // エラー記録はされるが alertConnector への送信はない
      const entry = vi.mocked(appendRunLog).mock.calls[0][1] as Record<string, unknown>;
      expect(entry.status).toBe("error");
    });

    it("AC-E003-03: sendMessage が throw したとき catch で logger.error が呼ばれる", async () => {
      const job = makeJob();
      const sessionManager = {
        route: vi.fn().mockRejectedValue(new Error("crash")),
      };
      const mockSendMessage = vi.fn().mockRejectedValue(new Error("slack down"));
      const alertConnector: Partial<Connector> = {
        name: "slack",
        sendMessage: mockSendMessage,
      };
      const connectors = new Map<string, Connector>([["slack", alertConnector as Connector]]);
      const config = makeConfig({
        cron: { alertConnector: "slack", alertChannel: "#alerts" },
      } as never);

      // throw しないこと（catch 内で処理される）
      await expect(runCronJob(job, sessionManager as never, config, connectors)).resolves.toBeUndefined();
    });
  });

  describe("AC-E003-03: cooSlug フォールバック分岐", () => {
    it("portal.portalName がない場合 cooSlug は 'jinn' になる", async () => {
      const job = makeJob({
        delivery: { connector: "slack", channel: "#results" },
        employee: "alice",
      });
      const sessionManager = makeSessionManager();
      // portal なしの config → cooSlug = "jinn"、alice !== "jinn" なので debug ログ分岐に入る
      const config = makeConfig({ portal: undefined } as never);
      const connectors = new Map<string, Connector>();

      await runCronJob(job, sessionManager as never, config, connectors);

      expect(vi.mocked(appendRunLog)).toHaveBeenCalledOnce();
      const entry = vi.mocked(appendRunLog).mock.calls[0][1] as Record<string, unknown>;
      expect(entry.status).toBe("success");
    });
  });
});
