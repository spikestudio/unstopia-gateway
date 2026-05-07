import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { fsMock, mockWatchers } = vi.hoisted(() => {
  const fsMock = {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    symlinkSync: vi.fn(),
    cpSync: vi.fn(),
  };
  const mockWatchers: Array<EventEmitter & { close: ReturnType<typeof vi.fn> }> = [];
  return { fsMock, mockWatchers };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("chokidar", () => ({
  watch: vi.fn(() => {
    const w = new EventEmitter() as EventEmitter & { close: ReturnType<typeof vi.fn> };
    w.close = vi.fn().mockResolvedValue(undefined);
    mockWatchers.push(w);
    return w;
  }),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  CONFIG_PATH: "/fake/config.yaml",
  CRON_JOBS: "/fake/cron/jobs.json",
  ORG_DIR: "/fake/org",
  SKILLS_DIR: "/fake/skills",
  CLAUDE_SKILLS_DIR: "/fake/.claude/skills",
  AGENTS_SKILLS_DIR: "/fake/.agents/skills",
}));

vi.mock("node:fs", () => ({
  default: fsMock,
}));

import { watch } from "chokidar";
import { startWatchers, stopWatchers, syncSkillSymlinks } from "../watcher.js";

const fakeWatch = watch as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCallbacks() {
  return {
    onConfigReload: vi.fn(),
    onCronReload: vi.fn(),
    onOrgChange: vi.fn(),
    onSkillsChange: vi.fn(),
  };
}

afterEach(() => {
  vi.clearAllMocks();
  mockWatchers.length = 0;
});

// ── syncSkillSymlinks() ───────────────────────────────────────────────────────

describe("syncSkillSymlinks()", () => {
  beforeEach(() => {
    fsMock.mkdirSync.mockReturnValue(undefined);
  });

  it("should create skills directory and return early when SKILLS_DIR does not exist", () => {
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readdirSync.mockReturnValue([]);

    syncSkillSymlinks();

    expect(fsMock.mkdirSync).toHaveBeenCalled();
  });

  it("should create symlinks for each skill directory", () => {
    fsMock.existsSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") return true;
      return false;
    });
    fsMock.readdirSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") {
        return [{ name: "my-skill", isDirectory: () => true }];
      }
      return [];
    });

    syncSkillSymlinks();

    expect(fsMock.symlinkSync).toHaveBeenCalledTimes(2); // once per targetDir
  });

  it("should remove stale symlinks not present in SKILLS_DIR", () => {
    fsMock.existsSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") return true;
      return false;
    });
    fsMock.readdirSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") return [];
      return [{ name: "stale-skill", isDirectory: () => false }];
    });

    syncSkillSymlinks();

    expect(fsMock.unlinkSync).toHaveBeenCalled();
  });

  it("should use cpSync when symlinkSync throws", () => {
    fsMock.existsSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") return true;
      return false;
    });
    fsMock.readdirSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") {
        return [{ name: "skill-a", isDirectory: () => true }];
      }
      return [];
    });
    fsMock.symlinkSync.mockImplementation(() => {
      throw new Error("symlink not supported");
    });

    syncSkillSymlinks();

    expect(fsMock.cpSync).toHaveBeenCalled();
  });

  it("should silently ignore when both symlinkSync and cpSync throw", () => {
    fsMock.existsSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") return true;
      return false;
    });
    fsMock.readdirSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") {
        return [{ name: "skill-b", isDirectory: () => true }];
      }
      return [];
    });
    fsMock.symlinkSync.mockImplementation(() => {
      throw new Error("symlink not supported");
    });
    fsMock.cpSync.mockImplementation(() => {
      throw new Error("copy failed");
    });

    expect(() => syncSkillSymlinks()).not.toThrow();
  });

  it("should silently ignore when unlinkSync throws for stale symlink", () => {
    fsMock.existsSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") return true;
      return false;
    });
    fsMock.readdirSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") return [];
      return [{ name: "stale", isDirectory: () => false }];
    });
    fsMock.unlinkSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    expect(() => syncSkillSymlinks()).not.toThrow();
  });

  it("should skip creating symlink when it already exists", () => {
    fsMock.existsSync.mockImplementation(() => true);
    fsMock.readdirSync.mockImplementation((p: string) => {
      if (p === "/fake/skills") {
        return [{ name: "existing-skill", isDirectory: () => true }];
      }
      return [{ name: "existing-skill", isDirectory: () => false }];
    });

    syncSkillSymlinks();

    expect(fsMock.symlinkSync).not.toHaveBeenCalled();
  });
});

// ── startWatchers() ───────────────────────────────────────────────────────────

describe("startWatchers()", () => {
  it("should set up watchers for config, cron, org, and skills", () => {
    const callbacks = makeCallbacks();
    startWatchers(callbacks);

    expect(fakeWatch).toHaveBeenCalledTimes(4);
    expect(fakeWatch).toHaveBeenCalledWith("/fake/config.yaml", expect.any(Object));
    expect(fakeWatch).toHaveBeenCalledWith("/fake/cron/jobs.json", expect.any(Object));
    expect(fakeWatch).toHaveBeenCalledWith("/fake/org", expect.any(Object));
    expect(fakeWatch).toHaveBeenCalledWith("/fake/skills", expect.any(Object));
  });

  it("should call onConfigReload when config watcher fires change event", () => {
    vi.useFakeTimers();
    const callbacks = makeCallbacks();
    startWatchers(callbacks);

    const configWatcher = mockWatchers[0];
    configWatcher.emit("change");

    vi.advanceTimersByTime(600);
    expect(callbacks.onConfigReload).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should call onCronReload when cron watcher fires change event", () => {
    vi.useFakeTimers();
    const callbacks = makeCallbacks();
    startWatchers(callbacks);

    const cronWatcher = mockWatchers[1];
    cronWatcher.emit("change");

    vi.advanceTimersByTime(600);
    expect(callbacks.onCronReload).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should call onOrgChange when org watcher fires any event", () => {
    vi.useFakeTimers();
    const callbacks = makeCallbacks();
    startWatchers(callbacks);

    const orgWatcher = mockWatchers[2];
    orgWatcher.emit("all");

    vi.advanceTimersByTime(600);
    expect(callbacks.onOrgChange).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should call onSkillsChange and syncSkillSymlinks when skills watcher fires any event", () => {
    vi.useFakeTimers();
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readdirSync.mockReturnValue([]);

    const callbacks = makeCallbacks();
    startWatchers(callbacks);

    const skillsWatcher = mockWatchers[3];
    skillsWatcher.emit("all");

    vi.advanceTimersByTime(600);
    expect(callbacks.onSkillsChange).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should debounce multiple rapid events into a single callback", () => {
    vi.useFakeTimers();
    const callbacks = makeCallbacks();
    startWatchers(callbacks);

    const configWatcher = mockWatchers[0];
    configWatcher.emit("change");
    configWatcher.emit("change");
    configWatcher.emit("change");

    vi.advanceTimersByTime(600);
    expect(callbacks.onConfigReload).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

// ── stopWatchers() ─────────────────────────────────────────────────────────────

describe("stopWatchers()", () => {
  it("should close all watchers and clear the list", async () => {
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readdirSync.mockReturnValue([]);

    const callbacks = makeCallbacks();
    startWatchers(callbacks);

    const createdWatchers = [...mockWatchers];
    await stopWatchers();

    for (const w of createdWatchers) {
      expect(w.close).toHaveBeenCalled();
    }
  });

  it("should be idempotent — calling stopWatchers twice does not throw", async () => {
    await stopWatchers();
    await expect(stopWatchers()).resolves.toBeUndefined();
  });
});
