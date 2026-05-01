import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../../types.js";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("node:fs");
vi.mock("../../../sessions/registry.js", () => ({
  createSession: vi.fn().mockReturnValue({
    id: "sess-1",
    engine: "claude",
    source: "cross-request",
    sourceRef: "cross:alice:svc1",
    connector: "web",
    status: "idle",
    sessionKey: "sk1",
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  }),
  insertMessage: vi.fn(),
}));
vi.mock("../../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../shared/paths.js", () => ({
  ORG_DIR: "/fake/org",
}));
// org.ts uses dynamic imports: "../org.js", "../org-hierarchy.js", "../services.js"
// from the api/ subdir, these are at ../../org.js, ../../org-hierarchy.js, ../../services.js
vi.mock("../../org.js", () => ({
  scanOrg: vi.fn(),
  updateEmployeeYaml: vi.fn(),
}));
vi.mock("../../org-hierarchy.js", () => ({
  resolveOrgHierarchy: vi.fn(),
}));
vi.mock("../../services.js", () => ({
  buildServiceRegistry: vi.fn(),
  buildRoutePath: vi.fn().mockReturnValue(["alice", "bob"]),
  resolveManagerChain: vi.fn().mockReturnValue([]),
}));

import * as orgMock from "../../org.js";
import * as hierarchyMock from "../../org-hierarchy.js";
import * as servicesMock from "../../services.js";
import { handleOrgRequest } from "../org.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const makeRes = (): ServerResponse =>
  ({
    writeHead: vi.fn(),
    end: vi.fn(),
  }) as unknown as ServerResponse;

const makeReq = (bodyObj: unknown = {}): never => {
  const bodyStr = JSON.stringify(bodyObj);
  return {
    headers: { "content-type": "application/json" },
    on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
      if (event === "data") cb(Buffer.from(bodyStr));
      if (event === "end") cb();
    }),
  } as never;
};

const makeContext = (): ApiContext =>
  ({
    emit: vi.fn(),
    connectors: new Map(),
    sessionManager: {
      getEngine: vi.fn().mockReturnValue(null),
      getQueue: vi.fn().mockReturnValue({ getPendingCount: vi.fn().mockReturnValue(0), getTransportState: vi.fn() }),
    },
    getConfig: vi.fn().mockReturnValue({
      engines: { default: "claude" },
      portal: { portalName: "TestPortal" },
    }),
    startTime: Date.now(),
  }) as unknown as ApiContext;

const getResponseBody = (res: ServerResponse): unknown => {
  const endMock = res.end as ReturnType<typeof vi.fn>;
  return JSON.parse(endMock.mock.calls[0][0]);
};

const getStatusCode = (res: ServerResponse): number => {
  const writeHeadMock = res.writeHead as ReturnType<typeof vi.fn>;
  return writeHeadMock.mock.calls[0][0];
};

// ── Org module mock helpers ────────────────────────────────────────────────

const makeOrgEntry = (name: string, dept = "engineering") => ({
  name,
  displayName: name,
  department: dept,
  rank: "manager",
  engine: "claude",
  model: undefined,
  persona: "persona text",
  alwaysNotify: false,
});

const makeHierarchy = (names: string[]) => ({
  root: names[0] ?? null,
  sorted: names,
  warnings: [],
  nodes: Object.fromEntries(
    names.map((n) => [
      n,
      {
        employee: makeOrgEntry(n),
        parentName: null,
        directReports: [],
        depth: 0,
        chain: [n],
      },
    ]),
  ),
});

// ── GET /api/org ───────────────────────────────────────────────────────────

describe("GET /api/org", () => {
  beforeEach(async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.readdirSync).mockReturnValue([{ name: "engineering", isDirectory: () => true } as never]);
    vi.mocked(orgMock.scanOrg).mockReturnValue(new Map([["alice", makeOrgEntry("alice")]]) as never);
    vi.mocked(hierarchyMock.resolveOrgHierarchy).mockReturnValue(makeHierarchy(["alice"]) as never);
  });

  it("returns empty org when ORG_DIR does not exist", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleOrgRequest(makeReq(), res, context, "GET", "/api/org");
    expect(handled).toBe(true);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.departments).toEqual([]);
    expect(body.employees).toEqual([]);
  });

  it("returns org data when ORG_DIR exists", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleOrgRequest(makeReq(), res, context, "GET", "/api/org");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.departments).toContain("engineering");
    const employees = body.employees as Array<Record<string, unknown>>;
    expect(employees[0].name).toBe("alice");
    // persona should be stripped
    expect(employees[0].persona).toBeUndefined();
  });
});

// ── GET /api/org/services ──────────────────────────────────────────────────

describe("GET /api/org/services", () => {
  beforeEach(() => {
    vi.mocked(orgMock.scanOrg).mockReturnValue(new Map([["alice", makeOrgEntry("alice")]]) as never);
    vi.mocked(servicesMock.buildServiceRegistry).mockReturnValue(
      new Map([
        [
          "svc1",
          {
            declaration: { name: "svc1", description: "Service 1" },
            provider: makeOrgEntry("alice"),
          },
        ],
      ]) as never,
    );
  });

  it("returns list of services", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleOrgRequest(makeReq(), res, context, "GET", "/api/org/services");
    expect(handled).toBe(true);
    const body = getResponseBody(res) as Record<string, unknown>;
    const services = body.services as Array<Record<string, unknown>>;
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe("svc1");
  });
});

// ── POST /api/org/cross-request ────────────────────────────────────────────

describe("POST /api/org/cross-request", () => {
  beforeEach(() => {
    vi.mocked(orgMock.scanOrg).mockReturnValue(
      new Map([
        ["alice", makeOrgEntry("alice")],
        ["bob", makeOrgEntry("bob")],
      ]) as never,
    );
    vi.mocked(hierarchyMock.resolveOrgHierarchy).mockReturnValue(makeHierarchy(["alice", "bob"]) as never);
    vi.mocked(servicesMock.buildServiceRegistry).mockReturnValue(
      new Map([
        [
          "analytics",
          {
            declaration: { name: "analytics", description: "Analytics service" },
            provider: makeOrgEntry("bob"),
          },
        ],
      ]) as never,
    );
    vi.mocked(servicesMock.buildRoutePath).mockReturnValue(["alice", "bob"]);
    vi.mocked(servicesMock.resolveManagerChain).mockReturnValue([]);
  });

  it("returns 400 when required fields are missing", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ fromEmployee: "alice" }); // missing service and prompt
    const handled = await handleOrgRequest(req, res, context, "POST", "/api/org/cross-request");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(400);
  });

  it("returns 404 when requester employee not found", async () => {
    vi.mocked(orgMock.scanOrg).mockReturnValue(new Map() as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ fromEmployee: "unknown", service: "analytics", prompt: "Help me" });
    await handleOrgRequest(req, res, context, "POST", "/api/org/cross-request");
    expect(getStatusCode(res)).toBe(404);
  });

  it("returns 404 when service not found", async () => {
    // Reset scanOrg to have the employee again
    vi.mocked(orgMock.scanOrg).mockReturnValue(new Map([["alice", makeOrgEntry("alice")]]) as never);
    vi.mocked(servicesMock.buildServiceRegistry).mockReturnValue(new Map() as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ fromEmployee: "alice", service: "nonexistent", prompt: "Help me" });
    await handleOrgRequest(req, res, context, "POST", "/api/org/cross-request");
    expect(getStatusCode(res)).toBe(404);
  });

  it("creates cross-request session and returns 201", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ fromEmployee: "alice", service: "analytics", prompt: "Please analyze this data" });
    const handled = await handleOrgRequest(req, res, context, "POST", "/api/org/cross-request");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(201);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.sessionId).toBe("sess-1");
    expect(body.service).toBe("analytics");
  });

  it("includes parentSessionId when provided", async () => {
    const { createSession } = await import("../../../sessions/registry.js");
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({
      fromEmployee: "alice",
      service: "analytics",
      prompt: "Analyze",
      parentSessionId: "parent-123",
    });
    await handleOrgRequest(req, res, context, "POST", "/api/org/cross-request");
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ parentSessionId: "parent-123" }));
  });
});

// ── GET /api/org/employees/:name ───────────────────────────────────────────

describe("GET /api/org/employees/:name", () => {
  beforeEach(() => {
    vi.mocked(orgMock.scanOrg).mockReturnValue(new Map([["alice", makeOrgEntry("alice")]]) as never);
    vi.mocked(hierarchyMock.resolveOrgHierarchy).mockReturnValue(makeHierarchy(["alice"]) as never);
  });

  it("returns 404 when employee not found", async () => {
    vi.mocked(orgMock.scanOrg).mockReturnValue(new Map() as never);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleOrgRequest(makeReq(), res, context, "GET", "/api/org/employees/unknown");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("returns employee data with hierarchy info", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleOrgRequest(makeReq(), res, context, "GET", "/api/org/employees/alice");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.name).toBe("alice");
    expect(body.parentName).toBeDefined();
  });
});

// ── PATCH /api/org/employees/:name ────────────────────────────────────────

describe("PATCH /api/org/employees/:name", () => {
  it("returns 404 when employee not found", async () => {
    vi.mocked(orgMock.updateEmployeeYaml).mockReturnValue(null as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ alwaysNotify: true });
    const handled = await handleOrgRequest(req, res, context, "PATCH", "/api/org/employees/unknown");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("updates employee alwaysNotify and emits event", async () => {
    vi.mocked(orgMock.updateEmployeeYaml).mockReturnValue(makeOrgEntry("alice") as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ alwaysNotify: true });
    const handled = await handleOrgRequest(req, res, context, "PATCH", "/api/org/employees/alice");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    expect(context.emit).toHaveBeenCalledWith("org:updated", { employee: "alice" });
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });

  it("passes undefined when alwaysNotify is not boolean", async () => {
    vi.mocked(orgMock.updateEmployeeYaml).mockReturnValue(makeOrgEntry("alice") as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ alwaysNotify: "yes" }); // string instead of boolean
    await handleOrgRequest(req, res, context, "PATCH", "/api/org/employees/alice");
    expect(orgMock.updateEmployeeYaml).toHaveBeenCalledWith("alice", { alwaysNotify: undefined });
  });
});

// ── GET /api/org/departments/:name/board ──────────────────────────────────

describe("GET /api/org/departments/:name/board", () => {
  it("returns 404 when board file does not exist", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleOrgRequest(makeReq(), res, context, "GET", "/api/org/departments/engineering/board");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("returns board data when file exists", async () => {
    const fs = await import("node:fs");
    const boardData = { columns: ["todo", "done"], tasks: [] };
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.readFileSync).mockReturnValue(JSON.stringify(boardData) as never);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleOrgRequest(makeReq(), res, context, "GET", "/api/org/departments/engineering/board");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.columns).toEqual(["todo", "done"]);
  });
});

// ── PUT /api/org/departments/:name/board ──────────────────────────────────

describe("PUT /api/org/departments/:name/board", () => {
  it("returns 404 when department directory does not exist", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ columns: ["todo"], tasks: [] });
    const handled = await handleOrgRequest(req, res, context, "PUT", "/api/org/departments/missing/board");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("saves board and emits event when dept exists", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
    const context = makeContext();
    const res = makeRes();
    const boardData = { columns: ["todo", "in-progress", "done"], tasks: [] };
    const req = makeReq(boardData);
    const handled = await handleOrgRequest(req, res, context, "PUT", "/api/org/departments/engineering/board");
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    expect(context.emit).toHaveBeenCalledWith("board:updated", { department: "engineering" });
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });
});

// ── Unmatched routes ───────────────────────────────────────────────────────

describe("unmatched routes", () => {
  it("returns false for unknown route", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleOrgRequest(makeReq(), res, context, "GET", "/api/unknown");
    expect(handled).toBe(false);
  });
});
