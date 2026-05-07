import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    },
  };
});

vi.mock("node:os", () => ({
  default: {
    homedir: vi.fn(() => "/home/user"),
  },
}));

vi.mock("node:path", async () => {
  const actual = await vi.importActual<typeof import("node:path")>("node:path");
  return { ...actual, default: actual };
});

vi.mock("../instances.js", () => ({
  loadInstances: vi.fn(() => []),
  saveInstances: vi.fn(),
  nextAvailablePort: vi.fn(() => 7778),
}));

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { runCreate } from "../create.js";
import { loadInstances, nextAvailablePort, saveInstances } from "../instances.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockLoadInstances = vi.mocked(loadInstances);
const mockSaveInstances = vi.mocked(saveInstances);
const mockNextAvailablePort = vi.mocked(nextAvailablePort);

describe("runCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockLoadInstances.mockReturnValue([]);
    mockNextAvailablePort.mockReturnValue(7778);
  });

  it("should exit with error when name contains invalid characters (AC-33)", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCreate("jinn!")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Instance name must be"));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should exit with error when name starts with a number (AC-33)", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCreate("1invalid")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Instance name must be"));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should exit with error when name is 'jinn' (AC-34)", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCreate("jinn")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"jinn" is the default instance'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should exit with error when instance name already exists (AC-35)", async () => {
    mockLoadInstances.mockReturnValue([
      { name: "atlas", port: 7778, home: "/home/user/.atlas", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCreate("atlas")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Instance "atlas" already exists'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should exit with error when home directory already exists (AC-36)", async () => {
    // existsSync returns true for the home directory check
    mockExistsSync.mockImplementation((p) => {
      return String(p).endsWith(".atlas");
    });

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCreate("atlas")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("already exists"));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should call execFileSync and save instance on valid name (AC-37)", async () => {
    // home dir does not exist, config.yaml does not exist either
    mockExistsSync.mockReturnValue(false);
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCreate("atlas");

    expect(mockExecFileSync).toHaveBeenCalledWith(
      process.execPath,
      [process.argv[1], "setup"],
      expect.objectContaining({
        env: expect.objectContaining({ JINN_HOME: expect.stringContaining(".atlas"), JINN_INSTANCE: "atlas" }),
        stdio: "inherit",
      }),
    );
    expect(mockSaveInstances).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "atlas", port: 7778 })]),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Instance "atlas" created successfully'));

    mockConsoleLog.mockRestore();
  });

  it("should patch config.yaml port when it exists after setup (AC-37)", async () => {
    // existsSync returns true only for config.yaml
    mockExistsSync.mockImplementation((p) => {
      return String(p).endsWith("config.yaml");
    });
    mockReadFileSync.mockReturnValue("port: 7777\nportal: {}\n" as unknown as ReturnType<typeof fs.readFileSync>);
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCreate("atlas");

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("config.yaml"),
      expect.stringContaining("port: 7778"),
    );

    mockConsoleLog.mockRestore();
  });

  it("should log error and exit(1) when execFileSync throws (lines 51-52 catch branch)", async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("setup failed");
    });

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit(1)");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCreate("atlas")).rejects.toThrow("process.exit(1)");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Failed to run setup"));

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });
});
