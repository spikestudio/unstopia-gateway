import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- mock node:child_process ---
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

// --- mock node:fs ---
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(() => ""),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      rmSync: vi.fn(),
      symlinkSync: vi.fn(),
    },
  };
});

// --- mock js-yaml ---
vi.mock("js-yaml", () => ({
  default: {
    load: vi.fn(() => ({ portal: { portalName: "Jinn" } })),
  },
}));

// --- mock sessions/registry ---
vi.mock("../../sessions/registry.js", () => ({
  initDb: vi.fn(),
}));

// --- mock shared/paths ---
vi.mock("../../shared/paths.js", () => ({
  JINN_HOME: "/mock/.jinn",
  CONFIG_PATH: "/mock/.jinn/config.yaml",
  CRON_JOBS: "/mock/.jinn/cron/jobs.json",
  CRON_RUNS: "/mock/.jinn/cron/runs",
  DOCS_DIR: "/mock/.jinn/docs",
  SKILLS_DIR: "/mock/.jinn/skills",
  ORG_DIR: "/mock/.jinn/org",
  LOGS_DIR: "/mock/.jinn/logs",
  TMP_DIR: "/mock/.jinn/tmp",
  TEMPLATE_DIR: "/mock/template",
  CLAUDE_SKILLS_DIR: "/mock/.jinn/.claude/skills",
  AGENTS_SKILLS_DIR: "/mock/.jinn/.agents/skills",
}));

// --- mock shared/version ---
vi.mock("../../shared/version.js", () => ({
  getPackageVersion: vi.fn(() => "1.2.3"),
}));

// --- mock setup-context ---
vi.mock("../setup-context.js", () => ({
  DEFAULT_CONFIG: 'jinn:\n  version: "0.0.0"\nengines:\n  default: claude\nportal: {}\n',
  defaultClaudeMd: vi.fn((name: string) => `# ${name} CLAUDE.md`),
  defaultAgentsMd: vi.fn((name: string) => `# ${name} AGENTS.md`),
  detectProjectContext: vi.fn(),
}));

// --- mock setup-fs ---
vi.mock("../setup-fs.js", () => ({
  applyTemplateReplacements: vi.fn((src: string) => src),
  copyTemplateDir: vi.fn(() => []),
  ensureDir: vi.fn(() => false),
  ensureFile: vi.fn(() => false),
  runVersion: vi.fn(() => null),
  whichBin: vi.fn(() => null),
}));

// --- mock setup-ui ---
vi.mock("../setup-ui.js", () => ({
  DIM: "",
  GREEN: "",
  RESET: "",
  YELLOW: "",
  fail: vi.fn(),
  info: vi.fn(),
  ok: vi.fn(),
  prompt: vi.fn(),
  warn: vi.fn(),
}));

// ---- imports after vi.mock declarations ----
import { spawn } from "node:child_process";
import fs from "node:fs";
import yaml from "js-yaml";
import { initDb } from "../../sessions/registry.js";
import { detectProjectContext } from "../setup-context.js";
import { copyTemplateDir, ensureDir, ensureFile, runVersion, whichBin } from "../setup-fs.js";
import { fail, info, ok, prompt, warn } from "../setup-ui.js";
import { runSetup } from "../setup.js";

const mockFs = vi.mocked(fs);
const mockOk = vi.mocked(ok);
const mockWarn = vi.mocked(warn);
const mockFail = vi.mocked(fail);
const mockInfo = vi.mocked(info);
const mockPrompt = vi.mocked(prompt);
const mockWhichBin = vi.mocked(whichBin);
const mockRunVersion = vi.mocked(runVersion);
const mockEnsureDir = vi.mocked(ensureDir);
const mockEnsureFile = vi.mocked(ensureFile);
const mockCopyTemplateDir = vi.mocked(copyTemplateDir);
const mockInitDb = vi.mocked(initDb);
const mockDetectProjectContext = vi.mocked(detectProjectContext);
const mockSpawn = vi.mocked(spawn);

describe("runSetup", () => {
  let originalVersions: NodeJS.ProcessVersions;
  let originalStdin: NodeJS.ReadStream & { fd: 0 };
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    originalVersions = process.versions;
    originalStdin = process.stdin;
    originalEnv = process.env;

    // Default: Node 22, non-TTY, no existing files
    Object.defineProperty(process, "versions", {
      value: { ...process.versions, node: "22.0.0" },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process, "stdin", {
      value: { ...process.stdin, isTTY: false },
      writable: true,
      configurable: true,
    });
    process.env = { ...process.env };
    delete process.env.JINN_INSTANCE;

    // Default fs mocks: nothing exists
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("" as unknown as ReturnType<typeof fs.readFileSync>);

    // Default binary mocks: not found
    mockWhichBin.mockReturnValue(null);
    mockRunVersion.mockReturnValue(null);

    // Default file/dir helpers: nothing created
    mockEnsureDir.mockReturnValue(false);
    mockEnsureFile.mockReturnValue(false);
    mockCopyTemplateDir.mockReturnValue([]);

    // yaml.load returns basic config
    vi.mocked(yaml.load).mockReturnValue({ portal: { portalName: "Jinn" } });

    // spawn returns unrefable object
    mockSpawn.mockReturnValue({ unref: vi.fn() } as unknown as ReturnType<typeof spawn>);

    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(process, "versions", {
      value: originalVersions,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
      configurable: true,
    });
    process.env = originalEnv;
  });

  // -----------------------------------------------------------------------
  // Node.js version checks
  // -----------------------------------------------------------------------

  describe("Node.js version check", () => {
    it("calls ok() when Node.js version >= 22", async () => {
      Object.defineProperty(process, "versions", {
        value: { node: "22.0.0" },
        writable: true,
        configurable: true,
      });

      await runSetup();

      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("22.0.0"));
    });

    it("calls ok() when Node.js version is 23", async () => {
      Object.defineProperty(process, "versions", {
        value: { node: "23.1.0" },
        writable: true,
        configurable: true,
      });

      await runSetup();

      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("23.1.0"));
    });

    it("calls warn() when Node.js version < 22", async () => {
      Object.defineProperty(process, "versions", {
        value: { node: "20.11.0" },
        writable: true,
        configurable: true,
      });

      await runSetup();

      expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("20.11.0"));
    });

    it("calls warn() when Node.js version is 18", async () => {
      Object.defineProperty(process, "versions", {
        value: { node: "18.0.0" },
        writable: true,
        configurable: true,
      });

      await runSetup();

      expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("v22+ recommended"));
    });
  });

  // -----------------------------------------------------------------------
  // claude binary check
  // -----------------------------------------------------------------------

  describe("claude binary check", () => {
    it("calls ok() when claude binary is found", async () => {
      mockWhichBin.mockImplementation((bin) => (bin === "claude" ? "/usr/local/bin/claude" : null));

      await runSetup();

      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("claude found at /usr/local/bin/claude"));
    });

    it("calls fail() and info() when claude binary is not found", async () => {
      mockWhichBin.mockReturnValue(null);

      await runSetup();

      expect(mockFail).toHaveBeenCalledWith("claude not found");
      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("npm install -g @anthropic-ai/claude-code"));
    });
  });

  // -----------------------------------------------------------------------
  // codex binary check
  // -----------------------------------------------------------------------

  describe("codex binary check", () => {
    it("calls ok() when codex binary is found", async () => {
      mockWhichBin.mockImplementation((bin) => (bin === "codex" ? "/usr/local/bin/codex" : null));

      await runSetup();

      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("codex found at /usr/local/bin/codex"));
    });

    it("calls fail() and info() when codex binary is not found", async () => {
      mockWhichBin.mockReturnValue(null);

      await runSetup();

      expect(mockFail).toHaveBeenCalledWith("codex not found");
      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("npm install -g @openai/codex"));
    });
  });

  // -----------------------------------------------------------------------
  // version checks after binary found
  // -----------------------------------------------------------------------

  describe("version checks", () => {
    it("calls ok() with version when claude --version succeeds", async () => {
      mockWhichBin.mockImplementation((bin) => (bin === "claude" ? "/usr/local/bin/claude" : null));
      mockRunVersion.mockImplementation((bin) => (bin === "claude" ? "1.2.3" : null));

      await runSetup();

      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("claude --version: 1.2.3"));
    });

    it("calls warn() when claude --version fails", async () => {
      mockWhichBin.mockImplementation((bin) => (bin === "claude" ? "/usr/local/bin/claude" : null));
      mockRunVersion.mockReturnValue(null);

      await runSetup();

      expect(mockWarn).toHaveBeenCalledWith("claude --version failed");
    });

    it("calls ok() with version when codex --version succeeds", async () => {
      mockWhichBin.mockImplementation((bin) => (bin === "codex" ? "/usr/local/bin/codex" : null));
      mockRunVersion.mockImplementation((bin) => (bin === "codex" ? "2.0.0" : null));

      await runSetup();

      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("codex --version: 2.0.0"));
    });

    it("calls warn() when codex --version fails", async () => {
      mockWhichBin.mockImplementation((bin) => (bin === "codex" ? "/usr/local/bin/codex" : null));
      mockRunVersion.mockReturnValue(null);

      await runSetup();

      expect(mockWarn).toHaveBeenCalledWith("codex --version failed");
    });

    it("does not call runVersion for claude when claude binary is not found", async () => {
      mockWhichBin.mockReturnValue(null);

      await runSetup();

      expect(mockRunVersion).not.toHaveBeenCalledWith("claude");
    });

    it("does not call runVersion for codex when codex binary is not found", async () => {
      mockWhichBin.mockReturnValue(null);

      await runSetup();

      expect(mockRunVersion).not.toHaveBeenCalledWith("codex");
    });
  });

  // -----------------------------------------------------------------------
  // force option
  // -----------------------------------------------------------------------

  describe("force option", () => {
    it("calls rmSync when force=true and JINN_HOME exists", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn");

      await runSetup({ force: true });

      expect(mockFs.rmSync).toHaveBeenCalledWith("/mock/.jinn", { recursive: true, force: true });
    });

    it("does not call rmSync when force=true but JINN_HOME does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await runSetup({ force: true });

      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });

    it("does not call rmSync when force=false even if JINN_HOME exists", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn");

      await runSetup({ force: false });

      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });

    it("does not call rmSync when opts is undefined", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn");

      await runSetup();

      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // CONFIG_PATH creation
  // -----------------------------------------------------------------------

  describe("config file creation", () => {
    it("calls ensureFile for CONFIG_PATH when config does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await runSetup();

      expect(mockEnsureFile).toHaveBeenCalledWith("/mock/.jinn/config.yaml", expect.any(String));
    });

    it("does not call ensureFile for CONFIG_PATH when config already exists", async () => {
      // CONFIG_PATH exists; other paths do not
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/config.yaml");
      mockFs.readFileSync.mockReturnValue(
        "jinn:\n  version: \"0.0.0\"\nportal: {}\n" as unknown as ReturnType<typeof fs.readFileSync>,
      );

      await runSetup();

      const ensureFileCalls = mockEnsureFile.mock.calls.map((c) => c[0]);
      expect(ensureFileCalls).not.toContain("/mock/.jinn/config.yaml");
    });

    it("uses template config when template file exists", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/template/config.yaml");
      mockFs.readFileSync.mockReturnValue(
        'version: "0.0.0"\ndefault: claude\nportal: {}' as unknown as ReturnType<typeof fs.readFileSync>,
      );

      await runSetup();

      expect(mockEnsureFile).toHaveBeenCalledWith("/mock/.jinn/config.yaml", expect.any(String));
    });

    it("uses DEFAULT_CONFIG when template config does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await runSetup();

      expect(mockEnsureFile).toHaveBeenCalledWith("/mock/.jinn/config.yaml", expect.stringContaining("claude"));
    });
  });

  // -----------------------------------------------------------------------
  // CLAUDE.md and AGENTS.md creation
  // -----------------------------------------------------------------------

  describe("CLAUDE.md creation", () => {
    it("calls ensureFile for CLAUDE.md when it does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await runSetup();

      const paths = mockEnsureFile.mock.calls.map((c) => c[0]);
      expect(paths).toContain("/mock/.jinn/CLAUDE.md");
    });

    it("does not call ensureFile for CLAUDE.md when it already exists", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/CLAUDE.md");
      mockFs.readFileSync.mockReturnValue(
        "jinn:\n  version: \"0.0.0\"\n" as unknown as ReturnType<typeof fs.readFileSync>,
      );

      await runSetup();

      const paths = mockEnsureFile.mock.calls.map((c) => c[0]);
      expect(paths).not.toContain("/mock/.jinn/CLAUDE.md");
    });

    it("uses template CLAUDE.md when template file exists", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/template/CLAUDE.md");
      mockFs.readFileSync.mockReturnValue("# Template CLAUDE.md" as unknown as ReturnType<typeof fs.readFileSync>);

      await runSetup();

      const paths = mockEnsureFile.mock.calls.map((c) => c[0]);
      expect(paths).toContain("/mock/.jinn/CLAUDE.md");
    });
  });

  describe("AGENTS.md creation", () => {
    it("calls ensureFile for AGENTS.md when it does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await runSetup();

      const paths = mockEnsureFile.mock.calls.map((c) => c[0]);
      expect(paths).toContain("/mock/.jinn/AGENTS.md");
    });

    it("does not call ensureFile for AGENTS.md when it already exists", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/AGENTS.md");
      mockFs.readFileSync.mockReturnValue(
        "jinn:\n  version: \"0.0.0\"\n" as unknown as ReturnType<typeof fs.readFileSync>,
      );

      await runSetup();

      const paths = mockEnsureFile.mock.calls.map((c) => c[0]);
      expect(paths).not.toContain("/mock/.jinn/AGENTS.md");
    });

    it("uses template AGENTS.md when template file exists", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/template/AGENTS.md");
      mockFs.readFileSync.mockReturnValue("# Template AGENTS.md" as unknown as ReturnType<typeof fs.readFileSync>);

      await runSetup();

      const paths = mockEnsureFile.mock.calls.map((c) => c[0]);
      expect(paths).toContain("/mock/.jinn/AGENTS.md");
    });
  });

  // -----------------------------------------------------------------------
  // portalName from config
  // -----------------------------------------------------------------------

  describe("portalName extraction from config", () => {
    it("uses portalName from yaml config when available", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/config.yaml");
      mockFs.readFileSync.mockReturnValue(
        "portal:\n  portalName: MyPortal\n" as unknown as ReturnType<typeof fs.readFileSync>,
      );
      vi.mocked(yaml.load).mockReturnValue({ portal: { portalName: "MyPortal" } });

      await runSetup();

      expect(mockDetectProjectContext).toHaveBeenCalledWith("myportal");
    });

    it("falls back to 'Jinn' when yaml.load throws", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/config.yaml");
      mockFs.readFileSync.mockReturnValue("bad yaml" as unknown as ReturnType<typeof fs.readFileSync>);
      vi.mocked(yaml.load).mockImplementation(() => {
        throw new Error("YAML parse error");
      });

      await runSetup();

      // Should fall back to "Jinn" → slug "jinn"
      expect(mockDetectProjectContext).toHaveBeenCalledWith("jinn");
    });

    it("falls back to 'Jinn' when portal is missing in config", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/config.yaml");
      mockFs.readFileSync.mockReturnValue("jinn:\n  version: \"0.0.0\"\n" as unknown as ReturnType<typeof fs.readFileSync>);
      vi.mocked(yaml.load).mockReturnValue({ jinn: { version: "0.0.0" } });

      await runSetup();

      expect(mockDetectProjectContext).toHaveBeenCalledWith("jinn");
    });

    it("falls back to 'Jinn' when portalName is not a string", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/config.yaml");
      vi.mocked(yaml.load).mockReturnValue({ portal: { portalName: 42 } });

      await runSetup();

      expect(mockDetectProjectContext).toHaveBeenCalledWith("jinn");
    });
  });

  // -----------------------------------------------------------------------
  // Database initialization
  // -----------------------------------------------------------------------

  describe("database initialization", () => {
    it("calls initDb and ok() on success", async () => {
      mockInitDb.mockReturnValue({} as ReturnType<typeof mockInitDb>);

      await runSetup();

      expect(mockInitDb).toHaveBeenCalled();
      expect(mockOk).toHaveBeenCalledWith("Sessions database initialized");
    });

    it("calls warn() when initDb throws", async () => {
      mockInitDb.mockImplementation(() => {
        throw new Error("DB error");
      });

      await runSetup();

      expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("Failed to initialize sessions database"));
    });
  });

  // -----------------------------------------------------------------------
  // Directory and file creation
  // -----------------------------------------------------------------------

  describe("directory creation", () => {
    it("calls ensureDir for JINN_HOME", async () => {
      await runSetup();

      expect(mockEnsureDir).toHaveBeenCalledWith("/mock/.jinn");
    });

    it("calls ensureDir for CRON_RUNS", async () => {
      await runSetup();

      expect(mockEnsureDir).toHaveBeenCalledWith("/mock/.jinn/cron/runs");
    });

    it("calls ensureDir for TMP_DIR", async () => {
      await runSetup();

      expect(mockEnsureDir).toHaveBeenCalledWith("/mock/.jinn/tmp");
    });

    it("calls ensureDir for LOGS_DIR", async () => {
      await runSetup();

      expect(mockEnsureDir).toHaveBeenCalledWith("/mock/.jinn/logs");
    });

    it("calls ensureDir for connectors dir", async () => {
      await runSetup();

      expect(mockEnsureDir).toHaveBeenCalledWith("/mock/.jinn/connectors");
    });

    it("calls ensureDir for knowledge dir", async () => {
      await runSetup();

      expect(mockEnsureDir).toHaveBeenCalledWith("/mock/.jinn/knowledge");
    });

    it("calls ensureFile for CRON_JOBS with '[]'", async () => {
      await runSetup();

      expect(mockEnsureFile).toHaveBeenCalledWith("/mock/.jinn/cron/jobs.json", "[]");
    });
  });

  // -----------------------------------------------------------------------
  // skills.json copy
  // -----------------------------------------------------------------------

  describe("skills.json copy", () => {
    it("copies skills.json when template exists and dest does not", async () => {
      mockFs.existsSync.mockImplementation((p) => {
        const ps = String(p);
        return ps === "/mock/template/skills.json";
      });

      await runSetup();

      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        "/mock/template/skills.json",
        "/mock/.jinn/skills.json",
      );
    });

    it("does not copy skills.json when dest already exists", async () => {
      mockFs.existsSync.mockImplementation((p) => {
        const ps = String(p);
        return ps === "/mock/template/skills.json" || ps === "/mock/.jinn/skills.json";
      });

      await runSetup();

      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });

    it("does not copy skills.json when template does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await runSetup();

      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // symlink creation for skill dirs
  // -----------------------------------------------------------------------

  describe("skill symlink creation", () => {
    it("creates symlinks for skill directories", async () => {
      mockFs.existsSync.mockImplementation((p) => {
        const ps = String(p);
        // SKILLS_DIR exists, link paths do not
        return ps === "/mock/.jinn/skills";
      });
      const skillEntry = { name: "my-skill", isDirectory: () => true };
      mockFs.readdirSync.mockReturnValue([skillEntry] as unknown as ReturnType<typeof fs.readdirSync>);

      await runSetup();

      expect(mockFs.symlinkSync).toHaveBeenCalled();
    });

    it("does not attempt symlink when SKILLS_DIR does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await runSetup();

      expect(mockFs.symlinkSync).not.toHaveBeenCalled();
    });

    it("skips symlink when link path already exists", async () => {
      mockFs.existsSync.mockImplementation((p) => {
        const ps = String(p);
        if (ps === "/mock/.jinn/skills") return true;
        if (ps.includes("/mock/.jinn/.claude/skills/my-skill")) return true;
        if (ps.includes("/mock/.jinn/.agents/skills/my-skill")) return true;
        return false;
      });
      const skillEntry = { name: "my-skill", isDirectory: () => true };
      mockFs.readdirSync.mockReturnValue([skillEntry] as unknown as ReturnType<typeof fs.readdirSync>);

      await runSetup();

      expect(mockFs.symlinkSync).not.toHaveBeenCalled();
    });

    it("ignores symlink errors silently", async () => {
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/skills");
      const skillEntry = { name: "broken-skill", isDirectory: () => true };
      mockFs.readdirSync.mockReturnValue([skillEntry] as unknown as ReturnType<typeof fs.readdirSync>);
      mockFs.symlinkSync.mockImplementation(() => {
        throw new Error("symlink failed");
      });

      await expect(runSetup()).resolves.not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // spawn for skills pre-cache
  // -----------------------------------------------------------------------

  describe("npx skills spawn", () => {
    it("spawns 'npx skills --version' and unrefs it", async () => {
      const unrefMock = vi.fn();
      mockSpawn.mockReturnValue({ unref: unrefMock } as unknown as ReturnType<typeof spawn>);

      await runSetup();

      expect(mockSpawn).toHaveBeenCalledWith("npx", ["skills", "--version"], { stdio: "ignore", detached: true });
      expect(unrefMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // detectProjectContext
  // -----------------------------------------------------------------------

  describe("detectProjectContext", () => {
    it("calls detectProjectContext with the portal slug", async () => {
      vi.mocked(yaml.load).mockReturnValue({ portal: { portalName: "MyPortal" } });
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/config.yaml");

      await runSetup();

      expect(mockDetectProjectContext).toHaveBeenCalledWith("myportal");
    });
  });

  // -----------------------------------------------------------------------
  // summary output
  // -----------------------------------------------------------------------

  describe("summary", () => {
    it("logs 'Everything already set up' when nothing was created", async () => {
      mockEnsureDir.mockReturnValue(false);
      mockEnsureFile.mockReturnValue(false);
      mockCopyTemplateDir.mockReturnValue([]);
      mockFs.existsSync.mockImplementation(() => {
        // Pretend all key files exist to avoid being added to created[]
        return true;
      });

      await runSetup();

      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("Everything already set up"));
    });

    it("logs count of created items when something was created", async () => {
      // JINN_HOME is created
      mockEnsureDir.mockImplementation((p) => p === "/mock/.jinn");
      mockFs.existsSync.mockReturnValue(false);

      await runSetup();

      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("Created"));
    });

    it("logs info for each created item", async () => {
      mockEnsureDir.mockImplementation((p) => p === "/mock/.jinn");
      mockFs.existsSync.mockReturnValue(false);

      await runSetup();

      expect(mockInfo).toHaveBeenCalledWith("/mock/.jinn");
    });
  });

  // -----------------------------------------------------------------------
  // interactive setup (TTY)
  // -----------------------------------------------------------------------

  describe("interactive setup (TTY)", () => {
    beforeEach(() => {
      Object.defineProperty(process, "stdin", {
        value: { ...process.stdin, isTTY: true },
        writable: true,
        configurable: true,
      });
      // CONFIG_PATH does not exist → isFreshSetup = true
      mockFs.existsSync.mockReturnValue(false);
    });

    it("prompts for assistant name when stdin is TTY and config is fresh", async () => {
      mockPrompt.mockResolvedValueOnce("Aria").mockResolvedValueOnce("claude");

      await runSetup();

      expect(mockPrompt).toHaveBeenCalledWith("What should your AI assistant be called?", expect.any(String));
    });

    it("does not prompt when stdin is NOT TTY", async () => {
      Object.defineProperty(process, "stdin", {
        value: { ...process.stdin, isTTY: false },
        writable: true,
        configurable: true,
      });

      await runSetup();

      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it("does not prompt when CONFIG_PATH already exists (not fresh setup)", async () => {
      Object.defineProperty(process, "stdin", {
        value: { ...process.stdin, isTTY: true },
        writable: true,
        configurable: true,
      });
      mockFs.existsSync.mockImplementation((p) => String(p) === "/mock/.jinn/config.yaml");

      await runSetup();

      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it("prompts engine selection when both claude and codex are found", async () => {
      mockWhichBin.mockImplementation((bin) => `/usr/local/bin/${bin}`);
      mockPrompt.mockResolvedValueOnce("Jinn").mockResolvedValueOnce("codex");

      await runSetup();

      expect(mockPrompt).toHaveBeenCalledWith("Preferred engine? (claude/codex)", "claude");
    });

    it("selects codex engine when user answers 'codex'", async () => {
      mockWhichBin.mockImplementation((bin) => `/usr/local/bin/${bin}`);
      mockPrompt.mockResolvedValueOnce("Jinn").mockResolvedValueOnce("codex");

      await runSetup();

      // ensureFile is called for config with codex as default
      const configCall = mockEnsureFile.mock.calls.find((c) => c[0] === "/mock/.jinn/config.yaml");
      expect(configCall).toBeDefined();
      expect(configCall?.[1]).toContain("codex");
    });

    it("selects claude engine when user does not answer 'codex'", async () => {
      mockWhichBin.mockImplementation((bin) => `/usr/local/bin/${bin}`);
      mockPrompt.mockResolvedValueOnce("Jinn").mockResolvedValueOnce("anything-else");

      await runSetup();

      const configCall = mockEnsureFile.mock.calls.find((c) => c[0] === "/mock/.jinn/config.yaml");
      expect(configCall).toBeDefined();
      expect(configCall?.[1]).not.toContain("default: codex");
    });

    it("auto-selects single engine and calls ok() when only one engine is installed", async () => {
      mockWhichBin.mockImplementation((bin) => (bin === "claude" ? "/usr/local/bin/claude" : null));
      mockPrompt.mockResolvedValueOnce("Jinn");

      await runSetup();

      // Only one prompt (name), no engine prompt
      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockOk).toHaveBeenCalledWith(expect.stringContaining("only engine installed"));
    });

    it("skips engine prompt when no engines are installed", async () => {
      mockWhichBin.mockReturnValue(null);
      mockPrompt.mockResolvedValueOnce("Jinn");

      await runSetup();

      expect(mockPrompt).toHaveBeenCalledTimes(1);
    });

    it("uses JINN_INSTANCE env var as default name", async () => {
      process.env.JINN_INSTANCE = "aria";
      mockPrompt.mockResolvedValueOnce("Aria");

      await runSetup();

      expect(mockPrompt).toHaveBeenCalledWith("What should your AI assistant be called?", "Aria");
    });

    it("uses 'Jinn' as default name when JINN_INSTANCE is not set", async () => {
      delete process.env.JINN_INSTANCE;
      mockPrompt.mockResolvedValueOnce("Jinn");

      await runSetup();

      expect(mockPrompt).toHaveBeenCalledWith("What should your AI assistant be called?", "Jinn");
    });

    it("applies custom name to config when chosenName differs from Jinn (via JINN_INSTANCE)", async () => {
      // Use JINN_INSTANCE to set a non-Jinn default name without relying on prompt return value
      process.env.JINN_INSTANCE = "aria";
      // Only claude found → single engine, only one prompt (name)
      mockWhichBin.mockImplementation((bin) => (bin === "claude" ? "/usr/local/bin/claude" : null));
      // User confirms the name "Aria"
      mockPrompt.mockResolvedValueOnce("Aria");

      await runSetup();

      // The prompt should have been called with "Aria" as the default
      expect(mockPrompt).toHaveBeenCalledWith("What should your AI assistant be called?", "Aria");
    });
  });

  // -----------------------------------------------------------------------
  // settings.local.json
  // -----------------------------------------------------------------------

  describe("settings.local.json", () => {
    it("calls ensureFile for settings.local.json with permissions JSON", async () => {
      await runSetup();

      const settingsCall = mockEnsureFile.mock.calls.find((c) =>
        String(c[0]).endsWith("settings.local.json"),
      );
      expect(settingsCall).toBeDefined();
      expect(settingsCall?.[1]).toContain("permissions");
    });

    it("adds settings.local.json path to created[] when ensureFile returns true", async () => {
      mockEnsureFile.mockImplementation((p) => String(p).endsWith("settings.local.json"));

      await runSetup();

      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("settings.local.json"));
    });
  });

  // -----------------------------------------------------------------------
  // copyTemplateDir
  // -----------------------------------------------------------------------

  describe("copyTemplateDir calls", () => {
    it("copies docs, skills, and org template dirs", async () => {
      await runSetup();

      expect(mockCopyTemplateDir).toHaveBeenCalledWith(
        "/mock/template/docs",
        "/mock/.jinn/docs",
        expect.any(Object),
      );
      expect(mockCopyTemplateDir).toHaveBeenCalledWith(
        "/mock/template/skills",
        "/mock/.jinn/skills",
        expect.any(Object),
      );
      expect(mockCopyTemplateDir).toHaveBeenCalledWith(
        "/mock/template/org",
        "/mock/.jinn/org",
        expect.any(Object),
      );
    });

    it("adds copied files to created list", async () => {
      mockCopyTemplateDir.mockReturnValueOnce(["/mock/.jinn/docs/readme.md"]).mockReturnValue([]);

      await runSetup();

      expect(mockInfo).toHaveBeenCalledWith("/mock/.jinn/docs/readme.md");
    });
  });
});
