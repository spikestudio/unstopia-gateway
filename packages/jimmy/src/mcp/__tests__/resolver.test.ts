import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { tmpJinnHomeForModule } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports suppress-approved: vi.hoisted()内のrequireはESMとの競合回避のため技術的必要性あり
  const fss = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports suppress-approved: vi.hoisted()内のrequireはESMとの競合回避のため技術的必要性あり
  const oss = require("node:os") as typeof import("node:os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports suppress-approved: vi.hoisted()内のrequireはESMとの競合回避のため技術的必要性あり
  const ps = require("node:path") as typeof import("node:path");
  return { tmpJinnHomeForModule: fss.mkdtempSync(ps.join(oss.tmpdir(), "jinn-paths-")) };
});

import { logger } from "../../shared/logger.js";
import { cleanupMcpConfigFile, resolveEnvVar, resolveMcpServers, writeMcpConfigFile } from "../resolver.js";

vi.mock("../../shared/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  JINN_HOME: tmpJinnHomeForModule,
}));

// ── resolveEnvVar ─────────────────────────────────────────────────────────────

describe("resolveEnvVar", () => {
  beforeEach(() => {
    vi.stubEnv("TEST_VAR_RESOLVE", "hello-world");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // AC-E027-38
  it("should return env var value for ${VAR_NAME} syntax", () => {
    expect(resolveEnvVar("${TEST_VAR_RESOLVE}")).toBe("hello-world");
  });

  // AC-E027-39
  it("should return env var value for $VAR_NAME syntax", () => {
    expect(resolveEnvVar("$TEST_VAR_RESOLVE")).toBe("hello-world");
  });

  // AC-E027-40
  it("should return undefined when ${VAR_NAME} env var is not set", () => {
    expect(resolveEnvVar("${UNSET_VAR_XYZ_123}")).toBeUndefined();
  });

  it("should return undefined when $VAR_NAME env var is not set", () => {
    expect(resolveEnvVar("$UNSET_VAR_XYZ_456")).toBeUndefined();
  });

  // AC-E027-41
  it("should return the string as-is for plain strings without $ prefix", () => {
    expect(resolveEnvVar("plain-string")).toBe("plain-string");
  });

  // AC-E027-42
  it("should return undefined when value is undefined", () => {
    expect(resolveEnvVar(undefined)).toBeUndefined();
  });
});

// ── writeMcpConfigFile / cleanupMcpConfigFile ─────────────────────────────────

describe("writeMcpConfigFile / cleanupMcpConfigFile", () => {
  const testSessionId = "test-session-abc123";

  afterEach(() => {
    // Clean up any written files
    const filePath = path.join(tmpJinnHomeForModule, "tmp", "mcp", `${testSessionId}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  // AC-E027-31
  it("should create JINN_HOME/tmp/mcp/{sessionId}.json with correct content", () => {
    const config = { mcpServers: { gateway: { command: "node", args: ["gateway-server.js"] } } };

    const filePath = writeMcpConfigFile(config, testSessionId);

    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, "utf-8")) as typeof config;
    expect(written).toEqual(config);
    expect(filePath).toContain(testSessionId);
  });

  // AC-E027-32
  it("should delete JINN_HOME/tmp/mcp/{sessionId}.json on cleanup", () => {
    const config = { mcpServers: {} };
    const filePath = writeMcpConfigFile(config, testSessionId);
    expect(fs.existsSync(filePath)).toBe(true);

    cleanupMcpConfigFile(testSessionId);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  // AC-E027-33
  it("should not throw when cleaning up a non-existent session", () => {
    expect(() => cleanupMcpConfigFile("nonexistent-session-xyz")).not.toThrow();
  });
});

// ── resolveMcpServers / buildAvailableServers ─────────────────────────────────

describe("resolveMcpServers", () => {
  // AC-E027-18
  it("should return empty mcpServers when globalMcp is undefined", () => {
    expect(resolveMcpServers(undefined)).toEqual({ mcpServers: {} });
  });

  // AC-E027-19
  it("should return empty mcpServers when employee.mcp is false", () => {
    const config = { browser: { enabled: true } } as never;
    const employee = { mcp: false } as never;
    expect(resolveMcpServers(config, employee)).toEqual({ mcpServers: {} });
  });

  // AC-E027-20
  it("should return only specified servers when employee.mcp is a string array", () => {
    const config = { browser: { enabled: true }, fetch: { enabled: true } } as never;
    const employee = { mcp: ["fetch"] } as never;
    const result = resolveMcpServers(config, employee);
    expect(result.mcpServers).toHaveProperty("fetch");
    expect(result.mcpServers).not.toHaveProperty("browser");
  });

  // AC-E027-21
  it("should return all available servers when employee.mcp is not specified (default)", () => {
    const config = { browser: { enabled: true }, fetch: { enabled: true } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers).toHaveProperty("browser");
    expect(result.mcpServers).toHaveProperty("fetch");
  });
});

describe("buildAvailableServers (via resolveMcpServers)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // AC-E027-22
  it("should register browser server with playwright when provider is playwright (default)", () => {
    const config = { browser: { enabled: true, provider: "playwright" } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers.browser).toMatchObject({
      args: expect.arrayContaining(["@anthropic-ai/mcp-server-playwright"]),
    });
  });

  // AC-E027-23
  it("should register browser server with puppeteer when provider is puppeteer", () => {
    const config = { browser: { enabled: true, provider: "puppeteer" } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers.browser).toMatchObject({
      args: expect.arrayContaining(["@anthropic-ai/mcp-server-puppeteer"]),
    });
  });

  // AC-E027-24
  it("should not register browser server when browser.enabled is false", () => {
    const config = { browser: { enabled: false } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers).not.toHaveProperty("browser");
  });

  // AC-E027-25
  it("should register search server with BRAVE_API_KEY when search is enabled and apiKey resolves", () => {
    vi.stubEnv("BRAVE_API_KEY", "test-brave-key");
    const config = { search: { enabled: true, apiKey: "${BRAVE_API_KEY}" } };
    const result = resolveMcpServers(config);
    expect(result.mcpServers.search).toMatchObject({
      env: { BRAVE_API_KEY: "test-brave-key" },
    });
  });

  // AC-E027-26
  it("should not register search server and warn when apiKey is unresolvable", () => {
    vi.mocked(logger.warn).mockClear();
    const config = { search: { enabled: true, apiKey: "${UNSET_BRAVE_KEY_XYZ}" } };
    const result = resolveMcpServers(config);
    expect(result.mcpServers).not.toHaveProperty("search");
    expect(logger.warn).toHaveBeenCalled();
  });

  // AC-E027-27
  it("should register fetch server when fetch.enabled is true", () => {
    const config = { fetch: { enabled: true } };
    const result = resolveMcpServers(config);
    expect(result.mcpServers.fetch).toMatchObject({
      args: expect.arrayContaining(["@anthropic-ai/mcp-server-fetch"]),
    });
  });

  // AC-E027-28
  it("should register gateway server with node command when gateway.enabled is not false", () => {
    const config = { gateway: { enabled: true } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers.gateway).toMatchObject({ command: "node" });
  });

  // AC-E027-29
  it("should register custom URL server with type: sse when url is present", () => {
    const config = { custom: { myserver: { url: "https://example.com/mcp" } } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers.myserver).toMatchObject({ type: "sse", url: "https://example.com/mcp" });
  });

  // AC-E027-30
  it("should not register custom server when enabled is false", () => {
    const config = { custom: { myserver: { command: "node", args: ["server.js"], enabled: false } } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers).not.toHaveProperty("myserver");
  });

  // Coverage補完: browser.enabled=true だが provider が未知 → browser 未登録
  it("should not register browser server for unknown provider", () => {
    const config = { browser: { enabled: true, provider: "unknown-browser" } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers).not.toHaveProperty("browser");
  });

  // Coverage補完: employee.mcp に存在しないサーバー名 → warn
  it("should warn when employee requests a server that is not configured", () => {
    vi.mocked(logger.warn).mockClear();
    const config = { fetch: { enabled: true } } as never;
    const employee = { name: "alice", mcp: ["nonexistent-server"] } as never;
    resolveMcpServers(config, employee);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("nonexistent-server"));
  });

  // Coverage補完: gateway dist ファイルが存在する場合 → dist パスを使用
  it("should use dist path for gateway server when compiled file exists", () => {
    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const config = { gateway: { enabled: true } } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers.gateway).toMatchObject({ command: "node" });
    existsSyncSpy.mockRestore();
  });

  // Coverage補完: custom stdio server without env field
  it("should register custom stdio server without env field", () => {
    const config = {
      custom: { myserver: { command: "node", args: ["server.js"] } },
    } as never;
    const result = resolveMcpServers(config);
    expect(result.mcpServers.myserver).toMatchObject({ command: "node" });
  });

  // Coverage補完: custom server with env field → env vars resolved
  it("should resolve env vars in custom server env fields", () => {
    vi.stubEnv("MY_TOKEN", "secret123");
    const config = {
      custom: {
        myserver: {
          command: "node",
          args: ["server.js"],
          env: { TOKEN: "${MY_TOKEN}" },
        },
      },
    } as never;
    const result = resolveMcpServers(config);
    expect((result.mcpServers.myserver as { env?: Record<string, string> }).env?.TOKEN).toBe("secret123");
  });

  // Coverage補完: custom server env with unresolvable var → falls back to original value
  it("should keep original value when env var in custom server is unresolvable", () => {
    const config = {
      custom: {
        myserver: {
          command: "node",
          args: ["server.js"],
          env: { TOKEN: "${UNSET_CUSTOM_TOKEN_XYZ}" },
        },
      },
    } as never;
    const result = resolveMcpServers(config);
    // Falls back to original value when unresolvable
    expect((result.mcpServers.myserver as { env?: Record<string, string> }).env?.TOKEN).toBe(
      "${UNSET_CUSTOM_TOKEN_XYZ}",
    );
  });
});
