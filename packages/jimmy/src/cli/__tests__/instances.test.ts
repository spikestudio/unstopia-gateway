import { beforeEach, describe, expect, it, vi } from "vitest";

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
    },
  };
});

vi.mock("../../shared/paths.js", () => ({
  INSTANCES_REGISTRY: "/home/user/.jinn/instances.json",
}));

import fs from "node:fs";
import { ensureDefaultInstance, findInstance, loadInstances, nextAvailablePort, saveInstances } from "../instances.js";

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockMkdirSync = vi.mocked(fs.mkdirSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);

describe("loadInstances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return [] when instances registry file does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = loadInstances();

    expect(result).toEqual([]);
  });

  it("should return parsed array when file contains valid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    const instances = [{ name: "jinn", port: 7777, home: "/home/user/.jinn", createdAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(instances) as unknown as ReturnType<typeof fs.readFileSync>);

    const result = loadInstances();

    expect(result).toEqual(instances);
  });

  it("should return [] when file contains invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not valid json" as unknown as ReturnType<typeof fs.readFileSync>);

    const result = loadInstances();

    expect(result).toEqual([]);
  });
});

describe("saveInstances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call mkdirSync and writeFileSync when saving instances", () => {
    const instances = [{ name: "jinn", port: 7777, home: "/home/user/.jinn", createdAt: "2024-01-01T00:00:00.000Z" }];

    saveInstances(instances);

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "/home/user/.jinn/instances.json",
      `${JSON.stringify(instances, null, 2)}\n`,
    );
  });
});

describe("nextAvailablePort", () => {
  it("should return 7777 when no instances exist", () => {
    const result = nextAvailablePort([]);

    expect(result).toBe(7777);
  });

  it("should return 7778 when port 7777 is already used", () => {
    const instances = [{ name: "jinn", port: 7777, home: "/home/user/.jinn", createdAt: "2024-01-01T00:00:00.000Z" }];

    const result = nextAvailablePort(instances);

    expect(result).toBe(7778);
  });
});

describe("ensureDefaultInstance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should NOT call saveInstances when 'jinn' instance already exists", () => {
    mockExistsSync.mockReturnValue(true);
    const instances = [{ name: "jinn", port: 7777, home: "/home/user/.jinn", createdAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(instances) as unknown as ReturnType<typeof fs.readFileSync>);

    ensureDefaultInstance();

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("should prepend 'jinn' instance when it is missing from instances list", () => {
    mockExistsSync.mockReturnValue(true);
    const instances = [
      { name: "other", port: 7778, home: "/home/user/.other", createdAt: "2024-01-01T00:00:00.000Z" },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(instances) as unknown as ReturnType<typeof fs.readFileSync>);

    ensureDefaultInstance();

    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    const saved = JSON.parse(written);
    expect(saved[0].name).toBe("jinn");
    expect(saved[0].port).toBe(7777);
  });
});

describe("findInstance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the matching instance when searching for 'jinn'", () => {
    mockExistsSync.mockReturnValue(true);
    const jinnInstance = { name: "jinn", port: 7777, home: "/home/user/.jinn", createdAt: "2024-01-01T00:00:00.000Z" };
    const instances = [jinnInstance, { name: "other", port: 7778, home: "/home/user/.other", createdAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(instances) as unknown as ReturnType<typeof fs.readFileSync>);

    const result = findInstance("jinn");

    expect(result).toEqual(jinnInstance);
  });

  it("should return undefined when instance name does not exist", () => {
    mockExistsSync.mockReturnValue(true);
    const instances = [{ name: "jinn", port: 7777, home: "/home/user/.jinn", createdAt: "2024-01-01T00:00:00.000Z" }];
    mockReadFileSync.mockReturnValue(JSON.stringify(instances) as unknown as ReturnType<typeof fs.readFileSync>);

    const result = findInstance("nonexistent");

    expect(result).toBeUndefined();
  });
});
