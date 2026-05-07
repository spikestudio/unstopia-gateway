import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../cron/jobs.js", () => ({
  loadJobs: vi.fn(),
  saveJobs: vi.fn(),
}));

vi.mock("../../cron/runner.js", () => ({
  runCronJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../cron/scheduler.js", () => ({
  reloadScheduler: vi.fn(),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  CRON_RUNS: "/tmp/cron-runs-test",
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(""),
    unlinkSync: vi.fn(),
  },
}));

import fs from "node:fs";
import { loadJobs, saveJobs } from "../../cron/jobs.js";
import { runCronJob } from "../../cron/runner.js";
import { reloadScheduler } from "../../cron/scheduler.js";
import { handleCronRequest } from "../api/cron.js";
import { makeContext, makeReq, makeRes } from "./http-test-helpers.js";

const sampleJob = {
  id: "job-1",
  name: "Test Job",
  enabled: true,
  schedule: "0 * * * *",
  prompt: "Do work",
};

describe("handleCronRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/cron", () => {
    it("ジョブ一覧を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([sampleJob] as never);
      const req = makeReq();
      const { res, written } = makeRes();

      const handled = await handleCronRequest(req, res, makeContext(), "GET", "/api/cron");

      expect(handled).toBe(true);
      expect(written().body).toBeInstanceOf(Array);
      expect((written().body as { id: string }[])[0].id).toBe("job-1");
    });

    it("CRON_RUNS ファイルがない場合は lastRun: null を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([sampleJob] as never);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { res, written } = makeRes();

      await handleCronRequest(makeReq(), res, makeContext(), "GET", "/api/cron");

      expect((written().body as { lastRun: null }[])[0].lastRun).toBeNull();
    });
  });

  describe("GET /api/cron/:id/runs", () => {
    it("run ファイルがない場合は空配列を返す", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { res, written } = makeRes();

      const handled = await handleCronRequest(makeReq(), res, makeContext(), "GET", "/api/cron/job-1/runs");

      expect(handled).toBe(true);
      expect(written().body).toEqual([]);
    });

    it("run ファイルがある場合はパースして返す", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"status":"success"}\n' as never);
      const { res, written } = makeRes();

      await handleCronRequest(makeReq(), res, makeContext(), "GET", "/api/cron/job-1/runs");

      expect((written().body as { status: string }[])[0].status).toBe("success");
    });
  });

  describe("POST /api/cron", () => {
    it("新しいジョブを作成して 201 を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([]);
      const req = makeReq(JSON.stringify({ name: "New Job", schedule: "0 0 * * *", prompt: "hi" }));
      const { res, written } = makeRes();

      const handled = await handleCronRequest(req, res, makeContext(), "POST", "/api/cron");

      expect(handled).toBe(true);
      expect(written().status).toBe(201);
      const created = written().body as { name: string; schedule: string; enabled: boolean };
      expect(created.name).toBe("New Job");
      expect(created.schedule).toBe("0 0 * * *");
      expect(created.enabled).toBe(true);
      expect(vi.mocked(saveJobs)).toHaveBeenCalledOnce();
      expect(vi.mocked(reloadScheduler)).toHaveBeenCalledOnce();
    });

    it("name 省略時は 'untitled' がデフォルト値になる", async () => {
      vi.mocked(loadJobs).mockReturnValue([]);
      const req = makeReq(JSON.stringify({ prompt: "hi" }));
      const { res, written } = makeRes();

      await handleCronRequest(req, res, makeContext(), "POST", "/api/cron");

      const created = written().body as { name: string; id: string };
      expect(created.name).toBe("untitled");
      expect(created.id).toBeTruthy();
    });
  });

  describe("PUT /api/cron/:id", () => {
    it("ジョブが存在する場合は更新して返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([{ ...sampleJob }] as never);
      const req = makeReq(JSON.stringify({ name: "Updated" }));
      const { res, written } = makeRes();

      const handled = await handleCronRequest(req, res, makeContext(), "PUT", "/api/cron/job-1");

      expect(handled).toBe(true);
      expect((written().body as { name: string }).name).toBe("Updated");
      expect(vi.mocked(saveJobs)).toHaveBeenCalledOnce();
      expect(vi.mocked(reloadScheduler)).toHaveBeenCalledOnce();
    });

    it("ジョブが存在しない場合は 404 を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([]);
      const { res, written } = makeRes();

      await handleCronRequest(makeReq("{}"), res, makeContext(), "PUT", "/api/cron/missing");

      expect(written().status).toBe(404);
    });
  });

  describe("DELETE /api/cron/:id", () => {
    it("ジョブを削除して deleted を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([{ ...sampleJob }] as never);
      const { res, written } = makeRes();

      const handled = await handleCronRequest(makeReq(), res, makeContext(), "DELETE", "/api/cron/job-1");

      expect(handled).toBe(true);
      expect((written().body as { deleted: string }).deleted).toBe("job-1");
      expect(vi.mocked(saveJobs)).toHaveBeenCalledOnce();
    });

    it("ジョブが存在しない場合は 404 を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([]);
      const { res, written } = makeRes();

      await handleCronRequest(makeReq(), res, makeContext(), "DELETE", "/api/cron/missing");

      expect(written().status).toBe(404);
    });
  });

  describe("POST /api/cron/:id/trigger", () => {
    it("ジョブをトリガーして triggered: true を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([{ ...sampleJob }] as never);
      const { res, written } = makeRes();

      const handled = await handleCronRequest(makeReq(), res, makeContext(), "POST", "/api/cron/job-1/trigger");

      expect(handled).toBe(true);
      expect((written().body as { triggered: boolean }).triggered).toBe(true);
      expect(vi.mocked(runCronJob)).toHaveBeenCalledOnce();
    });

    it("ジョブが存在しない場合は 404 を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([]);
      const { res, written } = makeRes();

      await handleCronRequest(makeReq(), res, makeContext(), "POST", "/api/cron/missing/trigger");

      expect(written().status).toBe(404);
    });
  });

  describe("マッチしないルート", () => {
    it("関係ないパスは false を返す", async () => {
      const handled = await handleCronRequest(makeReq(), makeRes().res, makeContext(), "GET", "/api/other");
      expect(handled).toBe(false);
    });
  });

  describe("GET /api/cron — lastRun あり", () => {
    it("CRON_RUNS ファイルがある場合は lastRun を返す", async () => {
      const lastRunEntry = { status: "success", ts: Date.now() };
      vi.mocked(loadJobs).mockReturnValue([sampleJob] as never);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`${JSON.stringify(lastRunEntry)}\n` as never);
      const { res, written } = makeRes();

      await handleCronRequest(makeReq(), res, makeContext(), "GET", "/api/cron");

      const body = written().body as Array<{ lastRun: Record<string, unknown> | null }>;
      expect(body[0].lastRun).not.toBeNull();
      expect(body[0].lastRun?.status).toBe("success");
    });

    it("run ファイルがあるが空の場合は lastRun: null を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([sampleJob] as never);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("" as never);
      const { res, written } = makeRes();

      await handleCronRequest(makeReq(), res, makeContext(), "GET", "/api/cron");

      const body = written().body as Array<{ lastRun: null }>;
      expect(body[0].lastRun).toBeNull();
    });

    it("run ファイルの最終行が不正 JSON の場合は lastRun: null を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([sampleJob] as never);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("not-json\n" as never);
      const { res, written } = makeRes();

      await handleCronRequest(makeReq(), res, makeContext(), "GET", "/api/cron");

      const body = written().body as Array<{ lastRun: null }>;
      expect(body[0].lastRun).toBeNull();
    });
  });

  describe("POST /api/cron/:id/trigger — runCronJob エラー時", () => {
    it("runCronJob が reject してもレスポンスは triggered: true を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([{ ...sampleJob }] as never);
      vi.mocked(runCronJob).mockRejectedValue(new Error("trigger error"));
      const { res, written } = makeRes();

      const handled = await handleCronRequest(makeReq(), res, makeContext(), "POST", "/api/cron/job-1/trigger");

      expect(handled).toBe(true);
      expect((written().body as { triggered: boolean }).triggered).toBe(true);
    });
  });

  describe("POST /api/cron — branch coverage", () => {
    it("readJsonBody が失敗した場合は 400 を返す (line 64 branch)", async () => {
      // Send invalid JSON to trigger readJsonBody failure
      const badReq = {
        headers: { "content-type": "application/json" },
        on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
          if (event === "data") cb(Buffer.from("not-valid-json"));
          if (event === "end") cb();
        }),
      } as never;
      const { res, written } = makeRes();

      const handled = await handleCronRequest(badReq, res, makeContext(), "POST", "/api/cron");

      expect(handled).toBe(true);
      expect(written().status).toBe(400);
    });

    it("enabled が boolean でない場合は true をデフォルト値にする (line 70 right branch)", async () => {
      vi.mocked(loadJobs).mockReturnValue([]);
      // enabled: "yes" → typeof "yes" !== "boolean" → true
      const req = makeReq(JSON.stringify({ name: "test", enabled: "yes", prompt: "hello" }));
      const { res, written } = makeRes();

      await handleCronRequest(req, res, makeContext(), "POST", "/api/cron");

      const created = written().body as { enabled: boolean };
      expect(created.enabled).toBe(true);
    });

    it("prompt が省略された場合は空文字をデフォルト値にする (line 76 right branch)", async () => {
      vi.mocked(loadJobs).mockReturnValue([]);
      // prompt not provided → "" as fallback
      const req = makeReq(JSON.stringify({ name: "no-prompt-job" }));
      const { res, written } = makeRes();

      await handleCronRequest(req, res, makeContext(), "POST", "/api/cron");

      const created = written().body as { prompt: string };
      expect(created.prompt).toBe("");
    });
  });

  describe("PUT /api/cron/:id — readJsonBody 失敗時 (line 96 branch)", () => {
    it("readJsonBody が失敗した場合は 400 を返す", async () => {
      vi.mocked(loadJobs).mockReturnValue([{ ...sampleJob }] as never);
      const badReq = {
        headers: { "content-type": "application/json" },
        on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
          if (event === "data") cb(Buffer.from("not-valid-json"));
          if (event === "end") cb();
        }),
      } as never;
      const { res, written } = makeRes();

      const handled = await handleCronRequest(badReq, res, makeContext(), "PUT", "/api/cron/job-1");

      expect(handled).toBe(true);
      expect(written().status).toBe(400);
    });
  });
});
