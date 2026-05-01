import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks (vi.mock factories are hoisted — variables must be hoisted too) ──

const { fsMock, mockChild } = vi.hoisted(() => {
  const fsMock = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
  const mockChild = {
    pid: 9999,
    disconnect: vi.fn(),
    unref: vi.fn(),
  };
  return { fsMock, mockChild };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  JINN_HOME: "/fake/jinn",
  PID_FILE: "/fake/jinn/gateway.pid",
}));

vi.mock("../../shared/config.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  fork: vi.fn(() => mockChild),
}));

vi.mock("node:fs", () => ({
  default: fsMock,
}));

// gateway/server.js is NOT tested here
vi.mock("../server.js", () => ({
  startGateway: vi.fn().mockResolvedValue(vi.fn()),
}));

import { execSync, fork } from "node:child_process";
import { loadConfig } from "../../shared/config.js";
import { getStatus, startDaemon, startForeground, stop } from "../lifecycle.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakeExecSync = execSync as ReturnType<typeof vi.fn>;
const fakeFork = fork as ReturnType<typeof vi.fn>;
const fakeLoadConfig = loadConfig as ReturnType<typeof vi.fn>;

const originalKill = process.kill;
const originalPlatform = process.platform;

afterEach(() => {
  vi.clearAllMocks();
  process.kill = originalKill;
  Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
});

// ── stop() ───────────────────────────────────────────────────────────────────

describe("stop()", () => {
  describe("PID file exists and process is alive", () => {
    beforeEach(() => {
      fsMock.existsSync.mockImplementation((p: string) => p === "/fake/jinn/gateway.pid");
      fsMock.readFileSync.mockReturnValue("1234");
      process.kill = vi.fn() as unknown as typeof process.kill;
    });

    it("should send SIGTERM and return true", () => {
      const result = stop();
      expect(process.kill).toHaveBeenCalledWith(1234, "SIGTERM");
      expect(fsMock.unlinkSync).toHaveBeenCalledWith("/fake/jinn/gateway.pid");
      expect(result).toBe(true);
    });
  });

  describe("PID file exists but process is stale (ESRCH)", () => {
    beforeEach(() => {
      fsMock.existsSync.mockImplementation((p: string) => p === "/fake/jinn/gateway.pid");
      fsMock.readFileSync.mockReturnValue("5678");
      process.kill = vi.fn().mockImplementation(() => {
        const err = new Error("ESRCH") as NodeJS.ErrnoException;
        err.code = "ESRCH";
        throw err;
      }) as unknown as typeof process.kill;
    });

    it("should clean up stale PID file and fall through to port-based kill", () => {
      fakeExecSync.mockImplementation(() => {
        throw new Error("no process");
      });
      fakeLoadConfig.mockReturnValue({ gateway: { port: 7777 } });

      const result = stop();
      expect(fsMock.unlinkSync).toHaveBeenCalledWith("/fake/jinn/gateway.pid");
      expect(result).toBe(false);
    });
  });

  describe("PID file exists but kill throws non-ESRCH error", () => {
    beforeEach(() => {
      fsMock.existsSync.mockImplementation((p: string) => p === "/fake/jinn/gateway.pid");
      fsMock.readFileSync.mockReturnValue("9000");
      process.kill = vi.fn().mockImplementation(() => {
        const err = new Error("EPERM") as NodeJS.ErrnoException;
        err.code = "EPERM";
        throw err;
      }) as unknown as typeof process.kill;
    });

    it("should rethrow the error", () => {
      expect(() => stop()).toThrow("EPERM");
    });
  });

  describe("no PID file — port-based kill succeeds", () => {
    beforeEach(() => {
      fsMock.existsSync.mockReturnValue(false);
    });

    it("should kill process found on port and return true", () => {
      fakeExecSync.mockReturnValue("4321\n");
      process.kill = vi.fn() as unknown as typeof process.kill;
      fakeLoadConfig.mockReturnValue({ gateway: { port: 8080 } });

      const result = stop(8080);
      expect(process.kill).toHaveBeenCalledWith(4321, "SIGTERM");
      expect(result).toBe(true);
    });

    it("should return true when port process already gone (ESRCH)", () => {
      fakeExecSync.mockReturnValue("7777\n");
      process.kill = vi.fn().mockImplementation(() => {
        const err = new Error("ESRCH") as NodeJS.ErrnoException;
        err.code = "ESRCH";
        throw err;
      }) as unknown as typeof process.kill;
      fakeLoadConfig.mockReturnValue({ gateway: { port: 7777 } });

      const result = stop(7777);
      expect(result).toBe(true);
    });

    it("should rethrow non-ESRCH error from port-based kill", () => {
      fakeExecSync.mockReturnValue("7777\n");
      process.kill = vi.fn().mockImplementation(() => {
        const err = new Error("EPERM") as NodeJS.ErrnoException;
        err.code = "EPERM";
        throw err;
      }) as unknown as typeof process.kill;
      fakeLoadConfig.mockReturnValue({ gateway: { port: 7777 } });

      expect(() => stop(7777)).toThrow("EPERM");
    });

    it("should return false when nothing is listening on the port", () => {
      fakeExecSync.mockImplementation(() => {
        throw new Error("exit code 1");
      });
      fakeLoadConfig.mockReturnValue({ gateway: { port: 7777 } });

      const result = stop(7777);
      expect(result).toBe(false);
    });

    it("should use loadConfig to resolve default port when no port argument provided", () => {
      fakeExecSync.mockReturnValue("");
      fakeLoadConfig.mockReturnValue({ gateway: { port: 7000 } });

      const result = stop();
      expect(result).toBe(false);
    });

    it("should fall back to port 7777 when loadConfig throws", () => {
      fakeLoadConfig.mockImplementation(() => {
        throw new Error("no config");
      });
      fakeExecSync.mockImplementation(() => {
        throw new Error("nothing");
      });

      const result = stop();
      expect(result).toBe(false);
    });

    it("should fall back to port 7777 when config has no gateway.port", () => {
      fakeLoadConfig.mockReturnValue({});
      fakeExecSync.mockImplementation(() => {
        throw new Error("nothing");
      });

      const result = stop();
      expect(result).toBe(false);
    });
  });
});

// ── getStatus() ───────────────────────────────────────────────────────────────

describe("getStatus()", () => {
  beforeEach(() => {
    fakeLoadConfig.mockReturnValue({ gateway: { port: 7777 } });
  });

  describe("PID file exists and process is alive", () => {
    it("should return running=true with the PID from file", () => {
      fsMock.existsSync.mockImplementation((p: string) => p === "/fake/jinn/gateway.pid");
      fsMock.readFileSync.mockReturnValue("2222");
      process.kill = vi.fn() as unknown as typeof process.kill;

      const status = getStatus();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(2222);
    });
  });

  describe("PID file exists but process is dead — port has process", () => {
    it("should return running=true with the port PID", () => {
      fsMock.existsSync.mockImplementation((p: string) => p === "/fake/jinn/gateway.pid");
      fsMock.readFileSync.mockReturnValue("3333");
      process.kill = vi.fn().mockImplementation(() => {
        const err = new Error("ESRCH") as NodeJS.ErrnoException;
        err.code = "ESRCH";
        throw err;
      }) as unknown as typeof process.kill;

      fakeExecSync.mockReturnValue("4444\n");

      const status = getStatus();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(4444);
    });
  });

  describe("PID file exists but process is dead — port has nothing", () => {
    it("should return running=false", () => {
      fsMock.existsSync.mockImplementation((p: string) => p === "/fake/jinn/gateway.pid");
      fsMock.readFileSync.mockReturnValue("3333");
      process.kill = vi.fn().mockImplementation(() => {
        const err = new Error("ESRCH") as NodeJS.ErrnoException;
        err.code = "ESRCH";
        throw err;
      }) as unknown as typeof process.kill;

      fakeExecSync.mockImplementation(() => {
        throw new Error("nothing");
      });

      const status = getStatus();
      expect(status.running).toBe(false);
      expect(status.pid).toBe(3333);
    });
  });

  describe("no PID file — port has process", () => {
    it("should return running=true with port PID", () => {
      fsMock.existsSync.mockReturnValue(false);
      fakeExecSync.mockReturnValue("5555\n");

      const status = getStatus();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(5555);
    });
  });

  describe("no PID file — port has nothing", () => {
    it("should return running=false with null pid", () => {
      fsMock.existsSync.mockReturnValue(false);
      fakeExecSync.mockImplementation(() => {
        throw new Error("nothing");
      });

      const status = getStatus();
      expect(status.running).toBe(false);
      expect(status.pid).toBeNull();
    });
  });
});

// ── startDaemon() ─────────────────────────────────────────────────────────────

describe("startDaemon()", () => {
  it("should fork daemon-entry.js and write PID file when first candidate exists", () => {
    // First candidate exists
    fsMock.existsSync.mockImplementation(() => true);
    fsMock.mkdirSync.mockReturnValue(undefined);
    fsMock.writeFileSync.mockReturnValue(undefined);

    startDaemon({} as never);

    expect(fakeFork).toHaveBeenCalledWith(
      expect.stringContaining("daemon-entry.js"),
      [],
      expect.objectContaining({ detached: true, stdio: "ignore" }),
    );
    expect(fsMock.writeFileSync).toHaveBeenCalledWith("/fake/jinn/gateway.pid", "9999");
    expect(mockChild.disconnect).toHaveBeenCalled();
    expect(mockChild.unref).toHaveBeenCalled();
  });

  it("should fall back to first candidate when no candidates exist on disk", () => {
    // Neither candidate exists
    fsMock.existsSync.mockReturnValue(false);
    fsMock.mkdirSync.mockReturnValue(undefined);
    fsMock.writeFileSync.mockReturnValue(undefined);

    startDaemon({} as never);

    expect(fakeFork).toHaveBeenCalled();
  });

  it("should not write PID file when child.pid is falsy", () => {
    const childNoPid = { pid: undefined, disconnect: vi.fn(), unref: vi.fn() };
    fakeFork.mockReturnValueOnce(childNoPid);
    fsMock.existsSync.mockReturnValue(true);

    startDaemon({} as never);

    expect(fsMock.writeFileSync).not.toHaveBeenCalled();
    expect(childNoPid.disconnect).toHaveBeenCalled();
    expect(childNoPid.unref).toHaveBeenCalled();
  });
});

// ── startForeground() ─────────────────────────────────────────────────────────

describe("startForeground()", () => {
  it("should register SIGINT and SIGTERM listeners", async () => {
    const mockCleanup = vi.fn().mockResolvedValue(undefined);
    const { startGateway } = await import("../server.js");
    (startGateway as ReturnType<typeof vi.fn>).mockResolvedValue(mockCleanup);

    const onSpy = vi.spyOn(process, "on").mockImplementation(vi.fn() as never);

    await startForeground({} as never);

    expect(onSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));

    onSpy.mockRestore();
  });
});

// ── findPidOnPort() — win32 branch ────────────────────────────────────────────

describe("findPidOnPort() via stop() — win32 branch", () => {
  it("should parse netstat output on win32 and kill the process", () => {
    Object.defineProperty(process, "platform", { value: "win32", writable: true });
    fsMock.existsSync.mockReturnValue(false);

    // Simulate netstat output: "  TCP  0.0.0.0:7777  0.0.0.0:0  LISTENING  8888"
    fakeExecSync.mockReturnValue("  TCP  0.0.0.0:7777  0.0.0.0:0  LISTENING  8888");
    process.kill = vi.fn() as unknown as typeof process.kill;
    fakeLoadConfig.mockReturnValue({ gateway: { port: 7777 } });

    const result = stop(7777);
    expect(process.kill).toHaveBeenCalledWith(8888, "SIGTERM");
    expect(result).toBe(true);
  });

  it("should return null from findPidOnPort when netstat output is empty on win32", () => {
    Object.defineProperty(process, "platform", { value: "win32", writable: true });
    fsMock.existsSync.mockReturnValue(false);

    fakeExecSync.mockReturnValue("");
    fakeLoadConfig.mockReturnValue({ gateway: { port: 7777 } });

    const result = stop(7777);
    expect(result).toBe(false);
  });

  it("should use linux lsof command when platform is linux", () => {
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
    fsMock.existsSync.mockReturnValue(false);

    fakeExecSync.mockReturnValue("1111\n");
    process.kill = vi.fn() as unknown as typeof process.kill;
    fakeLoadConfig.mockReturnValue({ gateway: { port: 7777 } });

    const result = stop(7777);
    // Should have called execSync with the linux lsof command (without /usr/sbin/)
    expect(fakeExecSync).toHaveBeenCalledWith(expect.stringContaining("lsof"), expect.any(Object));
    expect(result).toBe(true);
  });
});
