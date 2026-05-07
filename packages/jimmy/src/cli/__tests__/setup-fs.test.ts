import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
    },
  };
});

import { execSync } from "node:child_process";
import fs from "node:fs";
import {
  applyTemplateReplacements,
  copyTemplateDir,
  ensureDir,
  ensureFile,
  runVersion,
  whichBin,
} from "../setup-fs.js";

const mockExecSync = vi.mocked(execSync);
const mockExistsSync = vi.mocked(fs.existsSync);
const mockMkdirSync = vi.mocked(fs.mkdirSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockCopyFileSync = vi.mocked(fs.copyFileSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);

describe("whichBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the binary path when the binary is found", () => {
    mockExecSync.mockReturnValue("/usr/local/bin/node\n" as unknown as ReturnType<typeof fs.readFileSync>);

    const result = whichBin("node");

    expect(result).toBe("/usr/local/bin/node");
  });

  it("should return null when the binary is not found", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const result = whichBin("nonexistent-bin");

    expect(result).toBeNull();
  });

  it("should return the first line when output contains multiple lines", () => {
    mockExecSync.mockReturnValue(
      "/usr/local/bin/node\n/usr/bin/node\n" as unknown as ReturnType<typeof fs.readFileSync>,
    );

    const result = whichBin("node");

    expect(result).toBe("/usr/local/bin/node");
  });
});

describe("runVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the trimmed version string when command succeeds", () => {
    mockExecSync.mockReturnValue("v18.0.0\n" as unknown as ReturnType<typeof fs.readFileSync>);

    const result = runVersion("/usr/local/bin/node");

    expect(result).toBe("v18.0.0");
  });

  it("should return null when the command fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("command failed");
    });

    const result = runVersion("/nonexistent/bin");

    expect(result).toBeNull();
  });
});

describe("ensureDir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when directory already exists", () => {
    mockExistsSync.mockReturnValue(true);

    const result = ensureDir("/existing/dir");

    expect(result).toBe(false);
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it("should create the directory and return true when it does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = ensureDir("/new/dir");

    expect(result).toBe(true);
    expect(mockMkdirSync).toHaveBeenCalledWith("/new/dir", { recursive: true });
  });
});

describe("ensureFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when file already exists", () => {
    mockExistsSync.mockReturnValue(true);

    const result = ensureFile("/existing/file.txt", "content");

    expect(result).toBe(false);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("should create the file with content and return true when it does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = ensureFile("/new/file.txt", "hello");

    expect(result).toBe(true);
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith("/new/file.txt", "hello", "utf-8");
  });
});

describe("applyTemplateReplacements", () => {
  it("should replace all occurrences of placeholders with values", () => {
    const content = "Hello {{NAME}}, your port is {{PORT}}!";
    const replacements = { "{{NAME}}": "gateway", "{{PORT}}": "7777" };

    const result = applyTemplateReplacements(content, replacements);

    expect(result).toBe("Hello gateway, your port is 7777!");
  });

  it("should return the content unchanged when no replacements are provided", () => {
    const content = "No placeholders here";

    const result = applyTemplateReplacements(content, {});

    expect(result).toBe("No placeholders here");
  });

  it("should replace multiple occurrences of the same placeholder", () => {
    const content = "{{NAME}} is {{NAME}}";

    const result = applyTemplateReplacements(content, { "{{NAME}}": "jinn" });

    expect(result).toBe("jinn is jinn");
  });
});

describe("copyTemplateDir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return [] when source directory does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = copyTemplateDir("/nonexistent/src", "/dest");

    expect(result).toEqual([]);
  });

  it("should skip .gitkeep files when copying", () => {
    mockExistsSync.mockImplementation((p) => p === "/src");
    const gitkeepEntry = {
      name: ".gitkeep",
      isDirectory: () => false,
    };
    mockReaddirSync.mockReturnValue([gitkeepEntry] as unknown as ReturnType<typeof fs.readdirSync>);

    const result = copyTemplateDir("/src", "/dest");

    expect(result).toEqual([]);
    expect(mockCopyFileSync).not.toHaveBeenCalled();
  });

  it("should skip files that already exist in the destination", () => {
    // src exists, dest file exists
    mockExistsSync.mockImplementation((p) => {
      if (p === "/src") return true;
      if (p === "/dest/file.txt") return true;
      return false;
    });
    const fileEntry = {
      name: "file.txt",
      isDirectory: () => false,
    };
    mockReaddirSync.mockReturnValue([fileEntry] as unknown as ReturnType<typeof fs.readdirSync>);

    const result = copyTemplateDir("/src", "/dest");

    expect(result).toEqual([]);
    expect(mockCopyFileSync).not.toHaveBeenCalled();
  });

  it("should copy new files and return their paths", () => {
    mockExistsSync.mockImplementation((p) => {
      if (p === "/src") return true;
      if (p === "/dest/file.txt") return false;
      return false;
    });
    const fileEntry = {
      name: "file.txt",
      isDirectory: () => false,
    };
    mockReaddirSync.mockReturnValue([fileEntry] as unknown as ReturnType<typeof fs.readdirSync>);

    const result = copyTemplateDir("/src", "/dest");

    expect(result).toContain("/dest/file.txt");
    expect(mockCopyFileSync).toHaveBeenCalledWith("/src/file.txt", "/dest/file.txt");
  });

  it("should apply template replacements to .md files", () => {
    mockExistsSync.mockImplementation((p) => {
      if (p === "/src") return true;
      if (p === "/dest/readme.md") return false;
      return false;
    });
    const mdEntry = {
      name: "readme.md",
      isDirectory: () => false,
    };
    mockReaddirSync.mockReturnValue([mdEntry] as unknown as ReturnType<typeof fs.readdirSync>);
    mockReadFileSync.mockReturnValue("Hello {{NAME}}" as unknown as ReturnType<typeof fs.readFileSync>);

    copyTemplateDir("/src", "/dest", { "{{NAME}}": "jinn" });

    expect(mockWriteFileSync).toHaveBeenCalledWith("/dest/readme.md", "Hello jinn", "utf-8");
  });

  it("should apply template replacements to .yaml files", () => {
    mockExistsSync.mockImplementation((p) => {
      if (p === "/src") return true;
      if (p === "/dest/config.yaml") return false;
      return false;
    });
    const yamlEntry = {
      name: "config.yaml",
      isDirectory: () => false,
    };
    mockReaddirSync.mockReturnValue([yamlEntry] as unknown as ReturnType<typeof fs.readdirSync>);
    mockReadFileSync.mockReturnValue("port: {{PORT}}" as unknown as ReturnType<typeof fs.readFileSync>);

    copyTemplateDir("/src", "/dest", { "{{PORT}}": "7777" });

    expect(mockWriteFileSync).toHaveBeenCalledWith("/dest/config.yaml", "port: 7777", "utf-8");
  });

  it("should NOT apply replacements to non-.md/.yaml files", () => {
    mockExistsSync.mockImplementation((p) => {
      if (p === "/src") return true;
      if (p === "/dest/script.sh") return false;
      return false;
    });
    const shEntry = {
      name: "script.sh",
      isDirectory: () => false,
    };
    mockReaddirSync.mockReturnValue([shEntry] as unknown as ReturnType<typeof fs.readdirSync>);

    copyTemplateDir("/src", "/dest", { "{{NAME}}": "jinn" });

    expect(mockCopyFileSync).toHaveBeenCalledWith("/src/script.sh", "/dest/script.sh");
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("should recurse into subdirectories", () => {
    mockExistsSync.mockImplementation((p) => {
      const ps = String(p);
      // Both /src and /src/subdir (the recursed srcDir) must exist
      if (ps === "/src") return true;
      if (ps === "/src/subdir") return true;
      // The destination file should NOT exist so it gets created
      if (ps === "/dest/subdir/nested.txt") return false;
      return false;
    });
    const dirEntry = {
      name: "subdir",
      isDirectory: () => true,
    };
    const fileEntry = {
      name: "nested.txt",
      isDirectory: () => false,
    };
    // First readdirSync call: /src → [subdir], second call: /src/subdir → [nested.txt]
    mockReaddirSync
      .mockReturnValueOnce([dirEntry] as unknown as ReturnType<typeof fs.readdirSync>)
      .mockReturnValueOnce([fileEntry] as unknown as ReturnType<typeof fs.readdirSync>);

    const result = copyTemplateDir("/src", "/dest");

    expect(result).toContain("/dest/subdir/nested.txt");
  });
});
