import { EventEmitter } from "node:events";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../types.js";

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue("[]"),
    readdirSync: vi.fn().mockReturnValue([]),
    writeFileSync: vi.fn(),
  },
}));

vi.mock("../../sessions/registry.js", () => ({
  createSession: vi.fn(),
  insertMessage: vi.fn(),
}));

vi.mock("../services.js", () => ({
  buildServiceRegistry: vi.fn().mockReturnValue(new Map()),
  routeServiceRequest: vi.fn(),
  buildRoutePath: vi.fn().mockReturnValue([]),
  resolveManagerChain: vi.fn().mockReturnValue([]),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  ORG_DIR: "/tmp/org-test",
  DOCS_DIR: "/tmp/docs-test",
}));

import fs from "node:fs";
import { handleOrgRequest } from "../api/org.js";

function makeReq(body = ""): HttpRequest {
  const emitter = new EventEmitter() as HttpRequest;
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
  return { res, written: () => ({ status, body: JSON.parse(rawBody || "null") }) };
}

function makeContext(): ApiContext {
  return {
    config: {} as never,
    sessionManager: {
      route: vi.fn(),
      getQueue: vi.fn().mockReturnValue({ enqueue: vi.fn() }),
    } as never,
    startTime: Date.now(),
    getConfig: vi.fn().mockReturnValue({ engines: { default: "claude" } }),
    emit: vi.fn(),
    connectors: new Map(),
  };
}

describe("handleOrgRequest", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("GET /api/org", () => {
    it("ORG_DIR がない場合は空の org 構造を返す", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { res, written } = makeRes();

      const handled = await handleOrgRequest(makeReq(), res, makeContext(), "GET", "/api/org");

      expect(handled).toBe(true);
      const body = written().body as { departments: unknown[]; employees: unknown[] };
      expect(body.departments).toEqual([]);
      expect(body.employees).toEqual([]);
    });
  });

  describe("GET /api/org/employees/:name", () => {
    it("従業員が見つからない場合は 404 を返す", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { res, written } = makeRes();

      const handled = await handleOrgRequest(makeReq(), res, makeContext(), "GET", "/api/org/employees/alice");

      expect(handled).toBe(true);
      expect(written().status).toBe(404);
    });
  });

  describe("マッチしないルート", () => {
    it("関係ないパスは false を返す", async () => {
      const handled = await handleOrgRequest(makeReq(), makeRes().res, makeContext(), "GET", "/api/other");
      expect(handled).toBe(false);
    });
  });
});
