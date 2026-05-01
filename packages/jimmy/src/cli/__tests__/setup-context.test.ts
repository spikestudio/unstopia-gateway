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
