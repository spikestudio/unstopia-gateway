import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => true),
      statSync: vi.fn(() => ({ mtimeMs: Date.now() - 60000 })),
    },
  };
});

vi.mock("../../gateway/lifecycle.js", () => ({
  getStatus: vi.fn(() => ({ running: false, pid: null })),
}));

vi.mock("../../shared/config.js", () => ({
  loadConfig: vi.fn(() => ({
    gateway: { host: "localhost", port: 7777 },
  })),
}));

vi.mock("../../shared/paths.js", () => ({
  JINN_HOME: "/home/user/.jinn",
  PID_FILE: "/home/user/.jinn/gateway.pid",
}));

import fs from "node:fs";
import { getStatus } from "../../gateway/lifecycle.js";
import { runStatus } from "../status.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockStatSync = vi.mocked(fs.statSync);
const mockGetStatus = vi.mocked(getStatus);

describe("runStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() - 60000 } as ReturnType<typeof fs.statSync>);
    mockGetStatus.mockReturnValue({ running: false, pid: null });
    // Reset global fetch mock
    vi.stubGlobal("fetch", undefined);
  });

  it("should output 'not set up' when JINN_HOME does not exist (AC-58)", async () => {
    mockExistsSync.mockReturnValue(false);
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStatus();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("not set up"));

    mockConsoleLog.mockRestore();
  });

  it("should output 'stopped' when gateway is not running and no stale PID (AC-59)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetStatus.mockReturnValue({ running: false, pid: null });
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStatus();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("stopped"));

    mockConsoleLog.mockRestore();
  });

  it("should output stale PID info when gateway is not running but stale PID exists (AC-60)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetStatus.mockReturnValue({ running: false, pid: 99999 });
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStatus();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    expect(allCalls.some((line) => line.includes("stopped"))).toBe(true);
    expect(allCalls.some((line) => line.includes("99999"))).toBe(true);

    mockConsoleLog.mockRestore();
  });

  it("should show PID without version when gateway is running but HTTP check fails (AC-61)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetStatus.mockReturnValue({ running: true, pid: 12345 });

    // fetch throws an error (HTTP not responding)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStatus();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    expect(allCalls.some((line) => line.includes("running"))).toBe(true);
    expect(allCalls.some((line) => line.includes("12345"))).toBe(true);
    // Port shown but no version info
    expect(allCalls.some((line) => line.includes("7777"))).toBe(true);

    mockConsoleLog.mockRestore();
  });

  it("should show PID and version when gateway is running and HTTP check succeeds (AC-62)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetStatus.mockReturnValue({ running: true, pid: 12345 });

    // fetch returns successful response with status data
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          sessions: { total: 5, active: 2, running: 1 },
          uptime: 3600,
        }),
      }),
    );

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStatus();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    expect(allCalls.some((line) => line.includes("running"))).toBe(true);
    expect(allCalls.some((line) => line.includes("12345"))).toBe(true);
    expect(allCalls.some((line) => line.includes("7777"))).toBe(true);
    // Session info shown
    expect(allCalls.some((line) => line.includes("sessions"))).toBe(true);

    mockConsoleLog.mockRestore();
  });

  it("should display sessions as non-object value (line 54 branch)", async () => {
    // Cover line 54: sessions is not an object (e.g. a number or string)
    mockExistsSync.mockReturnValue(true);
    mockGetStatus.mockReturnValue({ running: true, pid: 12345 });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          sessions: 42, // not an object → else branch at line 53
          uptime: 100,
        }),
      }),
    );

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStatus();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    // Line 54: console.log(`  Active sessions: ${data.sessions}`)
    expect(allCalls.some((line) => line.includes("42") || line.includes("Active sessions"))).toBe(true);

    mockConsoleLog.mockRestore();
  });
});
