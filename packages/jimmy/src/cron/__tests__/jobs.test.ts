import { afterEach, describe, expect, it, vi } from "vitest";

// Mock node:fs before importing the module under test
vi.mock("node:fs", () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    appendFileSync: vi.fn(),
  },
}));

// Mock shared/paths to avoid filesystem side effects
vi.mock("../../shared/paths.js", () => ({
  CRON_JOBS: "/mock/.jinn/cron/jobs.json",
  CRON_RUNS: "/mock/.jinn/cron/runs",
}));

import fs from "node:fs";
import { appendRunLog, loadJobs, saveJobs } from "../jobs.js";

const mockJobs = [
  {
    id: "job-1",
    name: "Daily Report",
    enabled: true,
    schedule: "0 9 * * *",
    prompt: "Generate daily report",
  },
  {
    id: "job-2",
    name: "Hourly Check",
    enabled: false,
    schedule: "0 * * * *",
    prompt: "Check status",
  },
];

describe("AC-E003-04: loadJobs", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed jobs from the JSON file", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockJobs));

    const result = loadJobs();

    expect(fs.readFileSync).toHaveBeenCalledWith("/mock/.jinn/cron/jobs.json", "utf-8");
    expect(result).toEqual(mockJobs);
  });

  it("returns empty array when file does not exist", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const result = loadJobs();

    expect(result).toEqual([]);
  });

  it("returns empty array when file contains invalid JSON", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("not valid json{{{");

    const result = loadJobs();

    expect(result).toEqual([]);
  });
});

describe("AC-E003-04: saveJobs", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates directory and writes jobs as formatted JSON", () => {
    saveJobs(mockJobs);

    expect(fs.mkdirSync).toHaveBeenCalledWith("/mock/.jinn/cron", { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/mock/.jinn/cron/jobs.json",
      `${JSON.stringify(mockJobs, null, 2)}\n`,
      "utf-8",
    );
  });

  it("saves an empty array when no jobs provided", () => {
    saveJobs([]);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/mock/.jinn/cron/jobs.json",
      `${JSON.stringify([], null, 2)}\n`,
      "utf-8",
    );
  });
});

describe("AC-E003-04: appendRunLog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates runs directory and appends JSONL entry", () => {
    const entry = { timestamp: "2026-01-01T00:00:00.000Z", status: "success" };

    appendRunLog("job-1", entry);

    expect(fs.mkdirSync).toHaveBeenCalledWith("/mock/.jinn/cron/runs", { recursive: true });
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      "/mock/.jinn/cron/runs/job-1.jsonl",
      `${JSON.stringify(entry)}\n`,
      "utf-8",
    );
  });
});
