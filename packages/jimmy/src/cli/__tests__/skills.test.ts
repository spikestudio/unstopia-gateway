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

vi.mock("../../shared/paths.js", () => ({
  JINN_HOME: "/home/user/.jinn",
  SKILLS_DIR: "/home/user/.jinn/skills",
}));

import fs from "node:fs";
import {
  extractSkillName,
  readManifest,
  removeFromManifest,
  skillsList,
  skillsRemove,
  upsertManifest,
  writeManifest,
} from "../skills.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);
const mockRmSync = vi.mocked(fs.rmSync);

describe("readManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return [] when skills.json does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = readManifest();

    expect(result).toEqual([]);
  });

  it("should return parsed entries when skills.json contains valid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    const entries = [{ name: "my-skill", source: "owner/repo@my-skill", installedAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(entries) as unknown as ReturnType<typeof fs.readFileSync>);

    const result = readManifest();

    expect(result).toEqual(entries);
  });

  it("should return [] when skills.json contains invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not json" as unknown as ReturnType<typeof fs.readFileSync>);

    const result = readManifest();

    expect(result).toEqual([]);
  });
});

describe("writeManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should write entries to skills.json as formatted JSON", () => {
    const entries = [{ name: "my-skill", source: "owner/repo@my-skill", installedAt: "2024-01-01T00:00:00.000Z" }];

    writeManifest(entries);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("skills.json"),
      `${JSON.stringify(entries, null, 2)}\n`,
    );
  });
});

describe("upsertManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add a new entry when skill is not in manifest", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("[]" as unknown as ReturnType<typeof fs.readFileSync>);

    upsertManifest("new-skill", "owner/repo@new-skill");

    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    const saved = JSON.parse(written);
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("new-skill");
    expect(saved[0].source).toBe("owner/repo@new-skill");
  });

  it("should update an existing entry when skill already exists in manifest", () => {
    mockExistsSync.mockReturnValue(true);
    const existing = [{ name: "my-skill", source: "old-owner/repo@my-skill", installedAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(existing) as unknown as ReturnType<typeof fs.readFileSync>);

    upsertManifest("my-skill", "new-owner/repo@my-skill");

    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    const saved = JSON.parse(written);
    expect(saved).toHaveLength(1);
    expect(saved[0].source).toBe("new-owner/repo@my-skill");
  });
});

describe("removeFromManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when skill is not in manifest", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("[]" as unknown as ReturnType<typeof fs.readFileSync>);

    const result = removeFromManifest("nonexistent");

    expect(result).toBe(false);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("should remove entry and return true when skill exists in manifest", () => {
    mockExistsSync.mockReturnValue(true);
    const entries = [
      { name: "my-skill", source: "owner/repo@my-skill", installedAt: "2024-01-01T00:00:00.000Z" },
      { name: "other-skill", source: "owner/repo@other-skill", installedAt: "2024-01-01T00:00:00.000Z" },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(entries) as unknown as ReturnType<typeof fs.readFileSync>);

    const result = removeFromManifest("my-skill");

    expect(result).toBe(true);
    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    const saved = JSON.parse(written);
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("other-skill");
  });
});

describe("extractSkillName", () => {
  it("should extract skill name from 'owner/repo@skill-name' format", () => {
    const result = extractSkillName("owner/repo@my-skill");

    expect(result).toBe("my-skill");
  });

  it("should extract repo name from 'owner/repo' format (no @)", () => {
    const result = extractSkillName("owner/repo");

    expect(result).toBe("repo");
  });

  it("should return the package name as-is when no slash or @ is present", () => {
    const result = extractSkillName("my-skill");

    expect(result).toBe("my-skill");
  });

  it("should handle nested paths with @ suffix", () => {
    const result = extractSkillName("org/namespace/repo@skill-name");

    expect(result).toBe("skill-name");
  });
});

describe("skillsRemove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should set exitCode to 1 when skill directory does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    skillsRemove("nonexistent-skill");

    expect(process.exitCode).toBe(1);
  });

  it("should remove skill directory and update manifest when skill exists", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      // skill dir exists, skills.json does not
      if (ps.endsWith("nonexistent-skill")) return false;
      if (ps.includes("skills/my-skill")) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue("[]" as unknown as ReturnType<typeof fs.readFileSync>);

    skillsRemove("my-skill");

    expect(mockRmSync).toHaveBeenCalledWith(expect.stringContaining("my-skill"), { recursive: true, force: true });
  });

  it("should log success message after removing the skill", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.includes("skills/my-skill")) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue("[]" as unknown as ReturnType<typeof fs.readFileSync>);

    skillsRemove("my-skill");

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("my-skill"))).toBe(true);
  });
});

describe("skillsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log 'No skills installed.' when SKILLS_DIR does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    skillsList();

    expect(console.log).toHaveBeenCalledWith("No skills installed.");
  });

  it("should log 'No skills installed.' when SKILLS_DIR exists but is empty", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);

    skillsList();

    expect(console.log).toHaveBeenCalledWith("No skills installed.");
  });

  it("should list skill directories when SKILLS_DIR contains skills", () => {
    mockExistsSync.mockReturnValue(true);
    const skillDir = {
      name: "my-skill",
      isDirectory: () => true,
    };
    mockReaddirSync.mockImplementation((dir) => {
      // skills.json read
      if (String(dir).endsWith("skills.json")) return [] as unknown as ReturnType<typeof fs.readdirSync>;
      return [skillDir] as unknown as ReturnType<typeof fs.readdirSync>;
    });
    // manifest is empty, SKILL.md does not exist
    mockReadFileSync.mockReturnValue("[]" as unknown as ReturnType<typeof fs.readFileSync>);

    skillsList();

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("my-skill"))).toBe(true);
  });

  it("should display source from manifest when skill is listed in manifest", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("skills.json")) return true;
      if (ps.includes("SKILL.md")) return false;
      return true;
    });
    const skillDir = {
      name: "manifest-skill",
      isDirectory: () => true,
    };
    mockReaddirSync.mockReturnValue([skillDir] as unknown as ReturnType<typeof fs.readdirSync>);
    const manifest = [
      { name: "manifest-skill", source: "owner/repo@manifest-skill", installedAt: "2024-01-01T00:00:00.000Z" },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest) as unknown as ReturnType<typeof fs.readFileSync>);

    skillsList();

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("owner/repo@manifest-skill"))).toBe(true);
  });

  it("should display '(local)' for skills not in manifest", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("skills.json")) return false;
      if (ps.includes("SKILL.md")) return false;
      return true;
    });
    const skillDir = {
      name: "local-skill",
      isDirectory: () => true,
    };
    mockReaddirSync.mockReturnValue([skillDir] as unknown as ReturnType<typeof fs.readdirSync>);

    skillsList();

    const calls = vi.mocked(console.log).mock.calls.map((c) => c.join(" "));
    expect(calls.some((c) => c.includes("local"))).toBe(true);
  });
});
