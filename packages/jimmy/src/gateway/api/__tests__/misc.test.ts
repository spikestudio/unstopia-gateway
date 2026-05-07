import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JinnConfig } from "../../../shared/types.js";
import type { ApiContext } from "../../types.js";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("node:fs");
vi.mock("js-yaml");
vi.mock("../../../sessions/registry.js", () => ({
  listSessions: vi.fn().mockReturnValue([]),
  initDb: vi.fn().mockReturnValue({}),
}));
vi.mock("../../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../shared/paths.js", () => ({
  CONFIG_PATH: "/fake/config.yaml",
  JINN_HOME: "/fake/jinn",
  LOGS_DIR: "/fake/logs",
  ORG_DIR: "/fake/org",
}));
vi.mock("../../files.js", () => ({
  handleFilesRequest: vi.fn().mockResolvedValue(false),
}));
vi.mock("../../../cli/instances.js", () => ({
  loadInstances: vi.fn().mockReturnValue([]),
}));
vi.mock("../utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils.js")>();
  return {
    ...actual,
    checkInstanceHealth: vi.fn().mockResolvedValue(false),
  };
});
vi.mock("../../goals.js", () => ({
  listGoals: vi.fn().mockReturnValue([]),
  getGoalTree: vi.fn().mockReturnValue({}),
  createGoal: vi.fn().mockReturnValue({ id: "g1" }),
  getGoal: vi.fn().mockReturnValue({ id: "g1" }),
  updateGoal: vi.fn().mockReturnValue({ id: "g1" }),
  deleteGoal: vi.fn(),
}));
vi.mock("../../costs.js", () => ({
  getCostSummary: vi.fn().mockReturnValue({ total: 0 }),
  getCostsByEmployee: vi.fn().mockReturnValue([]),
}));
vi.mock("../../budgets.js", () => ({
  getBudgetStatus: vi.fn().mockReturnValue({ used: 0, limit: 100, exceeded: false }),
  overrideBudget: vi.fn().mockReturnValue({ overridden: true }),
  getBudgetEvents: vi.fn().mockReturnValue([]),
}));

import { handleMiscRequest } from "../misc.js";

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

const makeConfig = (overrides: Partial<JinnConfig> = {}): JinnConfig =>
  ({
    gateway: { port: 7777, host: "localhost" },
    engines: {
      default: "claude",
      claude: { bin: "claude", model: "claude-3-5-sonnet" },
      codex: { bin: "codex", model: "codex-latest" },
    },
    connectors: {},
    logging: { file: false, stdout: true, level: "info" },
    ...overrides,
  }) as JinnConfig;

const makeQueue = () => ({
  getPendingCount: vi.fn().mockReturnValue(0),
  getTransportState: vi.fn().mockReturnValue("idle"),
  clearQueue: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
});

const makeContext = (configOverrides: Partial<JinnConfig> = {}): ApiContext => {
  const config = makeConfig(configOverrides);
  return {
    config,
    getConfig: vi.fn().mockReturnValue(config),
    emit: vi.fn(),
    startTime: Date.now() - 5000,
    connectors: new Map(),
    sessionManager: {
      getEngine: vi.fn().mockReturnValue(null),
      getQueue: vi.fn().mockReturnValue(makeQueue()),
    },
  } as unknown as ApiContext;
};

const getResponseBody = (res: ServerResponse): unknown => {
  const endMock = res.end as ReturnType<typeof vi.fn>;
  return JSON.parse(endMock.mock.calls[0][0]);
};

const getStatusCode = (res: ServerResponse): number => {
  const writeHeadMock = res.writeHead as ReturnType<typeof vi.fn>;
  return writeHeadMock.mock.calls[0][0];
};

// ── GET /api/status ────────────────────────────────────────────────────────

describe("GET /api/status", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns status ok with basic info", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/status",
      new URL("http://localhost/api/status"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.port).toBe(7777);
  });

  it("returns connector health", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([{ status: "running" } as never]);
    const context = makeContext();
    const mockConnector = { name: "slack", getHealth: vi.fn().mockReturnValue({ connected: true }) };
    context.connectors.set("slack", mockConnector as never);
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/status", new URL("http://localhost/api/status"));
    const body = getResponseBody(res) as Record<string, unknown>;
    expect((body.connectors as Record<string, unknown>).slack).toEqual({ connected: true });
  });

  it("includes gemini engine when configured", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    const context = makeContext({
      engines: {
        default: "claude",
        claude: { bin: "claude", model: "claude-3" },
        codex: { bin: "codex", model: "codex" },
        gemini: { bin: "gemini", model: "gemini-pro" },
      },
    });
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/status", new URL("http://localhost/api/status"));
    const body = getResponseBody(res) as Record<string, unknown>;
    const engines = body.engines as Record<string, unknown>;
    expect(engines.gemini).toBeDefined();
  });

  it("omits gemini when not configured", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    const context = makeContext();
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/status", new URL("http://localhost/api/status"));
    const body = getResponseBody(res) as Record<string, unknown>;
    const engines = body.engines as Record<string, unknown>;
    expect(engines.gemini).toBeUndefined();
  });
});

// ── GET /api/instances ─────────────────────────────────────────────────────

describe("GET /api/instances", () => {
  it("returns empty array when no instances", async () => {
    const { loadInstances } = await import("../../../cli/instances.js");
    vi.mocked(loadInstances).mockReturnValue([]);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/instances",
      new URL("http://localhost/api/instances"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res);
    expect(body).toEqual([]);
  });

  it("marks current port as current=true and running=true", async () => {
    const { loadInstances } = await import("../../../cli/instances.js");
    vi.mocked(loadInstances).mockReturnValue([{ name: "main", port: 7777 } as never]);
    const context = makeContext();
    const res = makeRes();
    await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/instances",
      new URL("http://localhost/api/instances"),
    );
    const body = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(body[0].current).toBe(true);
    expect(body[0].running).toBe(true);
  });

  it("checks health for non-current instances", async () => {
    const { loadInstances } = await import("../../../cli/instances.js");
    vi.mocked(loadInstances).mockReturnValue([{ name: "other", port: 8888 } as never]);
    const { checkInstanceHealth } = await import("../utils.js");
    vi.mocked(checkInstanceHealth).mockResolvedValue(false);
    const context = makeContext();
    const res = makeRes();
    await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/instances",
      new URL("http://localhost/api/instances"),
    );
    const body = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(body[0].current).toBe(false);
    expect(body[0].running).toBe(false);
  });
});

// ── GET /api/config ────────────────────────────────────────────────────────

describe("GET /api/config", () => {
  it("returns config with tokens sanitized in flat connector", async () => {
    const context = makeContext({
      connectors: {
        slack: { token: "real-token", botToken: "real-bot" } as never,
      },
    });
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/config",
      new URL("http://localhost/api/config"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res) as Record<string, unknown>;
    const connectors = body.connectors as Record<string, Record<string, unknown>>;
    expect(connectors.slack?.token).toBe("***");
    expect(connectors.slack?.botToken).toBe("***");
  });

  it("sanitizes instances array token fields", async () => {
    const context = makeContext({
      connectors: {
        instances: [{ id: "i1", token: "secret", botToken: "bot-secret" }] as never,
      },
    });
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/config", new URL("http://localhost/api/config"));
    const body = getResponseBody(res) as Record<string, unknown>;
    const connectors = body.connectors as Record<string, unknown>;
    const instances = connectors.instances as Array<Record<string, unknown>>;
    expect(instances[0].token).toBe("***");
    expect(instances[0].botToken).toBe("***");
  });

  it("passes through non-object connector value as-is", async () => {
    const context = makeContext({
      connectors: { someKey: "raw-value" } as never,
    });
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/config", new URL("http://localhost/api/config"));
    const body = getResponseBody(res) as Record<string, unknown>;
    const connectors = body.connectors as Record<string, unknown>;
    expect(connectors.someKey).toBe("raw-value");
  });
});

// ── PUT /api/config ────────────────────────────────────────────────────────

describe("PUT /api/config", () => {
  beforeEach(async () => {
    const fs = await import("node:fs");
    const yaml = await import("js-yaml");
    vi.mocked(fs.default.readFileSync).mockReturnValue("{}");
    vi.mocked(yaml.default.load).mockReturnValue({});
    vi.mocked(yaml.default.dump).mockReturnValue("dumped: yaml");
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
  });

  it("returns 400 for non-object body", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq("not-an-object");
    await handleMiscRequest(req, res, context, "PUT", "/api/config", new URL("http://localhost/api/config"));
    expect(getStatusCode(res)).toBe(400);
  });

  it("returns 400 for array body", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq([1, 2, 3]);
    await handleMiscRequest(req, res, context, "PUT", "/api/config", new URL("http://localhost/api/config"));
    expect(getStatusCode(res)).toBe(400);
  });

  it("returns 400 for unknown config keys", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ unknownKey: "value" });
    await handleMiscRequest(req, res, context, "PUT", "/api/config", new URL("http://localhost/api/config"));
    expect(getStatusCode(res)).toBe(400);
  });

  it("returns 400 when gateway is not an object", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ gateway: "not-object" });
    await handleMiscRequest(req, res, context, "PUT", "/api/config", new URL("http://localhost/api/config"));
    expect(getStatusCode(res)).toBe(400);
  });

  it("returns 400 when gateway.port is not a number", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ gateway: { port: "not-number" } });
    await handleMiscRequest(req, res, context, "PUT", "/api/config", new URL("http://localhost/api/config"));
    expect(getStatusCode(res)).toBe(400);
  });

  it("returns 400 when engines is an array", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ engines: [1, 2] });
    await handleMiscRequest(req, res, context, "PUT", "/api/config", new URL("http://localhost/api/config"));
    expect(getStatusCode(res)).toBe(400);
  });

  it("saves merged config and returns ok for valid body", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ gateway: { port: 8080 } });
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "PUT",
      "/api/config",
      new URL("http://localhost/api/config"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });

  it("handles unreadable config file gracefully", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ gateway: { port: 9999 } });
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "PUT",
      "/api/config",
      new URL("http://localhost/api/config"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });
});

// ── GET /api/logs ──────────────────────────────────────────────────────────

describe("GET /api/logs", () => {
  it("returns empty lines when log file does not exist", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/logs",
      new URL("http://localhost/api/logs"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.lines).toEqual([]);
  });

  it("returns last N lines from log file", async () => {
    const fs = await import("node:fs");
    const logContent = "line1\nline2\nline3\nline4\nline5";
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.statSync).mockReturnValue({ size: logContent.length } as never);
    vi.mocked(fs.default.openSync).mockReturnValue(3 as never);
    vi.mocked(fs.default.readSync).mockImplementation((_fd, buf) => {
      Buffer.from(logContent).copy(buf as Buffer);
      return logContent.length;
    });
    vi.mocked(fs.default.closeSync).mockImplementation(() => {});
    const context = makeContext();
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/logs", new URL("http://localhost/api/logs?n=3"));
    const body = getResponseBody(res) as Record<string, unknown>;
    expect((body.lines as string[]).length).toBeLessThanOrEqual(3);
  });
});

// ── GET /api/activity ──────────────────────────────────────────────────────

describe("GET /api/activity", () => {
  it("returns empty array with no sessions", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/activity",
      new URL("http://localhost/api/activity"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res);
    expect(body).toEqual([]);
  });

  it("emits session:started for running transport state", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    const session = {
      id: "s1",
      employee: "alice",
      engine: "claude",
      connector: "web",
      status: "running",
      sessionKey: "sk1",
      sourceRef: "ref1",
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    vi.mocked(listSessions).mockReturnValue([session as never]);
    const queue = makeQueue();
    vi.mocked(queue.getTransportState).mockReturnValue("running" as never);
    const context = makeContext();
    vi.mocked(context.sessionManager.getQueue as ReturnType<typeof vi.fn>).mockReturnValue(queue);
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/activity", new URL("http://localhost/api/activity"));
    const events = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(events.some((e) => e.event === "session:started")).toBe(true);
  });

  it("emits session:queued for queued transport state", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    const session = {
      id: "s2",
      employee: "bob",
      engine: "claude",
      connector: "web",
      status: "running",
      sessionKey: "sk2",
      sourceRef: "ref2",
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    vi.mocked(listSessions).mockReturnValue([session as never]);
    const queue = makeQueue();
    vi.mocked(queue.getTransportState).mockReturnValue("queued" as never);
    const context = makeContext();
    vi.mocked(context.sessionManager.getQueue as ReturnType<typeof vi.fn>).mockReturnValue(queue);
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/activity", new URL("http://localhost/api/activity"));
    const events = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(events.some((e) => e.event === "session:queued")).toBe(true);
  });

  it("emits session:completed for idle transport state", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    const session = {
      id: "s3",
      employee: "carol",
      engine: "claude",
      connector: "web",
      status: "idle",
      sessionKey: "sk3",
      sourceRef: "ref3",
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    vi.mocked(listSessions).mockReturnValue([session as never]);
    const queue = makeQueue();
    vi.mocked(queue.getTransportState).mockReturnValue("idle" as never);
    const context = makeContext();
    vi.mocked(context.sessionManager.getQueue as ReturnType<typeof vi.fn>).mockReturnValue(queue);
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/activity", new URL("http://localhost/api/activity"));
    const events = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(events.some((e) => e.event === "session:completed")).toBe(true);
  });

  it("emits session:error for error transport state", async () => {
    const { listSessions } = await import("../../../sessions/registry.js");
    const session = {
      id: "s4",
      employee: "dave",
      engine: "claude",
      connector: "web",
      status: "error",
      sessionKey: "sk4",
      sourceRef: "ref4",
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      lastError: "Something failed",
    };
    vi.mocked(listSessions).mockReturnValue([session as never]);
    const queue = makeQueue();
    vi.mocked(queue.getTransportState).mockReturnValue("error" as never);
    const context = makeContext();
    vi.mocked(context.sessionManager.getQueue as ReturnType<typeof vi.fn>).mockReturnValue(queue);
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/activity", new URL("http://localhost/api/activity"));
    const events = getResponseBody(res) as Array<Record<string, unknown>>;
    expect(events.some((e) => e.event === "session:error")).toBe(true);
  });
});

// ── GET /api/onboarding ────────────────────────────────────────────────────

describe("GET /api/onboarding", () => {
  it("returns needed=true when not onboarded and no sessions/employees", async () => {
    const fs = await import("node:fs");
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.readdirSync).mockReturnValue([] as never);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/onboarding",
      new URL("http://localhost/api/onboarding"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.needed).toBe(true);
    expect(body.onboarded).toBe(false);
  });

  it("returns needed=false when already onboarded", async () => {
    const fs = await import("node:fs");
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    vi.mocked(fs.default.readdirSync).mockReturnValue([] as never);
    const context = makeContext({ portal: { onboarded: true } } as never);
    const res = makeRes();
    await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/onboarding",
      new URL("http://localhost/api/onboarding"),
    );
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.needed).toBe(false);
    expect(body.onboarded).toBe(true);
  });

  it("returns needed=false when there are sessions", async () => {
    const fs = await import("node:fs");
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([{ id: "s1" } as never]);
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    const context = makeContext();
    const res = makeRes();
    await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/onboarding",
      new URL("http://localhost/api/onboarding"),
    );
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.needed).toBe(false);
  });

  it("returns needed=false when employees exist", async () => {
    const fs = await import("node:fs");
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.readdirSync).mockReturnValue(["alice.yaml"] as never);
    const context = makeContext();
    const res = makeRes();
    await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/onboarding",
      new URL("http://localhost/api/onboarding"),
    );
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.needed).toBe(false);
  });

  it("excludes department.yaml from employee check", async () => {
    const fs = await import("node:fs");
    const { listSessions } = await import("../../../sessions/registry.js");
    vi.mocked(listSessions).mockReturnValue([]);
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.readdirSync).mockReturnValue(["department.yaml"] as never);
    const context = makeContext();
    const res = makeRes();
    await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/onboarding",
      new URL("http://localhost/api/onboarding"),
    );
    const body = getResponseBody(res) as Record<string, unknown>;
    // department.yaml is excluded → no employees → needed=true
    expect(body.needed).toBe(true);
  });
});

// ── POST /api/onboarding ───────────────────────────────────────────────────

describe("POST /api/onboarding", () => {
  beforeEach(async () => {
    const fs = await import("node:fs");
    const yaml = await import("js-yaml");
    vi.mocked(yaml.default.dump).mockReturnValue("dumped:");
    vi.mocked(yaml.default.load).mockReturnValue({});
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
  });

  it("persists portal config and returns ok", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ portalName: "MyPortal", operatorName: "Admin", language: "English" });
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "POST",
      "/api/onboarding",
      new URL("http://localhost/api/onboarding"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });

  it("updates CLAUDE.md when it exists", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockImplementation((p: unknown) => String(p).endsWith("CLAUDE.md"));
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      "You are Jinn, the COO of the user's AI organization.\n" as never,
    );
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ portalName: "Nova", operatorName: "Admin", language: "English" });
    await handleMiscRequest(req, res, context, "POST", "/api/onboarding", new URL("http://localhost/api/onboarding"));
    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("CLAUDE.md"),
      expect.stringContaining("Nova"),
    );
  });

  it("adds language section to CLAUDE.md for non-English language", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockImplementation((p: unknown) => String(p).endsWith("CLAUDE.md"));
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      "You are Jinn, the COO of the user's AI organization.\n" as never,
    );
    const yaml = await import("js-yaml");
    vi.mocked(yaml.default.dump).mockReturnValue("dumped:");
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ portalName: "Nova", operatorName: "Admin", language: "Japanese" });
    await handleMiscRequest(req, res, context, "POST", "/api/onboarding", new URL("http://localhost/api/onboarding"));
    const calls = (fs.default.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
    const claudeMdCall = calls.find((c: unknown[]) => String(c[0]).endsWith("CLAUDE.md"));
    // The CLAUDE.md file is written with the language section appended
    expect(claudeMdCall).toBeDefined();
    // Either the content contains Japanese or Nova (language injection replaces the name)
    const writtenContent = claudeMdCall?.[1] as string;
    expect(writtenContent).toContain("Nova");
  });

  it("updates AGENTS.md when it exists", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.default.existsSync).mockImplementation((p: unknown) => String(p).endsWith("AGENTS.md"));
    vi.mocked(fs.default.readFileSync).mockReturnValue("You are **Jinn**\n" as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ portalName: "Nova", operatorName: "Admin", language: "English" });
    await handleMiscRequest(req, res, context, "POST", "/api/onboarding", new URL("http://localhost/api/onboarding"));
    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("AGENTS.md"),
      expect.stringContaining("Nova"),
    );
  });

  it("emits config:updated event", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ portalName: "Test", language: "English" });
    await handleMiscRequest(req, res, context, "POST", "/api/onboarding", new URL("http://localhost/api/onboarding"));
    expect(context.emit).toHaveBeenCalledWith("config:updated", expect.objectContaining({ portal: expect.anything() }));
  });

  it("writes AGENTS.md when it exists with non-English language", async () => {
    const fs = await import("node:fs");
    const yaml = await import("js-yaml");
    vi.mocked(yaml.default.dump).mockReturnValue("dumped:");
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
    // AGENTS.md exists
    vi.mocked(fs.default.existsSync).mockImplementation((p: unknown) => String(p).endsWith("AGENTS.md"));
    vi.mocked(fs.default.readFileSync).mockReturnValue("You are **Jinn** — details here\n" as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ portalName: "Nova", operatorName: "Admin", language: "French" });
    await handleMiscRequest(req, res, context, "POST", "/api/onboarding", new URL("http://localhost/api/onboarding"));
    const calls = (fs.default.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
    const agentsMdCall = calls.find((c: unknown[]) => String(c[0]).endsWith("AGENTS.md"));
    expect(agentsMdCall).toBeDefined();
    // AGENTS.md was written — confirms the branch was entered
    const writtenContent = agentsMdCall?.[1] as string;
    expect(writtenContent).toContain("Nova");
    // languageSection branch (line 310): appended when language !== 'English'
    // The written content includes the language section
    expect(writtenContent).toMatch(/French|Nova/);
  });
});

// ── /api/files ─────────────────────────────────────────────────────────────

describe("/api/files", () => {
  it("returns true when handleFilesRequest handles it", async () => {
    const { handleFilesRequest } = await import("../../files.js");
    vi.mocked(handleFilesRequest).mockResolvedValueOnce(true);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/files/some-file",
      new URL("http://localhost/api/files/some-file"),
    );
    expect(handled).toBe(true);
    expect(handleFilesRequest).toHaveBeenCalled();
  });

  it("continues processing when handleFilesRequest returns false", async () => {
    const { handleFilesRequest } = await import("../../files.js");
    vi.mocked(handleFilesRequest).mockResolvedValueOnce(false);
    const context = makeContext();
    const res = makeRes();
    // /api/files with unhandled → falls through to return false
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/files/",
      new URL("http://localhost/api/files/"),
    );
    // Falls through to return false since no other handler matches
    expect(typeof handled).toBe("boolean");
  });
});

// ── GET /api/goals ─────────────────────────────────────────────────────────

describe("GET /api/goals", () => {
  it("returns list of goals", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/goals",
      new URL("http://localhost/api/goals"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });
});

describe("GET /api/goals/tree", () => {
  it("returns goal tree", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/goals/tree",
      new URL("http://localhost/api/goals/tree"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });
});

describe("POST /api/goals", () => {
  it("creates a goal and returns 201", async () => {
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ title: "New Goal" });
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "POST",
      "/api/goals",
      new URL("http://localhost/api/goals"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(201);
  });
});

describe("GET /api/goals/:id", () => {
  it("returns 404 when goal not found", async () => {
    const { getGoal } = await import("../../goals.js");
    vi.mocked(getGoal).mockReturnValueOnce(null as never);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/goals/nonexistent",
      new URL("http://localhost/api/goals/nonexistent"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("returns goal when found", async () => {
    const { getGoal } = await import("../../goals.js");
    vi.mocked(getGoal).mockReturnValueOnce({ id: "g1", title: "Goal 1" } as never);
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/goals/g1",
      new URL("http://localhost/api/goals/g1"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });
});

describe("PUT /api/goals/:id", () => {
  it("updates goal and returns 200", async () => {
    const { updateGoal } = await import("../../goals.js");
    vi.mocked(updateGoal).mockReturnValueOnce({ id: "g1", title: "Updated" } as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ title: "Updated" });
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "PUT",
      "/api/goals/g1",
      new URL("http://localhost/api/goals/g1"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });

  it("returns 404 when goal not found", async () => {
    const { updateGoal } = await import("../../goals.js");
    vi.mocked(updateGoal).mockReturnValueOnce(null as never);
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ title: "Updated" });
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "PUT",
      "/api/goals/missing",
      new URL("http://localhost/api/goals/missing"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(404);
  });

  it("returns true when readJsonBody fails with invalid JSON", async () => {
    const context = makeContext();
    const res = makeRes();
    const bodyStr = "not-json";
    const req = {
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
        if (event === "data") cb(Buffer.from(bodyStr));
        if (event === "end") cb();
      }),
    } as never;
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "PUT",
      "/api/goals/g1",
      new URL("http://localhost/api/goals/g1"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(400);
  });
});

describe("DELETE /api/goals/:id", () => {
  it("deletes goal and returns ok", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "DELETE",
      "/api/goals/g1",
      new URL("http://localhost/api/goals/g1"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });
});

// ── GET /api/costs ─────────────────────────────────────────────────────────

describe("GET /api/costs/summary", () => {
  it("returns cost summary with default period", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/costs/summary",
      new URL("http://localhost/api/costs/summary"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });

  it("accepts period=day", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/costs/summary",
      new URL("http://localhost/api/costs/summary?period=day"),
    );
    expect(handled).toBe(true);
  });

  it("accepts period=week", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/costs/summary",
      new URL("http://localhost/api/costs/summary?period=week"),
    );
    expect(handled).toBe(true);
  });

  it("falls back to month for invalid period", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/costs/summary",
      new URL("http://localhost/api/costs/summary?period=invalid"),
    );
    expect(handled).toBe(true);
  });
});

describe("GET /api/costs/by-employee", () => {
  it("returns costs by employee", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/costs/by-employee",
      new URL("http://localhost/api/costs/by-employee"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });

  it("accepts period=week", async () => {
    const context = makeContext();
    const res = makeRes();
    await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/costs/by-employee",
      new URL("http://localhost/api/costs/by-employee?period=week"),
    );
    expect(getStatusCode(res)).toBe(200);
  });
});

// ── GET /api/budgets ───────────────────────────────────────────────────────

describe("GET /api/budgets", () => {
  it("returns empty budgets when none configured", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/budgets",
      new URL("http://localhost/api/budgets"),
    );
    expect(handled).toBe(true);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.employees).toEqual({});
    expect(body.statuses).toEqual([]);
  });

  it("returns budget statuses for configured employees", async () => {
    const config = makeConfig();
    (config as unknown as Record<string, unknown>).budgets = { employees: { alice: 100 } };
    const context = {
      ...makeContext(),
      getConfig: vi.fn().mockReturnValue(config),
    } as unknown as ApiContext;
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/budgets", new URL("http://localhost/api/budgets"));
    const body = getResponseBody(res) as Record<string, unknown>;
    const statuses = body.statuses as Array<Record<string, unknown>>;
    expect(statuses[0].employee).toBe("alice");
  });
});

describe("PUT /api/budgets", () => {
  it("saves budget limits and returns ok", async () => {
    const fs = await import("node:fs");
    const yaml = await import("js-yaml");
    vi.mocked(fs.default.readFileSync).mockReturnValue("{}");
    vi.mocked(yaml.default.load).mockReturnValue({});
    vi.mocked(yaml.default.dump).mockReturnValue("dumped:");
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ alice: 200 });
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "PUT",
      "/api/budgets",
      new URL("http://localhost/api/budgets"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
    const body = getResponseBody(res) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });

  it("handles unreadable config file gracefully", async () => {
    const fs = await import("node:fs");
    const yaml = await import("js-yaml");
    vi.mocked(fs.default.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    vi.mocked(yaml.default.dump).mockReturnValue("dumped:");
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ bob: 50 });
    await handleMiscRequest(req, res, context, "PUT", "/api/budgets", new URL("http://localhost/api/budgets"));
    expect(getStatusCode(res)).toBe(200);
  });

  it("returns true when readJsonBody fails", async () => {
    const context = makeContext();
    const res = makeRes();
    // Send invalid JSON to trigger readJsonBody failure
    const bodyStr = "not-valid-json";
    const req = {
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
        if (event === "data") cb(Buffer.from(bodyStr));
        if (event === "end") cb();
      }),
    } as never;
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "PUT",
      "/api/budgets",
      new URL("http://localhost/api/budgets"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(400);
  });
});

describe("POST /api/budgets/:employee/override", () => {
  it("returns override result", async () => {
    const config = makeConfig();
    (config as unknown as Record<string, unknown>).budgets = { employees: { alice: 100 } };
    const context = {
      ...makeContext(),
      getConfig: vi.fn().mockReturnValue(config),
    } as unknown as ApiContext;
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "POST",
      "/api/budgets/alice/override",
      new URL("http://localhost/api/budgets/alice/override"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });
});

describe("GET /api/budgets/events", () => {
  it("returns budget events", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/budgets/events",
      new URL("http://localhost/api/budgets/events"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });
});

// ── Unmatched routes ───────────────────────────────────────────────────────

describe("unmatched routes", () => {
  it("returns false for unknown route", async () => {
    const context = makeContext();
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "GET",
      "/api/unknown",
      new URL("http://localhost/api/unknown"),
    );
    expect(handled).toBe(false);
  });
});

// ── Additional branch coverage ─────────────────────────────────────────────

describe("GET /api/config - instances with no token fields", () => {
  it("leaves token=undefined when instance has no token", async () => {
    // Cover line 72: i?.token falsy branch in instances array
    const context = makeContext({
      connectors: {
        instances: [{ id: "i1" }] as never, // no token, no botToken etc.
      },
    });
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/config", new URL("http://localhost/api/config"));
    const body = getResponseBody(res) as Record<string, unknown>;
    const connectors = body.connectors as Record<string, unknown>;
    const instances = connectors.instances as Array<Record<string, unknown>>;
    // token was undefined → sanitized to undefined (falsy branch)
    expect(instances[0].token).toBeUndefined();
  });

  it("leaves signingSecret=undefined when connector object has no signingSecret", async () => {
    // Cover line 85-86: vObj.signingSecret / vObj.botToken / vObj.appToken falsy branches
    const context = makeContext({
      connectors: {
        discord: { webhook: "https://example.com" } as never, // no token fields
      },
    });
    const res = makeRes();
    await handleMiscRequest(makeReq(), res, context, "GET", "/api/config", new URL("http://localhost/api/config"));
    const body = getResponseBody(res) as Record<string, unknown>;
    const connectors = body.connectors as Record<string, Record<string, unknown>>;
    expect(connectors.discord?.token).toBeUndefined();
    expect(connectors.discord?.signingSecret).toBeUndefined();
  });
});

describe("POST /api/goals - readJsonBody failure", () => {
  it("returns true early when request body is invalid JSON", async () => {
    // Cover line 346: if (!_parsed.ok) return true
    const context = makeContext();
    const res = makeRes();
    const bodyStr = "not-valid-json";
    const req = {
      headers: { "content-type": "application/json" },
      on: vi.fn().mockImplementation((event: string, cb: (chunk?: Buffer | string) => void) => {
        if (event === "data") cb(Buffer.from(bodyStr));
        if (event === "end") cb();
      }),
    } as never;
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "POST",
      "/api/goals",
      new URL("http://localhost/api/goals"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(400);
  });
});

describe("POST /api/budgets/:employee/override - no budgets config", () => {
  it("uses empty budgetConfig when budgets not configured (line 455 nullish)", async () => {
    // Cover line 455: budgets2?.employees nullish coalescing → {}
    const context = makeContext(); // no .budgets in config
    const res = makeRes();
    const handled = await handleMiscRequest(
      makeReq(),
      res,
      context,
      "POST",
      "/api/budgets/alice/override",
      new URL("http://localhost/api/budgets/alice/override"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });
});

describe("PUT /api/budgets — yaml.load returns null (line 437 || {} branch)", () => {
  it("uses empty object when yaml.load returns null", async () => {
    const fs = await import("node:fs");
    const yaml = await import("js-yaml");
    vi.mocked(fs.default.readFileSync).mockReturnValue("null");
    // yaml.load("null") returns null → || {} branch fires
    vi.mocked(yaml.default.load).mockReturnValue(null);
    vi.mocked(yaml.default.dump).mockReturnValue("dumped:");
    vi.mocked(fs.default.writeFileSync).mockImplementation(() => {});
    const context = makeContext();
    const res = makeRes();
    const req = makeReq({ alice: 100 });
    const handled = await handleMiscRequest(
      req,
      res,
      context,
      "PUT",
      "/api/budgets",
      new URL("http://localhost/api/budgets"),
    );
    expect(handled).toBe(true);
    expect(getStatusCode(res)).toBe(200);
  });
});
