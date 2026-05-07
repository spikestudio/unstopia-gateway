import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;
let configPath: string;

vi.mock("../paths.js", () => ({
  get CONFIG_PATH() {
    return configPath;
  },
  get GATEWAY_HOME() {
    return tmpDir;
  },
}));

import { loadConfig } from "../config.js";

describe("AC-E003-03: loadConfig", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    configPath = path.join(tmpDir, "config.yaml");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when config file does not exist", () => {
    // fs.existsSync(CONFIG_PATH) が false の分岐
    expect(() => loadConfig()).toThrow(/config not found/i);
  });

  it("returns parsed config when file exists", () => {
    const yaml = `
gateway:
  port: 8080
  host: 0.0.0.0
engines:
  default: claude
  claude:
    bin: claude
    model: sonnet
connectors: {}
logging:
  file: false
  stdout: true
  level: info
`;
    fs.writeFileSync(configPath, yaml, "utf-8");
    const config = loadConfig();
    expect((config as unknown as Record<string, unknown>).gateway).toBeDefined();
  });
});
