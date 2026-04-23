import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We need to mock ORG_DIR to point to a temp directory
let tmpDir: string;

vi.mock("../../shared/paths.js", () => ({
  get ORG_DIR() {
    return tmpDir;
  },
}));

vi.mock("../../shared/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { extractMention, extractMentions, findEmployee, scanOrg, updateEmployeeYaml } from "../org.js";
import type { Employee } from "../../shared/types.js";

function writeYaml(subdir: string, filename: string, content: string) {
  const dir = path.join(tmpDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content, "utf-8");
}

describe("scanOrg — alwaysNotify field", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "org-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("defaults alwaysNotify to true when not specified in YAML", () => {
    writeYaml(
      "platform",
      "dev.yaml",
      `
name: dev
persona: A developer
`,
    );
    const registry = scanOrg();
    const emp = registry.get("dev");
    expect(emp).toBeDefined();
    expect(emp?.alwaysNotify).toBe(true);
  });

  it("parses alwaysNotify: false from YAML", () => {
    writeYaml(
      "platform",
      "worker.yaml",
      `
name: worker
persona: A worker
alwaysNotify: false
`,
    );
    const registry = scanOrg();
    const emp = registry.get("worker");
    expect(emp).toBeDefined();
    expect(emp?.alwaysNotify).toBe(false);
  });

  it("parses alwaysNotify: true from YAML", () => {
    writeYaml(
      "platform",
      "lead.yaml",
      `
name: lead
persona: A lead
alwaysNotify: true
`,
    );
    const registry = scanOrg();
    const emp = registry.get("lead");
    expect(emp).toBeDefined();
    expect(emp?.alwaysNotify).toBe(true);
  });

  it("ignores non-boolean alwaysNotify values and defaults to true", () => {
    writeYaml(
      "platform",
      "bad.yaml",
      `
name: bad
persona: A bad config
alwaysNotify: "yes"
`,
    );
    const registry = scanOrg();
    const emp = registry.get("bad");
    expect(emp).toBeDefined();
    expect(emp?.alwaysNotify).toBe(true);
  });
});

// Helper to create a minimal Employee for testing pure functions
function makeEmployee(name: string, overrides: Partial<Employee> = {}): Employee {
  return {
    name,
    displayName: name,
    department: "test",
    rank: "employee",
    engine: "claude",
    model: "sonnet",
    persona: "A test employee",
    ...overrides,
  };
}

describe("findEmployee", () => {
  it("returns the employee when found", () => {
    const registry = new Map<string, Employee>();
    const emp = makeEmployee("alice");
    registry.set("alice", emp);
    expect(findEmployee("alice", registry)).toBe(emp);
  });

  it("returns undefined when not found", () => {
    const registry = new Map<string, Employee>();
    expect(findEmployee("bob", registry)).toBeUndefined();
  });

  it("returns undefined for empty registry", () => {
    expect(findEmployee("anyone", new Map())).toBeUndefined();
  });
});

describe("extractMention", () => {
  it("returns employee when text contains @name mention", () => {
    const registry = new Map<string, Employee>();
    const emp = makeEmployee("alice");
    registry.set("alice", emp);
    expect(extractMention("hey @alice can you help?", registry)).toBe(emp);
  });

  it("returns undefined when no mention matches", () => {
    const registry = new Map<string, Employee>();
    registry.set("alice", makeEmployee("alice"));
    expect(extractMention("hey bob can you help?", registry)).toBeUndefined();
  });

  it("returns undefined for empty registry", () => {
    expect(extractMention("@anyone hello", new Map())).toBeUndefined();
  });

  it("returns first matching employee when multiple could match", () => {
    const registry = new Map<string, Employee>();
    const alice = makeEmployee("alice");
    const bob = makeEmployee("bob");
    registry.set("alice", alice);
    registry.set("bob", bob);
    // Text only mentions alice
    expect(extractMention("@alice please do this", registry)).toBe(alice);
  });
});

describe("extractMentions", () => {
  it("returns empty array when no mentions match", () => {
    const registry = new Map<string, Employee>();
    registry.set("alice", makeEmployee("alice"));
    expect(extractMentions("no mentions here", registry)).toEqual([]);
  });

  it("returns all mentioned employees", () => {
    const registry = new Map<string, Employee>();
    const alice = makeEmployee("alice");
    const bob = makeEmployee("bob");
    registry.set("alice", alice);
    registry.set("bob", bob);
    const result = extractMentions("@alice and @bob please help", registry);
    expect(result).toHaveLength(2);
    expect(result).toContain(alice);
    expect(result).toContain(bob);
  });

  it("returns single employee when only one is mentioned", () => {
    const registry = new Map<string, Employee>();
    const alice = makeEmployee("alice");
    const bob = makeEmployee("bob");
    registry.set("alice", alice);
    registry.set("bob", bob);
    const result = extractMentions("@alice only", registry);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(alice);
  });

  it("returns empty array for empty registry", () => {
    expect(extractMentions("@anyone hello", new Map())).toEqual([]);
  });
});

// ── scanOrg — 未カバー分岐 ────────────────────────────────────────────────────

describe("AC-E003-03: scanOrg — branch coverage", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "org-branch-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty registry when ORG_DIR does not exist", () => {
    tmpDir = path.join(os.tmpdir(), `org-nonexistent-${Date.now()}`);
    // ORG_DIR が存在しない場合は空の Map を返す
    const registry = scanOrg();
    expect(registry.size).toBe(0);
  });

  it("recursively scans subdirectories", () => {
    // entry.isDirectory() → scan(fullPath) の再帰分岐
    writeYaml("dept/team", "worker.yaml", "name: worker\npersona: A worker\n");
    const registry = scanOrg();
    expect(registry.has("worker")).toBe(true);
  });

  it("skips department.yaml files", () => {
    // entry.name === "department.yaml" → スキップ
    writeYaml("dept", "department.yaml", "name: dept\npersona: Department\n");
    const registry = scanOrg();
    expect(registry.has("dept")).toBe(false);
  });

  it("skips YAML files missing name or persona", () => {
    // data?.name && data.persona の偽側
    writeYaml("dept", "no-persona.yaml", "name: ghost\n");
    writeYaml("dept", "no-name.yaml", "persona: Some persona\n");
    const registry = scanOrg();
    expect(registry.has("ghost")).toBe(false);
  });

  it("falls back to 'employee' rank for invalid rank values", () => {
    // rank が無効値 → "employee" fallback
    writeYaml("dept", "bad-rank.yaml", "name: badrank\npersona: P\nrank: intern\n");
    const registry = scanOrg();
    expect(registry.get("badrank")?.rank).toBe("employee");
  });

  it("accepts valid rank values (executive, manager, senior, employee)", () => {
    writeYaml("dept", "exec.yaml", "name: exec\npersona: P\nrank: executive\n");
    const registry = scanOrg();
    expect(registry.get("exec")?.rank).toBe("executive");
  });

  it("sets mcp when mcp is boolean", () => {
    // mcp フィールド（boolean）
    writeYaml("dept", "mcp-bool.yaml", "name: mcpbool\npersona: P\nmcp: true\n");
    const registry = scanOrg();
    expect(registry.get("mcpbool")?.mcp).toBe(true);
  });

  it("sets mcp when mcp is an array", () => {
    // mcp フィールド（array）
    writeYaml("dept", "mcp-arr.yaml", "name: mcparr\npersona: P\nmcp:\n  - tool1\n  - tool2\n");
    const registry = scanOrg();
    expect(registry.get("mcparr")?.mcp).toEqual(["tool1", "tool2"]);
  });

  it("sets provides when provides is a valid array", () => {
    // provides フィールド
    const yaml = `name: provtest
persona: P
provides:
  - name: foo
    description: does foo
  - name: bar
    description: does bar
`;
    writeYaml("dept", "provides.yaml", yaml);
    const registry = scanOrg();
    const emp = registry.get("provtest");
    expect(emp?.provides).toHaveLength(2);
    expect(emp?.provides?.[0]).toEqual({ name: "foo", description: "does foo" });
  });

  it("filters out provides entries missing name or description", () => {
    const yaml = `name: provfilter
persona: P
provides:
  - name: valid
    description: ok
  - name: no-desc
  - description: no-name
`;
    writeYaml("dept", "provides-filter.yaml", yaml);
    const registry = scanOrg();
    expect(registry.get("provfilter")?.provides).toHaveLength(1);
  });

  it("skips unreadable/malformed YAML files without throwing (catch branch)", () => {
    const dir = path.join(tmpDir, "dept");
    fs.mkdirSync(dir, { recursive: true });
    // 不正 YAML を書き込む
    fs.writeFileSync(path.join(dir, "broken.yaml"), "key: :\n  - broken", "utf-8");
    // valid な employee も追加してレジストリが壊れないことを確認
    writeYaml("dept", "valid.yaml", "name: valid\npersona: P\n");
    const registry = scanOrg();
    expect(registry.has("valid")).toBe(true);
  });
});

// ── updateEmployeeYaml — 追加ケース ───────────────────────────────────────────

describe("AC-E003-03: updateEmployeeYaml — additional branches", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "org-update-branch-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false when employee not found (ORG_DIR empty)", () => {
    // findEmployeeYamlPath が undefined → return false
    const result = updateEmployeeYaml("nonexistent", { alwaysNotify: false });
    expect(result).toBe(false);
  });

  it("returns true and skips alwaysNotify update when updates has no alwaysNotify", () => {
    // updates.alwaysNotify が undefined の場合 → if (typeof updates.alwaysNotify === "boolean") がスキップ
    writeYaml("dept", "emp.yaml", "name: emp\npersona: P\nalwaysNotify: true\n");
    const result = updateEmployeeYaml("emp", {});
    expect(result).toBe(true);
  });
});
