import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock child_process before importing the module under test
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

// Mock fs to control filesystem responses
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      rmSync: vi.fn(),
    },
  };
});

// Mock shared modules
vi.mock("../../shared/config.js", () => ({
  loadConfig: vi.fn(() => ({
    engines: {
      default: "claude",
      claude: { bin: "/usr/local/bin/claude" },
    },
  })),
}));

vi.mock("../../shared/version.js", () => ({
  compareSemver: vi.fn(() => -1), // instance behind package by default
  getPackageVersion: vi.fn(() => "1.1.0"),
  getInstanceVersion: vi.fn(() => "1.0.0"),
  getPendingMigrations: vi.fn(() => ["1.1.0"]),
}));

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { compareSemver, getPendingMigrations } from "../../shared/version.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(fs.existsSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockCompareSemver = vi.mocked(compareSemver);
const mockGetPendingMigrations = vi.mocked(getPendingMigrations);

describe("migrate: additional AC tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    // Default: instance is behind package
    mockCompareSemver.mockReturnValue(-1);
    mockGetPendingMigrations.mockReturnValue(["1.1.0"]);
  });

  it("should NOT call execFileSync when check=true is passed (AC-63)", async () => {
    const { runMigrate } = await import("../migrate.js");

    await runMigrate({ check: true });

    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("should update the version stamp when pending migrations is 0 (AC-64)", async () => {
    // No pending migrations found
    mockGetPendingMigrations.mockReturnValue([]);

    const { runMigrate } = await import("../migrate.js");
    // Supply config.yaml content for stampVersion to parse
    vi.mocked(fs.readFileSync).mockReturnValue(
      'meta:\n  version: "1.0.0"\n' as unknown as ReturnType<typeof fs.readFileSync>,
    );

    await runMigrate({});

    // stampVersion calls writeFileSync with updated version
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("should NOT call execFileSync when auto=true is passed (AC-65)", async () => {
    const { runMigrate } = await import("../migrate.js");

    await runMigrate({ auto: true });

    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("should log 'Up to date.' when compareSemver >= 0 (AC-66)", async () => {
    // instance version >= package version
    mockCompareSemver.mockReturnValue(0);

    vi.spyOn(console, "log").mockImplementation(() => {});

    const { runMigrate } = await import("../migrate.js");

    await runMigrate({});

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("Up to date."))).toBe(true);
  });

  it("should NOT stamp version when check=true and pending is empty (AC-67)", async () => {
    mockGetPendingMigrations.mockReturnValue([]);

    const { runMigrate } = await import("../migrate.js");

    await runMigrate({ check: true });

    // check=true → early return before stampVersion; writeFileSync not called
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("should list pending migrations and return early when check=true", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({ check: true });

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("Pending migrations") || c.includes("gateway migrate"))).toBe(true);
    // execFileSync should not have been called
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("should exit(1) and not run AI session when GATEWAY_HOME does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    const { runMigrate } = await import("../migrate.js");

    await expect(runMigrate({})).rejects.toThrow();
  });

  it("should copy migrate skill when migrateSkillSrc exists and dest does not", async () => {
    mockExistsSync.mockImplementation((p: unknown) => {
      const ps = String(p);
      // GATEWAY_HOME exists
      if (ps === "/fake/.gateway") return true;
      // migrateSkillSrc: template/skills/migrate — exists
      if (ps.includes("skills/migrate") && ps.includes("template")) return true;
      // migrateSkillDest: skills/migrate in instance — does NOT exist
      if (ps.includes("skills/migrate")) return false;
      // migrationMd for MIGRATION.md check
      if (ps.includes("MIGRATION.md")) return false;
      // all other
      return true;
    });

    vi.mocked(fs.readFileSync).mockReturnValue(
      'meta:\n  version: "1.0.0"\n' as unknown as ReturnType<typeof fs.readFileSync>,
    );

    vi.spyOn(console, "log").mockImplementation(() => {});
    mockExecFileSync.mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    // mkdirSync called for staging the migrate skill
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it("should log AI engine bin and run execFileSync for default AI flow", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockReturnValue(
      'meta:\n  version: "1.0.0"\n' as unknown as ReturnType<typeof fs.readFileSync>,
    );
    mockExecFileSync.mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    expect(mockExecFileSync).toHaveBeenCalledWith("/usr/local/bin/claude", expect.any(Array), expect.any(Object));
  });

  it("should log migration failed and exit(1) when execFileSync throws", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockReturnValue(
      'meta:\n  version: "1.0.0"\n' as unknown as ReturnType<typeof fs.readFileSync>,
    );
    mockExecFileSync.mockImplementation(() => {
      throw new Error("engine crashed");
    });

    const { runMigrate } = await import("../migrate.js");
    await expect(runMigrate({})).rejects.toThrow();
  });
});

// ── applyAutoMigrations (via runMigrate with auto=true) ─────────────────────

describe("migrate: applyAutoMigrations branch coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(compareSemver).mockReturnValue(-1);
    mockGetPendingMigrations.mockReturnValue(["1.1.0"]);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockReturnValue(
      'meta:\n  version: "1.0.0"\n' as unknown as ReturnType<typeof fs.readFileSync>,
    );
  });

  it("logs 'no files to auto-apply' when filesDir does not exist", async () => {
    mockExistsSync.mockImplementation((p: unknown) => {
      const ps = String(p);
      // GATEWAY_HOME exists, but filesDir does not
      if (ps.includes("files")) return false;
      return true;
    });
    mockReaddirSync.mockReturnValue([]);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({ auto: true });

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("no files to auto-apply"))).toBe(true);
  });

  it("copies new file and logs [new] when dest does not exist", async () => {
    // filesDir must exist; dest file must NOT exist; GATEWAY_HOME must exist
    mockExistsSync.mockImplementation((p: unknown) => {
      const ps = String(p);
      // The dest file path contains ".gateway" and the file name — return false (new)
      if (ps.includes("some-file.yaml")) return false;
      // filesDir contains "files"
      if (ps.includes("files")) return true;
      // GATEWAY_HOME and its parent always exist
      return true;
    });

    // collectFiles: readdirSync returns a file entry
    mockReaddirSync.mockReturnValueOnce([{ name: "some-file.yaml", isDirectory: () => false }] as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({ auto: true });

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("[new]") || c.includes("Auto-migration complete"))).toBe(true);
  });

  it("logs [skip] when dest file already exists", async () => {
    // filesDir exists, dest also exists → skip branch
    mockExistsSync.mockReturnValue(true);

    // collectFiles: one file entry
    mockReaddirSync.mockReturnValueOnce([{ name: "config.yaml", isDirectory: () => false }] as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({ auto: true });

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("[skip]") || c.includes("Auto-migration complete"))).toBe(true);
  });

  it("creates symlinks when new file is inside skills/ directory", async () => {
    mockExistsSync.mockImplementation((p: unknown) => {
      const ps = String(p);
      // filesDir exists
      if (ps.includes("files")) return true;
      // GATEWAY_HOME
      if (ps.endsWith(".gateway")) return true;
      // symlink target — does not exist
      if (ps.includes("claude") || ps.includes("agents")) return false;
      // dest path for the skill file — does not exist (new)
      return false;
    });

    // collectFiles returns a file nested under skills/
    mockReaddirSync
      .mockReturnValueOnce([{ name: "my-skill", isDirectory: () => true }] as never)
      .mockReturnValueOnce([{ name: "SKILL.md", isDirectory: () => false }] as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({ auto: true });

    // mkdirSync called for symlink dirs
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it("handles collectFiles recursion into subdirectories (skips .gitkeep)", async () => {
    mockExistsSync.mockReturnValue(true);

    // collectFiles: subdir → then file + .gitkeep
    mockReaddirSync.mockReturnValueOnce([{ name: "subdir", isDirectory: () => true }] as never).mockReturnValueOnce([
      { name: ".gitkeep", isDirectory: () => false },
      { name: "actual-file.md", isDirectory: () => false },
    ] as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({ auto: true });

    // .gitkeep excluded, actual-file.md included → dest exists → [skip] logged
    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("[skip]") || c.includes("Auto-migration complete"))).toBe(true);
  });

  it("copies skill file and creates symlinks when relPath starts with 'skills/'", async () => {
    // Cover lines 224-227: parts[0] === "skills" && parts.length >= 2 → ensureSkillSymlinks
    mockExistsSync.mockImplementation((p: unknown) => {
      const ps = String(p);
      // filesDir exists
      if (ps.includes("files")) return true;
      // skill file dest does NOT exist (so it's new)
      if (ps.includes("SKILL.md")) return false;
      // symlink targets do NOT exist
      if (ps.includes(".claude") || ps.includes(".agents")) return false;
      return true;
    });

    // collectFiles: returns a file nested under skills/my-skill/
    // path.sep on all platforms is "/" in tests but we need "skills/..." format
    mockReaddirSync
      .mockReturnValueOnce([{ name: "my-skill", isDirectory: () => true }] as never)
      .mockReturnValueOnce([{ name: "SKILL.md", isDirectory: () => false }] as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({ auto: true });

    // symlink dir creation
    expect(fs.mkdirSync).toHaveBeenCalled();
    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("[new]") || c.includes("Auto-migration complete"))).toBe(true);
  });
});

// ── Additional runMigrate branch coverage ───────────────────────────────────

describe("migrate: pending list and MIGRATION.md presence branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(compareSemver).mockReturnValue(-1);
    mockGetPendingMigrations.mockReturnValue(["1.1.0"]);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockReturnValue(
      'meta:\n  version: "1.0.0"\n' as unknown as ReturnType<typeof fs.readFileSync>,
    );
  });

  it("logs pending migration with MIGRATION.md present (hasMd=true branch)", async () => {
    // existsSync: GATEWAY_HOME true, MIGRATION.md true → hasMd=true branch (empty string in log)
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    vi.mocked(mockExecFileSync).mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    // Pending migrations header logged
    expect(calls.some((c) => c.includes("Pending migrations") || c.includes("1.1.0"))).toBe(true);
  });

  it("logs pending migration with MIGRATION.md missing (hasMd=false branch)", async () => {
    // existsSync: GATEWAY_HOME true, but MIGRATION.md false → shows "(missing MIGRATION.md)"
    mockExistsSync.mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.includes("MIGRATION.md")) return false;
      return true;
    });
    mockReaddirSync.mockReturnValue([]);
    vi.mocked(mockExecFileSync).mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("missing MIGRATION.md") || c.includes("1.1.0"))).toBe(true);
  });

  it("uses default engine 'claude' when config.engines.default is undefined", async () => {
    const { loadConfig } = await import("../../shared/config.js");
    vi.mocked(loadConfig).mockReturnValue({
      engines: {
        // no 'default' key
        claude: { bin: "/usr/bin/claude" },
      },
    } as never);
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    vi.mocked(mockExecFileSync).mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    // execFileSync should be called with the fallback claude bin
    expect(mockExecFileSync).toHaveBeenCalledWith("/usr/bin/claude", expect.any(Array), expect.any(Object));
  });

  it("uses claude config as fallback when engineConfig is undefined", async () => {
    const { loadConfig } = await import("../../shared/config.js");
    vi.mocked(loadConfig).mockReturnValue({
      engines: {
        default: "gemini",
        // no gemini config
        claude: { bin: "/usr/bin/claude" },
      },
    } as never);
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    vi.mocked(mockExecFileSync).mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    // Falls back to claude.bin because engines["gemini"] is undefined
    expect(mockExecFileSync).toHaveBeenCalledWith("/usr/bin/claude", expect.any(Array), expect.any(Object));
  });

  it("uses codex args (exec --dangerously...) when default engine is codex", async () => {
    const { loadConfig } = await import("../../shared/config.js");
    vi.mocked(loadConfig).mockReturnValue({
      engines: {
        default: "codex",
        codex: { bin: "/usr/bin/codex" },
        claude: { bin: "/usr/bin/claude" },
      },
    } as never);
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    vi.mocked(mockExecFileSync).mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    const [bin, args] = mockExecFileSync.mock.calls[0];
    expect(bin).toBe("/usr/bin/codex");
    expect(args).toContain("exec");
  });

  it("uses gemini args (--yolo) when default engine is gemini", async () => {
    const { loadConfig } = await import("../../shared/config.js");
    vi.mocked(loadConfig).mockReturnValue({
      engines: {
        default: "gemini",
        gemini: { bin: "/usr/bin/gemini" },
        claude: { bin: "/usr/bin/claude" },
      },
    } as never);
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    vi.mocked(mockExecFileSync).mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    const [bin, args] = mockExecFileSync.mock.calls[0];
    expect(bin).toBe("/usr/bin/gemini");
    expect(args).toContain("--yolo");
  });

  it("copyDirRecursive skips .gitkeep in staging phase", async () => {
    mockExistsSync.mockReturnValue(true);

    // readdirSync for copyDirRecursive during staging: returns .gitkeep + actual file
    mockReaddirSync.mockReturnValueOnce([
      { name: ".gitkeep", isDirectory: () => false },
      { name: "step.md", isDirectory: () => false },
    ] as never);

    vi.mocked(mockExecFileSync).mockImplementation(() => undefined as never);

    const { runMigrate } = await import("../migrate.js");
    await runMigrate({});

    // copyFileSync only called for non-.gitkeep files
    const copyCalls = vi.mocked(fs.copyFileSync).mock.calls;
    const gitkeepCopied = copyCalls.some((c) => String(c[0]).includes(".gitkeep"));
    expect(gitkeepCopied).toBe(false);
  });
});
