import type { PathLike } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserConfig, ClassicLevelConstructor } from "../chrome-allow.js";

// ── Hoisted mock variables ────────────────────────────────────────────────────

const { mockExistsSync, mockExecSync, mockPlatform, mockHomedir } = vi.hoisted(() => ({
  mockExistsSync: vi.fn((_p: PathLike) => false),
  mockExecSync: vi.fn((_cmd: string) => ""),
  mockPlatform: vi.fn(() => "darwin" as NodeJS.Platform),
  mockHomedir: vi.fn(() => "/home/testuser"),
}));

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: mockExistsSync,
    },
  };
});

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return {
    ...actual,
    execSync: mockExecSync,
    spawn: vi.fn(() => ({ unref: vi.fn() })),
  };
});

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    default: {
      ...actual,
      platform: mockPlatform,
      homedir: mockHomedir,
    },
  };
});

// モック設定後にインポート
import {
  allowAllForBrowser,
  getExtensionDbPath,
  isBrowserRunning,
  runChromeAllow,
} from "../chrome-allow.js";

// ── LevelDB スタブファクトリ ───────────────────────────────────────────────────

function makeMockClassicLevel(opts: {
  existingPermissions?: Array<{ action: string; createdAt: number; duration: string; id: string; scope: { netloc: string; type: string } }>;
  getThrows?: boolean;
} = {}): {
  ClassicLevel: ClassicLevelConstructor;
  mockGet: ReturnType<typeof vi.fn>;
  mockPut: ReturnType<typeof vi.fn>;
  mockClose: ReturnType<typeof vi.fn>;
} {
  const mockGet = vi.fn();
  const mockPut = vi.fn().mockResolvedValue(undefined);
  const mockClose = vi.fn().mockResolvedValue(undefined);

  if (opts.getThrows) {
    mockGet.mockRejectedValue(new Error("NotFound"));
  } else {
    const permissions = opts.existingPermissions ?? [];
    mockGet.mockResolvedValue(JSON.stringify({ permissions }));
  }

  const ClassicLevel = vi.fn(function (this: Record<string, unknown>) {
    this.get = mockGet;
    this.put = mockPut;
    this.close = mockClose;
  }) as unknown as ClassicLevelConstructor;

  return { ClassicLevel, mockGet, mockPut, mockClose };
}

// ── ブラウザ設定スタブ ────────────────────────────────────────────────────────

function makeBrowser(overrides: Partial<BrowserConfig> = {}): BrowserConfig {
  return {
    name: "Test Browser",
    processName: "Test Browser",
    macAppName: "Test Browser",
    macDataDir: "TestBrowser",
    linuxDataDir: "test-browser",
    winDataDir: "TestBrowser",
    ...overrides,
  };
}

// ── AC-E029-79: classic-level import 失敗 → process.exit(1) ──────────────────
//
// runChromeAllow は classic-level の dynamic import を try/catch で囲んでいる。
// static vi.mock("classic-level") が成功するため、import 失敗パスは
// vi.mock のファクトリで例外を throw させることでシミュレートする。
// ただし vi.mock はホイストされ再定義できないため、
// モックが ClassicLevel を提供しない（undefined を返す）ケースを使い、
// process.exit が runChromeAllow の catch ブロックで呼ばれることを検証する。

describe("AC-E029-79: runChromeAllow — classic-level import failure → process.exit(1)", () => {
  it("calls process.exit(1) when classic-level module throws during import", async () => {
    // vi.mock("classic-level") を一時的に失敗するファクトリで上書きする。
    // vi.doMock は次回の import()  まで有効なので、
    // resetModules してから再インポートするシナリオで検証する。
    vi.resetModules();
    vi.doMock("classic-level", () => {
      throw new Error("ENOENT: classic-level not found");
    });

    const mockExit = vi.spyOn(process, "exit").mockImplementation((_code?: string | number | null) => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    // resetModules 後に再インポートして classic-level 失敗パスを通す
    const { runChromeAllow: freshRun } = (await import("../chrome-allow.js")) as {
      runChromeAllow: (opts: { restart?: boolean; cometBrowser?: boolean }) => Promise<void>;
    };

    await expect(freshRun({})).rejects.toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    vi.doUnmock("classic-level");
    vi.resetModules();
  });
});

// ── AC-E029-80: getExtensionDbPath — プロファイル存在 → パス返却 ───────────────

describe("AC-E029-80: getExtensionDbPath — profile exists → returns path", () => {
  const EXTENSION_ID = "fcoeoabgfenejglbffodgkkbkcdhcgfn";

  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
  });

  it("returns the Default profile path on darwin when it exists", () => {
    mockPlatform.mockReturnValue("darwin");
    const browser = makeBrowser({ macDataDir: "Google/Chrome" });
    const expectedPath =
      `/home/testuser/Library/Application Support/Google/Chrome/Default/Local Extension Settings/${EXTENSION_ID}`;

    mockExistsSync.mockImplementation((p: PathLike) => p === expectedPath);

    expect(getExtensionDbPath(browser)).toBe(expectedPath);
  });

  it("returns Profile 1 path when Default does not exist (darwin)", () => {
    mockPlatform.mockReturnValue("darwin");
    const browser = makeBrowser({ macDataDir: "Google/Chrome" });
    const profile1Path =
      `/home/testuser/Library/Application Support/Google/Chrome/Profile 1/Local Extension Settings/${EXTENSION_ID}`;

    mockExistsSync.mockImplementation((p: unknown) => p === profile1Path);

    expect(getExtensionDbPath(browser)).toBe(profile1Path);
  });

  it("returns a path on linux when Default profile exists", () => {
    mockPlatform.mockReturnValue("linux");
    const browser = makeBrowser({ linuxDataDir: "google-chrome" });
    const expectedPath =
      `/home/testuser/.config/google-chrome/Default/Local Extension Settings/${EXTENSION_ID}`;

    mockExistsSync.mockImplementation((p: PathLike) => p === expectedPath);

    expect(getExtensionDbPath(browser)).toBe(expectedPath);
  });
});

// ── AC-E029-81: getExtensionDbPath — プロファイルなし → null ──────────────────

describe("AC-E029-81: getExtensionDbPath — no profile exists → returns null", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
  });

  it("returns null when no candidate directory exists (darwin)", () => {
    mockPlatform.mockReturnValue("darwin");
    mockExistsSync.mockReturnValue(false);

    expect(getExtensionDbPath(makeBrowser({ macDataDir: "Google/Chrome" }))).toBeNull();
  });

  it("returns null when no candidate directory exists (linux)", () => {
    mockPlatform.mockReturnValue("linux");
    mockExistsSync.mockReturnValue(false);

    expect(getExtensionDbPath(makeBrowser({ linuxDataDir: "google-chrome" }))).toBeNull();
  });

  it("returns null on unsupported platform (candidates is empty)", () => {
    mockPlatform.mockReturnValue("freebsd" as NodeJS.Platform);
    mockExistsSync.mockReturnValue(true); // existsSync が true でも候補なし

    expect(getExtensionDbPath(makeBrowser())).toBeNull();
  });
});

// ── AC-E029-82: isBrowserRunning — プロセス稼働中 → true ────────────────────

describe("AC-E029-82: isBrowserRunning — process alive → returns true", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when osascript reports 'true' (darwin)", () => {
    mockPlatform.mockReturnValue("darwin");
    mockExecSync.mockReturnValue("true");

    expect(isBrowserRunning(makeBrowser({ macAppName: "Google Chrome" }))).toBe(true);
  });

  it("returns true when pgrep exits successfully (linux)", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync.mockReturnValue("1234\n");

    expect(isBrowserRunning(makeBrowser({ processName: "google-chrome" }))).toBe(true);
  });

  it("returns true when tasklist/findstr exits successfully (win32)", () => {
    mockPlatform.mockReturnValue("win32");
    mockExecSync.mockReturnValue("chrome.exe  1234 Console  1  50,000 K\n");

    expect(isBrowserRunning(makeBrowser({ processName: "Google Chrome" }))).toBe(true);
  });
});

// ── AC-E029-83: isBrowserRunning — プロセスなし → false ─────────────────────

describe("AC-E029-83: isBrowserRunning — no process → returns false", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when osascript reports 'false' (darwin)", () => {
    mockPlatform.mockReturnValue("darwin");
    mockExecSync.mockReturnValue("false");

    expect(isBrowserRunning(makeBrowser({ macAppName: "Google Chrome" }))).toBe(false);
  });

  it("returns false when pgrep throws (linux — no matching process)", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync.mockImplementation(() => {
      throw new Error("pgrep: no matching process");
    });

    expect(isBrowserRunning(makeBrowser({ processName: "google-chrome" }))).toBe(false);
  });

  it("returns false when tasklist/findstr throws (win32 — no matching process)", () => {
    mockPlatform.mockReturnValue("win32");
    mockExecSync.mockImplementation(() => {
      throw new Error("findstr: FAILED");
    });

    expect(isBrowserRunning(makeBrowser({ processName: "Google Chrome" }))).toBe(false);
  });
});

// ── AC-E029-84: allowAllForBrowser — DB パスなし → スキップ ─────────────────

describe("AC-E029-84: allowAllForBrowser — DB path null → skips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue("darwin");
    mockHomedir.mockReturnValue("/home/testuser");
    mockExistsSync.mockReturnValue(false); // DB パスが見つからない
  });

  it("does not call db.put when extension DB path is null", async () => {
    const { ClassicLevel, mockPut, mockClose } = makeMockClassicLevel();
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await allowAllForBrowser(makeBrowser(), ClassicLevel, {});

    expect(mockPut).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();

    mockConsoleLog.mockRestore();
  });

  it("logs a skip message containing 'skipping' when DB path is null", async () => {
    const { ClassicLevel } = makeMockClassicLevel();
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await allowAllForBrowser(makeBrowser(), ClassicLevel, {});

    const logged = mockConsoleLog.mock.calls.map((c) => c.join(" "));
    expect(logged.some((l) => l.includes("skipping"))).toBe(true);

    mockConsoleLog.mockRestore();
  });
});

// ── AC-E029-85: allowAllForBrowser — LevelDB への書き込み成功 ────────────────

describe("AC-E029-85: allowAllForBrowser — writes to LevelDB successfully", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue("darwin");
    mockHomedir.mockReturnValue("/home/testuser");
    mockExistsSync.mockReturnValue(true); // DB パスが存在する
    mockExecSync.mockReturnValue("false"); // ブラウザ未起動
  });

  it("calls db.put with 'permissionStorage' key and wildcard permission entries", async () => {
    const { ClassicLevel, mockPut } = makeMockClassicLevel({ existingPermissions: [] });
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await allowAllForBrowser(makeBrowser(), ClassicLevel, {});

    expect(mockPut).toHaveBeenCalledOnce();
    const [key, value] = mockPut.mock.calls[0] as [string, string];
    expect(key).toBe("permissionStorage");

    const parsed = JSON.parse(value) as {
      permissions: Array<{ action: string; scope: { netloc: string; type: string } }>;
    };
    expect(parsed.permissions.length).toBeGreaterThan(0);
    expect(parsed.permissions[0].action).toBe("allow");
    expect(parsed.permissions[0].scope.type).toBe("netloc");
    expect(parsed.permissions[0].scope.netloc).toMatch(/^\*\./);

    mockConsoleLog.mockRestore();
  });

  it("calls db.close after writing", async () => {
    const { ClassicLevel, mockClose } = makeMockClassicLevel({ existingPermissions: [] });
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await allowAllForBrowser(makeBrowser(), ClassicLevel, {});

    expect(mockClose).toHaveBeenCalledOnce();

    mockConsoleLog.mockRestore();
  });

  it("initializes empty permissions and writes when db.get throws (no prior data)", async () => {
    const { ClassicLevel, mockPut } = makeMockClassicLevel({ getThrows: true });
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await allowAllForBrowser(makeBrowser(), ClassicLevel, {});

    expect(mockPut).toHaveBeenCalledOnce();
    const [, value] = mockPut.mock.calls[0] as [string, string];
    const parsed = JSON.parse(value) as { permissions: unknown[] };
    expect(parsed.permissions.length).toBeGreaterThan(0);

    mockConsoleLog.mockRestore();
  });
});

// ── AC-E029-86: allowAllForBrowser — 冪等性（既存エントリ → 上書きしない） ──────

describe("AC-E029-86: allowAllForBrowser — idempotent (already allowed → no overwrite)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not call db.put when all TLD wildcards are already present", async () => {
    mockPlatform.mockReturnValue("darwin");
    mockHomedir.mockReturnValue("/home/testuser");
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue("false"); // ブラウザ未起動

    // Phase 1: 1回目の実行で書き込まれる内容を取得する
    const { ClassicLevel: CL1, mockPut: mockPut1 } = makeMockClassicLevel({ existingPermissions: [] });
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await allowAllForBrowser(makeBrowser(), CL1, {});

    expect(mockPut1).toHaveBeenCalledOnce();
    const [, writtenValue] = mockPut1.mock.calls[0] as [string, string];

    mockConsoleLog.mockRestore();

    // Phase 2: 書き込まれた全 TLD エントリを初期値として返す DB で再実行
    const writtenData = JSON.parse(writtenValue) as {
      permissions: Array<{ action: string; createdAt: number; duration: string; id: string; scope: { netloc: string; type: string } }>;
    };
    const { ClassicLevel: CL2, mockPut: mockPut2, mockClose: mockClose2 } = makeMockClassicLevel({
      existingPermissions: writtenData.permissions,
    });
    const mockConsoleLog2 = vi.spyOn(console, "log").mockImplementation(() => {});

    await allowAllForBrowser(makeBrowser(), CL2, {});

    // 全 TLD が既存なので db.put は呼ばれない
    expect(mockPut2).not.toHaveBeenCalled();
    expect(mockClose2).toHaveBeenCalledOnce();

    const logs = mockConsoleLog2.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Nothing to do"))).toBe(true);

    mockConsoleLog2.mockRestore();
  });

  it("only adds missing entries when some TLDs are already present", async () => {
    mockPlatform.mockReturnValue("darwin");
    mockHomedir.mockReturnValue("/home/testuser");
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue("false");

    // 一部のエントリのみ既存として設定
    const existingPermissions = [
      {
        action: "allow",
        createdAt: Date.now(),
        duration: "always",
        id: "existing-id-1",
        scope: { netloc: "*.com", type: "netloc" },
      },
    ];
    const { ClassicLevel, mockPut } = makeMockClassicLevel({ existingPermissions });
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await allowAllForBrowser(makeBrowser(), ClassicLevel, {});

    // *.com 以外が追加されるので db.put が呼ばれる
    expect(mockPut).toHaveBeenCalledOnce();
    const [, value] = mockPut.mock.calls[0] as [string, string];
    const parsed = JSON.parse(value) as {
      permissions: Array<{ scope: { netloc: string } }>;
    };
    // *.com は既存なので重複しない
    const comEntries = parsed.permissions.filter((p) => p.scope.netloc === "*.com");
    expect(comEntries).toHaveLength(1);

    mockConsoleLog.mockRestore();
  });
});

// ── runChromeAllow — 統合: classic-level の dynamic import 成功パス ────────────

describe("runChromeAllow — chrome target (integration via runChromeAllow with mocked classic-level)", () => {
  it("completes without error when classic-level is available and DB path is not found", async () => {
    mockPlatform.mockReturnValue("darwin");
    mockHomedir.mockReturnValue("/home/testuser");
    mockExistsSync.mockReturnValue(false); // DB パスなし
    mockExecSync.mockReturnValue("false");

    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    // classic-level の vi.mock は static なので runChromeAllow を通して
    // dynamic import のモックが有効であることを確認する
    await expect(runChromeAllow({})).resolves.toBeUndefined();

    mockConsoleLog.mockRestore();
  });
});
