import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// paths モジュールの CONFIG_PATH と TEMPLATE_DIR を tmpDir に向ける
// getters を使うことで beforeEach で設定した値が実行時に参照される
let tmpDir: string;
let configPath: string;
let templateDir: string;

vi.mock("../paths.js", () => ({
  get CONFIG_PATH() {
    return configPath;
  },
  get TEMPLATE_DIR() {
    return templateDir;
  },
}));

import { compareSemver, getInstanceVersion, getPackageVersion, getPendingMigrations } from "../version.js";

// ── compareSemver（純粋関数） ─────────────────────────────────────────────────

describe("AC-E003-03: compareSemver", () => {
  it("returns negative when a < b (major)", () => {
    expect(compareSemver("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  it("returns positive when a > b (major)", () => {
    expect(compareSemver("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("returns 0 when a === b", () => {
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });

  it("compares minor version correctly", () => {
    expect(compareSemver("1.3.0", "1.2.9")).toBeGreaterThan(0);
    expect(compareSemver("1.2.0", "1.3.0")).toBeLessThan(0);
  });

  it("compares patch version correctly", () => {
    expect(compareSemver("1.2.3", "1.2.4")).toBeLessThan(0);
    expect(compareSemver("1.2.4", "1.2.3")).toBeGreaterThan(0);
  });

  it("treats missing segments as 0 (2-part version)", () => {
    // "1.0".split(".").map(Number) = [1, 0] → pa[2] ?? 0 = 0
    expect(compareSemver("1.0", "1.0.0")).toBe(0);
  });
});

// ── getPackageVersion ─────────────────────────────────────────────────────────

describe("AC-E003-03: getPackageVersion", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-pkg-test-"));
    templateDir = path.join(tmpDir, "template");
    configPath = path.join(tmpDir, "config.yaml");
    fs.mkdirSync(templateDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads version from package.json (TEMPLATE_DIR/../package.json)", () => {
    // pkgPath = path.join(TEMPLATE_DIR, "..", "package.json") = tmpDir/package.json
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ version: "3.1.4" }), "utf-8");
    expect(getPackageVersion()).toBe("3.1.4");
  });
});

// ── getInstanceVersion ────────────────────────────────────────────────────────

describe("AC-E003-03: getInstanceVersion", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-inst-test-"));
    configPath = path.join(tmpDir, "config.yaml");
    templateDir = path.join(tmpDir, "template");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns '0.0.0' when config file does not exist", () => {
    // configPath は存在しない
    expect(getInstanceVersion()).toBe("0.0.0");
  });

  it("returns the version from config.yaml when meta.version is set", () => {
    fs.writeFileSync(configPath, "meta:\n  version: 1.5.0\n", "utf-8");
    expect(getInstanceVersion()).toBe("1.5.0");
  });

  it("returns '0.0.0' when config.yaml has meta section but no version key", () => {
    fs.writeFileSync(configPath, "meta:\n  name: test\n", "utf-8");
    expect(getInstanceVersion()).toBe("0.0.0");
  });

  it("returns '0.0.0' when gateway is not an object (string value)", () => {
    fs.writeFileSync(configPath, "meta: just_a_string\n", "utf-8");
    expect(getInstanceVersion()).toBe("0.0.0");
  });

  it("returns '0.0.0' on YAML parse error (catch branch)", () => {
    // 不正な YAML を書き込む
    fs.writeFileSync(configPath, "key: :\n  - broken\nyaml", "utf-8");
    expect(getInstanceVersion()).toBe("0.0.0");
  });

  it("returns '0.0.0' when meta.version is null (line 32 ?? branch)", () => {
    // meta.version が null の場合 → ?? "0.0.0" が使われる
    fs.writeFileSync(configPath, "meta:\n  version: null\n", "utf-8");
    expect(getInstanceVersion()).toBe("0.0.0");
  });
});

// ── getPendingMigrations ──────────────────────────────────────────────────────

describe("AC-E003-03: getPendingMigrations", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-mig-test-"));
    templateDir = path.join(tmpDir, "template");
    configPath = path.join(tmpDir, "config.yaml");
    fs.mkdirSync(templateDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns [] when migrations directory does not exist", () => {
    // template/migrations ディレクトリを作らない
    expect(getPendingMigrations("0.0.0", "1.0.0")).toEqual([]);
  });

  it("returns migrations sorted ascending within range", () => {
    const migrationsDir = path.join(templateDir, "migrations");
    for (const v of ["0.5.0", "1.0.0", "0.2.0"]) {
      fs.mkdirSync(path.join(migrationsDir, v), { recursive: true });
    }
    expect(getPendingMigrations("0.1.0", "1.0.0")).toEqual(["0.2.0", "0.5.0", "1.0.0"]);
  });

  it("excludes fromVersion (exclusive lower bound)", () => {
    const migrationsDir = path.join(templateDir, "migrations");
    fs.mkdirSync(path.join(migrationsDir, "0.1.0"), { recursive: true });
    fs.mkdirSync(path.join(migrationsDir, "0.2.0"), { recursive: true });
    // fromVersion=0.1.0 は除外される
    expect(getPendingMigrations("0.1.0", "1.0.0")).toEqual(["0.2.0"]);
  });

  it("includes toVersion (inclusive upper bound)", () => {
    const migrationsDir = path.join(templateDir, "migrations");
    fs.mkdirSync(path.join(migrationsDir, "1.0.0"), { recursive: true });
    fs.mkdirSync(path.join(migrationsDir, "1.1.0"), { recursive: true });
    // toVersion=1.0.0 は含まれる。1.1.0 は超過なので除外
    expect(getPendingMigrations("0.0.0", "1.0.0")).toEqual(["1.0.0"]);
  });

  it("ignores non-semver directory names", () => {
    const migrationsDir = path.join(templateDir, "migrations");
    fs.mkdirSync(path.join(migrationsDir, "0.5.0"), { recursive: true });
    fs.mkdirSync(path.join(migrationsDir, "not-semver"), { recursive: true });
    fs.mkdirSync(path.join(migrationsDir, "v1.0.0"), { recursive: true });
    expect(getPendingMigrations("0.0.0", "1.0.0")).toEqual(["0.5.0"]);
  });

  it("ignores files (only counts directories)", () => {
    const migrationsDir = path.join(templateDir, "migrations");
    fs.mkdirSync(path.join(migrationsDir, "0.5.0"), { recursive: true });
    // ファイルとして 0.6.0 を置く（ディレクトリではない）
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(path.join(migrationsDir, "0.6.0"), "not a dir", "utf-8");
    expect(getPendingMigrations("0.0.0", "1.0.0")).toEqual(["0.5.0"]);
  });
});
