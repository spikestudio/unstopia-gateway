import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock paths.js before importing logger
vi.mock("../paths.js", () => ({
  LOGS_DIR: "/tmp/logger-test-noop",
}));

// Mock fs so no actual file I/O happens
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(() => ({
      write: vi.fn(),
    })),
  };
});

import { configureLogger, type LogContext, logger } from "../logger.js";

describe("AC-E023-01: JSON mode produces parseable JSON with correct fields", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    configureLogger({ stdout: true, file: false, json: true, level: "debug" });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    // Reset to plain text defaults
    configureLogger({ stdout: true, file: false, json: false, level: "info" });
  });

  it("info log produces valid JSON", () => {
    logger.info("hello world");
    expect(stdoutSpy).toHaveBeenCalledOnce();
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello world");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("JSON output contains timestamp in ISO 8601 format", () => {
    logger.info("ts check");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(() => new Date(parsed.timestamp)).not.toThrow();
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it("warn log has level=warn in JSON", () => {
    logger.warn("something fishy");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("warn");
  });

  it("error log has level=error in JSON", () => {
    logger.error("boom");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("error");
  });

  it("debug log has level=debug in JSON", () => {
    logger.debug("trace");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("debug");
  });
});

describe("AC-E023-02: ctx.sessionId appears in JSON log output", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    configureLogger({ stdout: true, file: false, json: true, level: "debug" });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    configureLogger({ stdout: true, file: false, json: false, level: "info" });
  });

  it("sessionId from context appears in JSON output", () => {
    const ctx: LogContext = { sessionId: "sess-abc-123" };
    logger.info("session event", ctx);
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.sessionId).toBe("sess-abc-123");
  });

  it("connector field from context appears in JSON output", () => {
    const ctx: LogContext = { connector: "telegram" };
    logger.info("connector event", ctx);
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.connector).toBe("telegram");
  });

  it("engine field from context appears in JSON output", () => {
    const ctx: LogContext = { engine: "claude" };
    logger.info("engine event", ctx);
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.engine).toBe("claude");
  });

  it("multiple context fields all appear in JSON", () => {
    const ctx: LogContext = { sessionId: "s1", connector: "slack", engine: "codex" };
    logger.info("multi-ctx", ctx);
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.sessionId).toBe("s1");
    expect(parsed.connector).toBe("slack");
    expect(parsed.engine).toBe("codex");
  });

  it("undefined context fields are omitted from JSON", () => {
    const ctx: LogContext = { sessionId: "s2", connector: undefined };
    logger.info("partial-ctx", ctx);
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.sessionId).toBe("s2");
    expect("connector" in parsed).toBe(false);
  });

  it("no context produces JSON without extra fields", () => {
    logger.info("no ctx");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect("sessionId" in parsed).toBe(false);
  });
});

describe("AC-E023-03: Default (plain text) mode unchanged", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    configureLogger({ stdout: true, file: false, json: false, level: "debug" });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    configureLogger({ stdout: true, file: false, json: false, level: "info" });
  });

  it("plain text output is not JSON", () => {
    logger.info("plain message");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    expect(() => JSON.parse(raw)).toThrow();
  });

  it("plain text output contains level in uppercase", () => {
    logger.info("level check");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    expect(raw).toContain("[INFO]");
  });

  it("plain text output contains the message", () => {
    logger.warn("watch out");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    expect(raw).toContain("watch out");
  });

  it("plain text output contains ISO timestamp prefix", () => {
    logger.error("oops");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    // ISO timestamp starts with digit year
    expect(raw).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("log below minLevel is suppressed", () => {
    configureLogger({ stdout: true, file: false, json: false, level: "warn" });
    logger.debug("hidden");
    logger.info("also hidden");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("log at or above minLevel is emitted", () => {
    configureLogger({ stdout: true, file: false, json: false, level: "warn" });
    logger.warn("visible");
    expect(stdoutSpy).toHaveBeenCalledOnce();
  });
});

describe("AC-E023-04 (configureLogger): switching between modes", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    configureLogger({ stdout: true, file: false, json: false, level: "info" });
  });

  it("switching to json=true produces JSON output", () => {
    configureLogger({ stdout: true, file: false, json: true, level: "info" });
    logger.info("switched to json");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("info");
  });

  it("switching back to json=false produces plain text", () => {
    configureLogger({ stdout: true, file: false, json: true, level: "info" });
    configureLogger({ json: false });
    logger.info("back to plain");
    const raw = String(stdoutSpy.mock.calls[0][0]).trim();
    expect(raw).toContain("[INFO]");
    expect(() => JSON.parse(raw)).toThrow();
  });

  it("stdout=false suppresses stdout output", () => {
    configureLogger({ stdout: false, file: false, json: false, level: "info" });
    logger.info("silent");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
