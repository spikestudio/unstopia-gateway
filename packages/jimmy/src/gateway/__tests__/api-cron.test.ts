import { EventEmitter } from "node:events";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../types.js";

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

function makeReq(body = ""): HttpRequest {
  const emitter = new EventEmitter() as HttpRequest;
  emitter.method = "GET";
  // Emit body asynchronously so readBody can collect chunks
  setImmediate(() => {
    emitter.emit("data", Buffer.from(body));
    emitter.emit("end");
  });
  return emitter;
}

function makeRes(): { res: ServerResponse; written: () => { status: number; body: unknown } } {
  let status = 200;
  let rawBody = "";
  const res = {
    writeHead: vi.fn((s: number) => { status = s; }),
    end: vi.fn((b: string) => { rawBody = b; }),
  } as unknown as ServerResponse;
  return {
    res,
    written: () => ({ status, body: JSON.parse(rawBody || "null") }),
  };
}

const sampleJob = {
  id: "job-1", name: "Test Job", enabled: true,
  schedule: "0 * * * *", prompt: "Do work",
};

function makeContext(): ApiContext {
  return {
    config: {} as never,
    sessionManager: {} as never,
    startTime: Date.now(),
    getConfig: vi.fn().mockReturnValue({}),
    emit: vi.fn(),
    connectors: new Map(),
  };
}

describe("handleCronRequest", () => {
  beforeEach(() => { vi.clearAllMocks(); });

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
      expect(vi.mocked(saveJobs)).toHaveBeenCalledOnce();
      expect(vi.mocked(reloadScheduler)).toHaveBeenCalledOnce();
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
});
