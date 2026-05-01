import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => true),
    },
  };
});

vi.mock("../../gateway/lifecycle.js", () => ({
  startDaemon: vi.fn(),
  startForeground: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../shared/config.js", () => ({
  loadConfig: vi.fn(() => ({
    gateway: { host: "localhost", port: 7777 },
  })),
}));

vi.mock("../../shared/paths.js", () => ({
  JINN_HOME: "/home/user/.jinn",
}));

vi.mock("../../shared/version.js", () => ({
  getInstanceVersion: vi.fn(() => "1.0.0"),
  getPackageVersion: vi.fn(() => "1.0.0"),
  compareSemver: vi.fn(() => 0),
}));

import fs from "node:fs";
import { startDaemon, startForeground } from "../../gateway/lifecycle.js";
import { compareSemver, getInstanceVersion, getPackageVersion } from "../../shared/version.js";
import { runStart } from "../start.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockStartDaemon = vi.mocked(startDaemon);
const mockStartForeground = vi.mocked(startForeground);
const mockCompareSemver = vi.mocked(compareSemver);
const mockGetInstanceVersion = vi.mocked(getInstanceVersion);
const mockGetPackageVersion = vi.mocked(getPackageVersion);

describe("runStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockCompareSemver.mockReturnValue(0);
    mockGetInstanceVersion.mockReturnValue("1.0.0");
    mockGetPackageVersion.mockReturnValue("1.0.0");
  });

  it("should call process.exit when JINN_HOME does not exist (AC-52)", async () => {
    mockExistsSync.mockReturnValue(false);

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runStart({})).rejects.toThrow("process.exit called");

    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should log migration warning when instance version is older than package version (AC-53)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetInstanceVersion.mockReturnValue("0.9.0");
    mockGetPackageVersion.mockReturnValue("1.0.0");
    // compareSemver returns negative when instance < package
    mockCompareSemver.mockReturnValue(-1);

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStart({});

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("migrate"));

    mockConsoleLog.mockRestore();
  });

  it("should call startDaemon (via lifecycle) when --daemon flag is set (AC-54)", async () => {
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStart({ daemon: true });

    expect(mockStartDaemon).toHaveBeenCalled();
    expect(mockStartForeground).not.toHaveBeenCalled();

    mockConsoleLog.mockRestore();
  });

  it("should call startForeground when no --daemon flag (AC-55)", async () => {
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStart({});

    expect(mockStartForeground).toHaveBeenCalled();
    expect(mockStartDaemon).not.toHaveBeenCalled();

    mockConsoleLog.mockRestore();
  });

  it("should override config port when --port flag is provided (line 30 branch)", async () => {
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const { loadConfig } = await import("../../shared/config.js");
    const mockConfig = { gateway: { host: "localhost", port: 7777 } };
    vi.mocked(loadConfig).mockReturnValue(mockConfig as never);

    await runStart({ port: 8080 });

    // The config.gateway.port should have been overridden to 8080
    expect(mockConfig.gateway.port).toBe(8080);

    mockConsoleLog.mockRestore();
  });
});
