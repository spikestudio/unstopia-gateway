import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(),
      rmSync: vi.fn(),
    },
  };
});

vi.mock("../instances.js", () => ({
  loadInstances: vi.fn(() => []),
  saveInstances: vi.fn(),
}));

import fs from "node:fs";
import { loadInstances, saveInstances } from "../instances.js";
import { runRemove } from "../remove.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockRmSync = vi.mocked(fs.rmSync);
const mockLoadInstances = vi.mocked(loadInstances);
const mockSaveInstances = vi.mocked(saveInstances);

const sampleInstance = {
  name: "atlas",
  port: 7778,
  home: "/home/user/.atlas",
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("runRemove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockLoadInstances.mockReturnValue([sampleInstance]);
  });

  it("should exit with error when trying to remove 'jinn' (AC-42)", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runRemove("jinn", {})).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Cannot remove the default "jinn" instance'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should exit with error when instance is not found (AC-43)", async () => {
    mockLoadInstances.mockReturnValue([]);

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runRemove("atlas", {})).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Instance "atlas" not found'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should exit with error when instance is running and --force is not provided (AC-44)", async () => {
    // PID file exists; use current PID so process.kill(pid, 0) succeeds (alive)
    mockExistsSync.mockImplementation((p) => {
      return String(p).endsWith("gateway.pid");
    });
    mockReadFileSync.mockReturnValue(`${process.pid}\n` as unknown as ReturnType<typeof fs.readFileSync>);

    // NOTE: process.exit inside a try...catch block in remove.ts means throwing from the spy
    // would be caught by the catch block. Instead we record the call and return normally.
    const exitCalls: number[] = [];
    const mockExit = vi.spyOn(process, "exit").mockImplementation((code?: number | string | null) => {
      exitCalls.push(typeof code === "number" ? code : 1);
      return undefined as never;
    });
    const consoleCalls: string[] = [];
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args.join(" "));
    });
    // Suppress console.log from the removal path
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runRemove("atlas", {});

    expect(consoleCalls.some((s) => s.includes("is still running"))).toBe(true);
    expect(exitCalls).toContain(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
  });

  it("should remove stopped instance from registry successfully (AC-45)", async () => {
    // No PID file
    mockExistsSync.mockReturnValue(false);
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runRemove("atlas", {});

    expect(mockSaveInstances).toHaveBeenCalledWith([]);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Instance "atlas" removed from registry'));

    mockConsoleLog.mockRestore();
  });

  it("should remove running instance with --force and delete home directory (AC-46)", async () => {
    // PID file exists with stale PID so instance passes the running check
    // then --force removes the home dir
    // We simulate: PID file exists but process is NOT alive (stale) so remove proceeds
    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path.endsWith("gateway.pid")) return true;
      // home dir also exists for force-delete check
      if (path === sampleInstance.home) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue("99999\n" as unknown as ReturnType<typeof fs.readFileSync>);

    // process.kill throws ESRCH so the running check passes (process is dead)
    const mockProcessKill = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    });
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runRemove("atlas", { force: true });

    expect(mockSaveInstances).toHaveBeenCalledWith([]);
    expect(mockRmSync).toHaveBeenCalledWith(sampleInstance.home, { recursive: true, force: true });
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Instance "atlas" removed'));

    mockProcessKill.mockRestore();
    mockConsoleLog.mockRestore();
  });
});
