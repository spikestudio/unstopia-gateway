import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(),
    },
  };
});

vi.mock("node:path", async () => {
  const actual = await vi.importActual<typeof import("node:path")>("node:path");
  return { ...actual, default: actual };
});

vi.mock("../instances.js", () => ({
  ensureDefaultInstance: vi.fn(),
  loadInstances: vi.fn(() => []),
}));

import fs from "node:fs";
import { ensureDefaultInstance, loadInstances } from "../instances.js";
import { runList } from "../list.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockLoadInstances = vi.mocked(loadInstances);
const mockEnsureDefaultInstance = vi.mocked(ensureDefaultInstance);

describe("runList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockLoadInstances.mockReturnValue([]);
  });

  it("should print 'No instances found' when there are 0 instances (AC-38)", async () => {
    mockLoadInstances.mockReturnValue([]);
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runList();

    expect(mockEnsureDefaultInstance).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("No instances found"));

    mockConsoleLog.mockRestore();
  });

  it("should show '(stopped)' when no PID file exists for the instance (AC-39)", async () => {
    mockLoadInstances.mockReturnValue([
      { name: "atlas", port: 7778, home: "/home/user/.atlas", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    // No PID file
    mockExistsSync.mockReturnValue(false);

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runList();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    const instanceRow = allCalls.find((line) => line.includes("atlas"));
    expect(instanceRow).toBeDefined();
    expect(instanceRow).toContain("stopped");

    mockConsoleLog.mockRestore();
  });

  it("should show 'running' when PID file exists and process is alive (AC-40)", async () => {
    mockLoadInstances.mockReturnValue([
      { name: "atlas", port: 7778, home: "/home/user/.atlas", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    // PID file exists — use current process PID so kill(pid, 0) succeeds
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(`${process.pid}\n` as unknown as ReturnType<typeof fs.readFileSync>);

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runList();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    const instanceRow = allCalls.find((line) => line.includes("atlas"));
    expect(instanceRow).toBeDefined();
    expect(instanceRow).toContain("running");

    mockConsoleLog.mockRestore();
  });

  it("should show '(stopped)' when PID file exists but process is not alive (stale PID) (AC-41)", async () => {
    mockLoadInstances.mockReturnValue([
      { name: "atlas", port: 7778, home: "/home/user/.atlas", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    // PID file exists
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("99999\n" as unknown as ReturnType<typeof fs.readFileSync>);

    // process.kill throws ESRCH (stale PID)
    const mockProcessKill = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    });

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runList();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    const instanceRow = allCalls.find((line) => line.includes("atlas"));
    expect(instanceRow).toBeDefined();
    expect(instanceRow).toContain("stopped");

    mockProcessKill.mockRestore();
    mockConsoleLog.mockRestore();
  });

  it("should use USERPROFILE when HOME is not set (line 38 branch)", async () => {
    const origHome = process.env.HOME;
    const origUserProfile = process.env.USERPROFILE;

    delete process.env.HOME;
    process.env.USERPROFILE = "/home/winuser";

    mockLoadInstances.mockReturnValue([
      { name: "win-inst", port: 7779, home: "/home/winuser/.jinn", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    mockExistsSync.mockReturnValue(false);

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runList();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    const instanceRow = allCalls.find((line) => line.includes("win-inst"));
    expect(instanceRow).toBeDefined();
    // home should be replaced with "~"
    expect(instanceRow).toContain("~");

    mockConsoleLog.mockRestore();
    if (origHome !== undefined) process.env.HOME = origHome;
    if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
    else delete process.env.USERPROFILE;
  });

  it("should use empty string as home replacement when neither HOME nor USERPROFILE is set (line 38 last branch)", async () => {
    const origHome = process.env.HOME;
    const origUserProfile = process.env.USERPROFILE;

    delete process.env.HOME;
    delete process.env.USERPROFILE;

    mockLoadInstances.mockReturnValue([
      { name: "nohome-inst", port: 7780, home: "/some/path/.jinn", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    mockExistsSync.mockReturnValue(false);

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runList();

    const allCalls = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    const instanceRow = allCalls.find((line) => line.includes("nohome-inst"));
    expect(instanceRow).toBeDefined();

    mockConsoleLog.mockRestore();
    if (origHome !== undefined) process.env.HOME = origHome;
    if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
  });
});
