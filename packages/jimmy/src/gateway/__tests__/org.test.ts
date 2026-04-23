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

import { extractMention, extractMentions, findEmployee, scanOrg } from "../org.js";
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
