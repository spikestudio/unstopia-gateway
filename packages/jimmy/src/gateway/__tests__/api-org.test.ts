import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { makeContext, makeReq, makeRes } from "./http-test-helpers.js";

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
