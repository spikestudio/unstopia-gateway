import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(),
    },
  };
});

vi.mock("../../shared/version.js", () => ({
  getPackageVersion: vi.fn(() => "1.0.0"),
}));

import fs from "node:fs";
import { defaultAgentsMd, defaultClaudeMd, detectProjectContext } from "../setup-context.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);

describe("detectProjectContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should do nothing when ~/Projects directory does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    detectProjectContext("jinn");

    expect(console.log).not.toHaveBeenCalled();
  });

  it("should detect Docker projects when Dockerfile is present", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      if (ps.endsWith("Dockerfile")) return true;
      return false;
    });
    const projectDir = {
      name: "myproject",
      isDirectory: () => true,
    };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [projectDir] as unknown as ReturnType<typeof fs.readdirSync>;
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });

    detectProjectContext("jinn");

    expect(console.log).toHaveBeenCalled();
    const calls = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("Docker"))).toBe(true);
  });

  it("should detect React projects when package.json has 'react' dependency", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      if (ps.endsWith("package.json")) return true;
      return false;
    });
    const projectDir = {
      name: "react-app",
      isDirectory: () => true,
    };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [projectDir] as unknown as ReturnType<typeof fs.readdirSync>;
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ dependencies: { react: "^18.0.0" } }) as unknown as ReturnType<typeof fs.readFileSync>,
    );

    detectProjectContext("jinn");

    expect(console.log).toHaveBeenCalled();
    const calls = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("React"))).toBe(true);
  });

  it("should detect Next.js projects when package.json has 'next' dependency (line 83 next branch)", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      if (ps.endsWith("package.json")) return true;
      return false;
    });
    const projectDir = { name: "next-app", isDirectory: () => true };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [projectDir] as unknown as ReturnType<typeof fs.readdirSync>;
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ dependencies: { next: "14.0.0" } }) as unknown as ReturnType<typeof fs.readFileSync>,
    );

    detectProjectContext("jinn");

    const calls = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("React"))).toBe(true);
  });

  it("should not detect React when package.json has neither react nor next (line 83 false branch)", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      if (ps.endsWith("package.json")) return true;
      return false;
    });
    const projectDir = { name: "vanilla-app", isDirectory: () => true };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [projectDir] as unknown as ReturnType<typeof fs.readdirSync>;
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ dependencies: { lodash: "4.0.0" } }) as unknown as ReturnType<typeof fs.readFileSync>,
    );

    detectProjectContext("jinn");

    // No React detected, so no suggestion for React
    expect(vi.mocked(console.log)).not.toHaveBeenCalled();
  });

  it("should log suggestion with the portalSlug for each detected context", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      if (ps.endsWith("Dockerfile")) return true;
      return false;
    });
    const projectDir = {
      name: "myproject",
      isDirectory: () => true,
    };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [projectDir] as unknown as ReturnType<typeof fs.readdirSync>;
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });

    detectProjectContext("my-portal");

    const calls = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("my-portal"))).toBe(true);
  });

  it("should not log when no project indicators are found", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      return false;
    });
    const projectDir = {
      name: "empty-project",
      isDirectory: () => true,
    };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [projectDir] as unknown as ReturnType<typeof fs.readdirSync>;
      // Return empty array that has no matching indicators
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });

    detectProjectContext("jinn");

    // No indicator found, should not print suggestions
    expect(console.log).not.toHaveBeenCalled();
  });

  it("should return false from iOS indicator when readdirSync throws (line 44 branch)", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      return false;
    });
    const projectDir = { name: "ios-app", isDirectory: () => true };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [projectDir] as unknown as ReturnType<typeof fs.readdirSync>;
      // readdirSync for the project dir itself throws → iOS check returns false
      throw new Error("ENOENT");
    });

    // Should not throw
    expect(() => detectProjectContext("jinn")).not.toThrow();
  });

  it("should return false from React indicator when readFileSync/JSON.parse throws (line 85 branch)", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      if (ps.endsWith("package.json")) return true;
      return false;
    });
    const projectDir = { name: "broken-react", isDirectory: () => true };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [projectDir] as unknown as ReturnType<typeof fs.readdirSync>;
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });
    // readFileSync throws → JSON.parse never called → catch returns false
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    expect(() => detectProjectContext("jinn")).not.toThrow();
    // No suggestions since React check failed
    expect(vi.mocked(console.log)).not.toHaveBeenCalled();
  });

  it("should include sub-directory projects (line 106 branch)", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      if (ps.endsWith("Dockerfile")) return true;
      return false;
    });
    const orgDir = { name: "OrgFolder", isDirectory: () => true };
    const subDir = { name: "sub-project", isDirectory: () => true };

    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [orgDir] as unknown as ReturnType<typeof fs.readdirSync>;
      // Second call: subdirectory of OrgFolder
      if (d.endsWith("OrgFolder")) return [subDir] as unknown as ReturnType<typeof fs.readdirSync>;
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });

    detectProjectContext("jinn");

    // At least one Docker suggestion because sub-project/Dockerfile exists
    const calls = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("Docker"))).toBe(true);
  });

  it("should return early when top-level readdirSync throws (line 122 branch)", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      return false;
    });
    mockReaddirSync.mockImplementation(() => {
      throw new Error("EPERM: permission denied");
    });

    // Should not throw — catch at line 121 returns
    expect(() => detectProjectContext("jinn")).not.toThrow();
    expect(vi.mocked(console.log)).not.toHaveBeenCalled();
  });

  it("should silently ignore sub-directory read errors (line 108 branch)", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      if (ps.endsWith("Projects")) return true;
      return false;
    });
    const orgDir = { name: "OrgFolder", isDirectory: () => true };
    mockReaddirSync.mockImplementation((dir) => {
      const d = String(dir);
      if (d.endsWith("Projects")) return [orgDir] as unknown as ReturnType<typeof fs.readdirSync>;
      // Sub-dir read throws → catch at line 108 ignores it
      throw new Error("EACCES");
    });

    expect(() => detectProjectContext("jinn")).not.toThrow();
  });
});

describe("defaultClaudeMd", () => {
  it("should return markdown containing the portal name", () => {
    const result = defaultClaudeMd("my-portal");

    expect(result).toContain("my-portal");
  });

  it("should return a non-empty string", () => {
    const result = defaultClaudeMd("jinn");

    expect(result.length).toBeGreaterThan(0);
  });
});

describe("defaultAgentsMd", () => {
  it("should return markdown containing the portal name", () => {
    const result = defaultAgentsMd("my-portal");

    expect(result).toContain("my-portal");
  });

  it("should return a non-empty string", () => {
    const result = defaultAgentsMd("jinn");

    expect(result.length).toBeGreaterThan(0);
  });
});
