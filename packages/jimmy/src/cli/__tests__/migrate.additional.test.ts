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
    vi.mocked(fs.readFileSync).mockReturnValue('jinn:\n  version: "1.0.0"\n' as unknown as ReturnType<typeof fs.readFileSync>);

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
});
