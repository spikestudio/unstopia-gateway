import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      rmSync: vi.fn(),
    },
  };
});

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0 })),
}));

vi.mock("node:os", () => ({
  default: {
    homedir: vi.fn(() => "/home/user"),
  },
}));

vi.mock("../../shared/paths.js", () => ({
  GATEWAY_HOME: "/home/user/.gateway",
  SKILLS_DIR: "/home/user/.gateway/skills",
}));

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import {
  copySkillToInstance,
  diffSnapshots,
  findExistingSkill,
  skillsAdd,
  skillsFind,
  skillsRestore,
  skillsUpdate,
  snapshotDirs,
} from "../skills.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);
const mockSpawnSync = vi.mocked(spawnSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

// ── snapshotDirs ──────────────────────────────────────────────────────────────

describe("snapshotDirs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty sets for directories that do not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const snap = snapshotDirs();
    for (const set of snap.values()) {
      expect(set.size).toBe(0);
    }
  });

  it("includes subdirectory names for existing directories", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "skill-a", isDirectory: () => true },
      { name: "file.txt", isDirectory: () => false },
    ] as never);

    const snap = snapshotDirs();
    for (const set of snap.values()) {
      // directories only — file.txt excluded
      if (set.size > 0) {
        expect(set.has("skill-a")).toBe(true);
        expect(set.has("file.txt")).toBe(false);
      }
    }
  });
});

// ── diffSnapshots ─────────────────────────────────────────────────────────────

describe("diffSnapshots", () => {
  it("returns empty array when nothing changed", () => {
    const before = new Map([["dir1", new Set(["skill-a"])]]);
    const after = new Map([["dir1", new Set(["skill-a"])]]);
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("detects newly added skill directories", () => {
    const before = new Map([["dir1", new Set<string>()]]);
    const after = new Map([["dir1", new Set(["skill-new"])]]);
    const result = diffSnapshots(before, after);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ dir: "dir1", name: "skill-new" });
  });

  it("handles missing beforeSet by treating it as empty", () => {
    const before = new Map<string, Set<string>>();
    const after = new Map([["dir1", new Set(["skill-x"])]]);
    const result = diffSnapshots(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("skill-x");
  });

  it("returns multiple entries when several dirs added", () => {
    const before = new Map([
      ["dir1", new Set<string>()],
      ["dir2", new Set<string>()],
    ]);
    const after = new Map([
      ["dir1", new Set(["s1"])],
      ["dir2", new Set(["s2"])],
    ]);
    const result = diffSnapshots(before, after);
    expect(result).toHaveLength(2);
  });
});

// ── findExistingSkill ─────────────────────────────────────────────────────────

describe("findExistingSkill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when skill does not exist in any global dir", () => {
    mockExistsSync.mockReturnValue(false);
    expect(findExistingSkill("nonexistent")).toBeNull();
  });

  it("returns skill info when found in a global dir", () => {
    // First call returns false, second returns true (found in second dir)
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const result = findExistingSkill("my-skill");
    expect(result).not.toBeNull();
    expect(result?.name).toBe("my-skill");
    expect(result?.dir).toContain("my-skill");
  });

  it("returns the first match when skill found in first global dir", () => {
    mockExistsSync.mockReturnValue(true);
    const result = findExistingSkill("my-skill");
    expect(result).not.toBeNull();
  });
});

// ── copySkillToInstance ───────────────────────────────────────────────────────

describe("copySkillToInstance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates destination directory and copies files recursively", () => {
    mockReaddirSync.mockReturnValue([{ name: "SKILL.md", isDirectory: () => false }] as never);

    copySkillToInstance("my-skill", "/source/my-skill");

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("my-skill"), { recursive: true });
    expect(fs.copyFileSync).toHaveBeenCalled();
  });

  it("recurses into subdirectories", () => {
    mockReaddirSync
      .mockReturnValueOnce([{ name: "subdir", isDirectory: () => true }] as never)
      .mockReturnValueOnce([{ name: "file.md", isDirectory: () => false }] as never);

    copySkillToInstance("my-skill", "/source/my-skill");

    // mkdirSync called multiple times (for dest and subdir)
    expect(fs.mkdirSync).toHaveBeenCalledTimes(3);
  });
});

// ── skillsFind ────────────────────────────────────────────────────────────────

describe("skillsFind", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawnSync.mockReturnValue({ status: 0 } as never);
  });

  it("calls npx skills find without query when no argument", () => {
    skillsFind();
    expect(mockSpawnSync).toHaveBeenCalledWith("npx", ["skills", "find"], expect.any(Object));
  });

  it("calls npx skills find with query when argument provided", () => {
    skillsFind("my-query");
    expect(mockSpawnSync).toHaveBeenCalledWith("npx", ["skills", "find", "my-query"], expect.any(Object));
  });

  it("sets process.exitCode to spawn result status", () => {
    mockSpawnSync.mockReturnValue({ status: 2 } as never);
    skillsFind();
    expect(process.exitCode).toBe(2);
  });

  it("sets process.exitCode to 1 when spawn status is null", () => {
    mockSpawnSync.mockReturnValue({ status: null } as never);
    skillsFind();
    expect(process.exitCode).toBe(1);
  });
});

// ── skillsAdd ────────────────────────────────────────────────────────────────

describe("skillsAdd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([] as never);
    mockReadFileSync.mockReturnValue("[]" as never);
  });

  it("sets exitCode=1 and logs error when spawnSync fails", () => {
    mockSpawnSync.mockReturnValue({ status: 1 } as never);

    skillsAdd("owner/repo@my-skill");

    expect(process.exitCode).toBe(1);
    const errorCalls = vi.mocked(console.error).mock.calls.map((c) => c.join(" "));
    expect(errorCalls.some((c) => c.includes("Failed"))).toBe(true);
  });

  it("copies new skill dir when diffSnapshots finds new entry", () => {
    // snapshot before: empty; snapshot after: has skill-a
    mockReaddirSync
      // Before snapshot: 3 global dirs, all empty initially
      .mockReturnValueOnce([] as never) // dir 1 before
      .mockReturnValueOnce([] as never) // dir 2 before
      .mockReturnValueOnce([] as never) // dir 3 before
      // After snapshot: dir 1 has new skill
      .mockReturnValueOnce([{ name: "skill-a", isDirectory: () => true }] as never) // dir 1 after
      .mockReturnValueOnce([] as never) // dir 2 after
      .mockReturnValueOnce([] as never) // dir 3 after
      // copySkillToInstance: readdirSync for source dir
      .mockReturnValueOnce([{ name: "SKILL.md", isDirectory: () => false }] as never);

    mockExistsSync.mockReturnValue(true); // all dirs exist for snapshot
    mockSpawnSync.mockReturnValue({ status: 0 } as never);

    skillsAdd("owner/repo@skill-a");

    expect(fs.mkdirSync).toHaveBeenCalled();
    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("added"))).toBe(true);
  });

  it("uses findExistingSkill when newDirs is empty and copies found skill", () => {
    // Snapshots before/after identical (no diff) → findExistingSkill path
    // Use controlled call order to avoid infinite recursion
    mockReaddirSync
      .mockReturnValueOnce([{ name: "skill-existing", isDirectory: () => true }] as never) // before dir1
      .mockReturnValueOnce([] as never) // before dir2
      .mockReturnValueOnce([] as never) // before dir3
      .mockReturnValueOnce([{ name: "skill-existing", isDirectory: () => true }] as never) // after dir1 (same)
      .mockReturnValueOnce([] as never) // after dir2
      .mockReturnValueOnce([] as never) // after dir3
      // copySkillToInstance: source dir has only files, no subdirs
      .mockReturnValueOnce([{ name: "SKILL.md", isDirectory: () => false }] as never);

    // existsSync: dirs exist for snapshotDirs and for findExistingSkill
    mockExistsSync.mockReturnValue(true);

    mockSpawnSync.mockReturnValue({ status: 0 } as never);

    skillsAdd("owner/repo@skill-existing");

    // Should have logged "added" with the skill name
    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("added") || c.includes("skill-existing"))).toBe(true);
  });

  it("logs warning when newDirs is empty and skill not found globally", () => {
    // Snapshots before/after identical (no new dirs), skill not found
    mockReaddirSync.mockReturnValue([] as never);
    mockExistsSync.mockReturnValue(false);
    mockSpawnSync.mockReturnValue({ status: 0 } as never);

    skillsAdd("owner/repo@mystery-skill");

    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("globally") || c.includes("locate"))).toBe(true);
  });
});

// ── skillsUpdate ──────────────────────────────────────────────────────────────

describe("skillsUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([] as never);
    mockReadFileSync.mockReturnValue("[]" as never);
  });

  it("logs 'No skills in manifest to update.' when manifest is empty", () => {
    mockExistsSync.mockReturnValue(false); // no skills.json

    skillsUpdate();

    expect(vi.mocked(console.log)).toHaveBeenCalledWith("No skills in manifest to update.");
  });

  it("updates each skill listed in the manifest", () => {
    mockExistsSync.mockReturnValue(true);
    const manifest = [{ name: "skill-a", source: "owner/repo@skill-a", installedAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest) as never);
    mockSpawnSync.mockReturnValue({ status: 0 } as never);
    // All snapshot reads return empty (no diff → use findExistingSkill)
    mockReaddirSync.mockReturnValue([] as never);

    skillsUpdate();

    expect(mockSpawnSync).toHaveBeenCalledWith("npx", ["skills", "add", "owner/repo@skill-a", "-g", "-y"], {
      stdio: "pipe",
      shell: true,
    });
  });

  it("logs failure and continues when spawnSync fails for one skill", () => {
    mockExistsSync.mockReturnValue(true);
    const manifest = [
      { name: "skill-a", source: "owner/repo@skill-a", installedAt: "2024-01-01T00:00:00.000Z" },
      { name: "skill-b", source: "owner/repo@skill-b", installedAt: "2024-01-01T00:00:00.000Z" },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest) as never);
    // First skill fails, second succeeds
    mockSpawnSync.mockReturnValueOnce({ status: 1 } as never).mockReturnValue({ status: 0 } as never);
    mockReaddirSync.mockReturnValue([] as never);

    skillsUpdate();

    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("Failed"))).toBe(true);
    // skill-b should still be attempted
    expect(mockSpawnSync).toHaveBeenCalledTimes(2);
  });

  it("copies from newDirs when diff finds new entries", () => {
    mockExistsSync.mockReturnValue(true);
    const manifest = [{ name: "skill-a", source: "owner/repo@skill-a", installedAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest) as never);
    mockSpawnSync.mockReturnValue({ status: 0 } as never);

    // First 3 readdirSync: before snapshot (empty)
    // Next 3 readdirSync: after snapshot (new skill appeared in dir 1)
    // Then: copySkillToInstance
    mockReaddirSync
      .mockReturnValueOnce([] as never) // before dir1
      .mockReturnValueOnce([] as never) // before dir2
      .mockReturnValueOnce([] as never) // before dir3
      .mockReturnValueOnce([{ name: "skill-a", isDirectory: () => true }] as never) // after dir1
      .mockReturnValueOnce([] as never) // after dir2
      .mockReturnValueOnce([] as never) // after dir3
      .mockReturnValueOnce([{ name: "SKILL.md", isDirectory: () => false }] as never); // copy source

    skillsUpdate();

    expect(fs.mkdirSync).toHaveBeenCalled();
    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("Updated"))).toBe(true);
  });
});

// ── skillsRestore ─────────────────────────────────────────────────────────────

describe("skillsRestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([] as never);
    mockReadFileSync.mockReturnValue("[]" as never);
  });

  it("logs 'No skills in manifest to restore.' when manifest is empty", () => {
    mockExistsSync.mockReturnValue(false); // no skills.json

    skillsRestore();

    expect(vi.mocked(console.log)).toHaveBeenCalledWith("No skills in manifest to restore.");
  });

  it("skips skill when destination directory already exists", () => {
    mockExistsSync.mockReturnValue(true);
    const manifest = [{ name: "skill-a", source: "owner/repo@skill-a", installedAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest) as never);

    skillsRestore();

    // Should not call spawnSync since skill already exists
    expect(mockSpawnSync).not.toHaveBeenCalled();
    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("already exists") || c.includes("skipping"))).toBe(true);
  });

  it("installs skill when destination does not exist and spawn succeeds with newDirs", () => {
    // skills.json exists, skill dest does NOT exist, global dirs for snapshot DO exist
    mockExistsSync
      .mockReturnValueOnce(true) // skills.json exists
      .mockReturnValueOnce(false) // skill dest does not exist
      .mockReturnValue(true); // all global dirs exist for snapshot

    const manifest = [{ name: "skill-a", source: "owner/repo@skill-a", installedAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest) as never);
    mockSpawnSync.mockReturnValue({ status: 0 } as never);

    // Snapshot diffs: before empty, after has skill-a
    mockReaddirSync
      .mockReturnValueOnce([] as never) // before dir1
      .mockReturnValueOnce([] as never) // before dir2
      .mockReturnValueOnce([] as never) // before dir3
      .mockReturnValueOnce([{ name: "skill-a", isDirectory: () => true }] as never) // after dir1
      .mockReturnValueOnce([] as never) // after dir2
      .mockReturnValueOnce([] as never) // after dir3
      .mockReturnValueOnce([{ name: "SKILL.md", isDirectory: () => false }] as never); // copy source

    skillsRestore();

    expect(mockSpawnSync).toHaveBeenCalled();
    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("Restored"))).toBe(true);
  });

  it("logs failure and continues when spawnSync fails", () => {
    mockExistsSync
      .mockReturnValueOnce(true) // skills.json exists
      .mockReturnValueOnce(false) // skill dest does not exist
      .mockReturnValue(false); // global dirs do not exist

    const manifest = [{ name: "skill-a", source: "owner/repo@skill-a", installedAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest) as never);
    mockSpawnSync.mockReturnValue({ status: 1 } as never);
    mockReaddirSync.mockReturnValue([] as never);

    skillsRestore();

    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("Failed"))).toBe(true);
  });

  it("uses findExistingSkill when newDirs is empty after restore", () => {
    mockExistsSync
      .mockReturnValueOnce(true) // skills.json exists
      .mockReturnValueOnce(false) // skill dest does not exist
      .mockReturnValue(true); // global dirs exist, and findExistingSkill finds it

    const manifest = [{ name: "skill-a", source: "owner/repo@skill-a", installedAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest) as never);
    mockSpawnSync.mockReturnValue({ status: 0 } as never);

    // No diff (same before and after) → findExistingSkill path
    // Use controlled call order to avoid infinite recursion in copyDirRecursive
    mockReaddirSync
      .mockReturnValueOnce([{ name: "skill-a", isDirectory: () => true }] as never) // before dir1
      .mockReturnValueOnce([] as never) // before dir2
      .mockReturnValueOnce([] as never) // before dir3
      .mockReturnValueOnce([{ name: "skill-a", isDirectory: () => true }] as never) // after dir1 (same → no diff)
      .mockReturnValueOnce([] as never) // after dir2
      .mockReturnValueOnce([] as never) // after dir3
      // copySkillToInstance: source dir has only files, no subdirs
      .mockReturnValueOnce([{ name: "SKILL.md", isDirectory: () => false }] as never);

    skillsRestore();

    // copySkillToInstance should be called (via findExistingSkill)
    expect(fs.mkdirSync).toHaveBeenCalled();
  });
});
