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

vi.mock("node:readline", () => ({
  default: {
    createInterface: vi.fn(() => ({
      question: vi.fn((_q: string, cb: (answer: string) => void) => cb("atlas")),
      close: vi.fn(),
    })),
  },
  createInterface: vi.fn(() => ({
    question: vi.fn((_q: string, cb: (answer: string) => void) => cb("atlas")),
    close: vi.fn(),
  })),
}));

vi.mock("../instances.js", () => ({
  loadInstances: vi.fn(() => []),
  saveInstances: vi.fn(),
}));

import fs from "node:fs";
import readline from "node:readline";
import { loadInstances, saveInstances } from "../instances.js";
import { runNuke } from "../nuke.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockRmSync = vi.mocked(fs.rmSync);
const mockLoadInstances = vi.mocked(loadInstances);
const mockSaveInstances = vi.mocked(saveInstances);
const mockCreateInterface = vi.mocked(readline.createInterface);

const sampleInstance = {
  name: "atlas",
  port: 7778,
  home: "/home/user/.atlas",
  createdAt: "2024-01-01T00:00:00.000Z",
};

/** Helper to set up readline mock to return a specific answer */
function setReadlineAnswer(answer: string): void {
  mockCreateInterface.mockReturnValue({
    question: vi.fn((_q: string, cb: (answer: string) => void) => cb(answer)),
    close: vi.fn(),
  } as unknown as ReturnType<typeof readline.createInterface>);
}

describe("runNuke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockLoadInstances.mockReturnValue([sampleInstance]);
  });

  it("should print 'No instances to nuke' when there are no non-gateway instances (AC-47)", async () => {
    mockLoadInstances.mockReturnValue([
      { name: "gateway", port: 7777, home: "/home/user/.gateway", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runNuke("atlas");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("No removable instances found"));

    mockConsoleLog.mockRestore();
  });

  it("should exit with error when trying to nuke 'gateway' (AC-48)", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runNuke("gateway")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Cannot nuke the default "gateway" instance'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should skip deletion when home directory does not exist (AC-49)", async () => {
    // home dir does not exist, no PID file either
    mockExistsSync.mockReturnValue(false);
    // Provide correct confirmation
    setReadlineAnswer("atlas");
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runNuke("atlas");

    // saveInstances should be called to remove from registry
    expect(mockSaveInstances).toHaveBeenCalled();
    // rmSync should NOT be called since home dir does not exist
    expect(mockRmSync).not.toHaveBeenCalled();

    mockConsoleLog.mockRestore();
  });

  it("should call rmSync when correct confirmation is entered (AC-50)", async () => {
    // Home dir exists
    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path.endsWith("gateway.pid")) return false;
      if (path === sampleInstance.home) return true;
      return false;
    });
    setReadlineAnswer("atlas");
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runNuke("atlas");

    expect(mockSaveInstances).toHaveBeenCalled();
    expect(mockRmSync).toHaveBeenCalledWith(sampleInstance.home, { recursive: true, force: true });

    mockConsoleLog.mockRestore();
  });

  it("should abort when wrong confirmation is entered (AC-51)", async () => {
    setReadlineAnswer("wrong-name");
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runNuke("atlas");

    expect(mockSaveInstances).not.toHaveBeenCalled();
    expect(mockRmSync).not.toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Aborted"));

    mockConsoleLog.mockRestore();
  });

  it("should exit with error when named instance is not found", async () => {
    // Cover lines 58-61: index === -1 branch
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // sampleInstance is in loadInstances but we pass a different name
    await expect(runNuke("nonexistent")).rejects.toThrow("process.exit called");
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Instance "nonexistent" not found'));
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should select instance by number when no name provided and choice is numeric", async () => {
    // Cover lines 30-47: no name → show list → pick by number
    vi.spyOn(console, "log").mockImplementation(() => {});
    setReadlineAnswer("1"); // pick first instance by number
    // Second call to readline (confirmation): provide correct name
    let callCount = 0;
    mockCreateInterface.mockImplementation(
      () =>
        ({
          question: vi.fn((_q: string, cb: (answer: string) => void) => {
            callCount++;
            // First ask: pick "1" (number selection), second: confirmation
            cb(callCount === 1 ? "1" : "atlas");
          }),
          close: vi.fn(),
        }) as unknown as ReturnType<typeof readline.createInterface>,
    );

    await runNuke(); // no name → interactive

    expect(mockSaveInstances).toHaveBeenCalled();
  });

  it("should select instance by name string when choice is not numeric", async () => {
    // Cover line 46: name = choice (not a number)
    vi.spyOn(console, "log").mockImplementation(() => {});
    let callCount = 0;
    mockCreateInterface.mockImplementation(
      () =>
        ({
          question: vi.fn((_q: string, cb: (answer: string) => void) => {
            callCount++;
            // First ask: pick "atlas" by name, second: confirmation
            cb(callCount === 1 ? "atlas" : "atlas");
          }),
          close: vi.fn(),
        }) as unknown as ReturnType<typeof readline.createInterface>,
    );

    await runNuke(); // no name → interactive

    expect(mockSaveInstances).toHaveBeenCalled();
  });

  it("should stop running instance when PID file exists and process is alive", async () => {
    // Cover lines 69-79: PID file exists, process.kill succeeds
    vi.spyOn(console, "log").mockImplementation(() => {});
    const mockKill = vi.spyOn(process, "kill").mockImplementation(() => true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("12345" as never);
    mockExistsSync.mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith("gateway.pid")) return true; // PID file exists
      return false;
    });
    setReadlineAnswer("atlas");

    await runNuke("atlas");

    // process.kill called twice: once with 0 (check), once with SIGTERM
    expect(mockKill).toHaveBeenCalledWith(12345, 0);
    expect(mockKill).toHaveBeenCalledWith(12345, "SIGTERM");
    mockKill.mockRestore();
  });

  it("should continue silently when PID process is not alive (kill throws)", async () => {
    // Cover lines 77-79: catch block — process not alive
    vi.spyOn(console, "log").mockImplementation(() => {});
    const mockKill = vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("no such process");
    });
    vi.spyOn(fs, "readFileSync").mockReturnValue("99999" as never);
    mockExistsSync.mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith("gateway.pid")) return true;
      return false;
    });
    setReadlineAnswer("atlas");

    // Should not throw — catch block handles it
    await runNuke("atlas");

    expect(mockSaveInstances).toHaveBeenCalled();
    mockKill.mockRestore();
  });

  it("should use USERPROFILE when HOME is not set in instance list display (line 34 branch)", async () => {
    const origHome = process.env.HOME;
    const origUserProfile = process.env.USERPROFILE;

    delete process.env.HOME;
    process.env.USERPROFILE = "/home/winuser";

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockLoadInstances.mockReturnValue([
      { name: "atlas", port: 7778, home: "/home/winuser/.atlas", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    setReadlineAnswer("atlas");

    await runNuke("atlas");

    expect(mockSaveInstances).toHaveBeenCalled();

    if (origHome !== undefined) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
    else delete process.env.USERPROFILE;
  });

  it("should fall back to empty string when neither HOME nor USERPROFILE is set (line 34/64 last branch)", async () => {
    const origHome = process.env.HOME;
    const origUserProfile = process.env.USERPROFILE;

    delete process.env.HOME;
    delete process.env.USERPROFILE;

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockLoadInstances.mockReturnValue([
      { name: "atlas", port: 7778, home: "/some/path/.atlas", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    setReadlineAnswer("atlas");

    await runNuke("atlas");

    expect(mockSaveInstances).toHaveBeenCalled();

    if (origHome !== undefined) process.env.HOME = origHome;
    if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
  });
});
