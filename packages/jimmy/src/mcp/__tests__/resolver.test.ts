import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tmpJinnHomeForModule = fs.mkdtempSync(path.join(os.tmpdir(), "jinn-paths-"));

vi.mock("../../../shared/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../shared/paths.js", () => ({
  JINN_HOME: tmpJinnHomeForModule,
}));

import { cleanupMcpConfigFile, resolveEnvVar, writeMcpConfigFile } from "../resolver.js";

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
