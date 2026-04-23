import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to create mocks that are safely available in the factory functions
const { mockStop, mockTask, mockSchedule, mockValidate } = vi.hoisted(() => {
  const mockStop = vi.fn();
  const mockTask = { stop: mockStop };
  const mockSchedule = vi.fn(() => mockTask);
  const mockValidate = vi.fn(() => true);
  return { mockStop, mockTask, mockSchedule, mockValidate };
});

// Mock node-cron before importing the module under test
vi.mock("node-cron", () => ({
  default: {
    schedule: mockSchedule,
    validate: mockValidate,
  },
}));

// Mock jobs to avoid filesystem access
vi.mock("../jobs.js", () => ({
  loadJobs: vi.fn(),
  saveJobs: vi.fn(),
}));

// Mock runner to avoid complex dependencies
vi.mock("../runner.js", () => ({
  runCronJob: vi.fn(),
}));

// Mock logger
vi.mock("../../shared/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import type { CronJob, JinnConfig } from "../../shared/types.js";
import { loadJobs, saveJobs } from "../jobs.js";
import { reloadScheduler, setCronJobEnabled, startScheduler, stopScheduler } from "../scheduler.js";

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job-1",
    name: "Test Job",
    enabled: true,
    schedule: "0 9 * * *",
    prompt: "Do something",
    ...overrides,
  };
}

const mockSessionManager = {} as Parameters<typeof startScheduler>[1];
const mockConfig = { engines: { default: "claude" } } as unknown as JinnConfig;
const mockConnectors = new Map<string, Parameters<typeof startScheduler>[3] extends Map<string, infer V> ? V : never>();

describe("AC-E003-04: startScheduler / scheduleJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(true);
    mockSchedule.mockReturnValue(mockTask);
  });

  afterEach(() => {
    stopScheduler();
  });

  it("schedules enabled jobs with valid cron expressions", () => {
    const job = makeJob();

    startScheduler([job], mockSessionManager, mockConfig, mockConnectors);

    expect(mockValidate).toHaveBeenCalledWith(job.schedule);
    expect(mockSchedule).toHaveBeenCalledWith(job.schedule, expect.any(Function), { timezone: job.timezone });
  });

  it("skips disabled jobs", () => {
    const disabledJob = makeJob({ enabled: false });

    startScheduler([disabledJob], mockSessionManager, mockConfig, mockConnectors);

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("skips jobs with invalid cron expressions", () => {
    mockValidate.mockReturnValue(false);
    const job = makeJob({ schedule: "not-a-cron" });

    startScheduler([job], mockSessionManager, mockConfig, mockConnectors);

    expect(mockValidate).toHaveBeenCalledWith("not-a-cron");
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("schedules multiple enabled jobs", () => {
    const job1 = makeJob({ id: "job-1", name: "Job 1" });
    const job2 = makeJob({ id: "job-2", name: "Job 2", schedule: "0 18 * * *" });

    startScheduler([job1, job2], mockSessionManager, mockConfig, mockConnectors);

    expect(mockSchedule).toHaveBeenCalledTimes(2);
  });
});

describe("AC-E003-04: stopScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(true);
    mockSchedule.mockReturnValue(mockTask);
  });

  it("stops all scheduled tasks", () => {
    const job = makeJob();
    startScheduler([job], mockSessionManager, mockConfig, mockConnectors);

    stopScheduler();

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("clears the task list after stopping so a second stop is a no-op", () => {
    const job = makeJob();
    startScheduler([job], mockSessionManager, mockConfig, mockConnectors);
    stopScheduler();
    vi.clearAllMocks();

    // Second stop should not call stop again (tasks list was cleared)
    stopScheduler();
    expect(mockStop).not.toHaveBeenCalled();
  });
});

describe("AC-E003-04: reloadScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(true);
    mockSchedule.mockReturnValue(mockTask);
  });

  afterEach(() => {
    stopScheduler();
  });

  it("stops existing tasks and reschedules new jobs", () => {
    const job1 = makeJob({ id: "job-1" });
    startScheduler([job1], mockSessionManager, mockConfig, mockConnectors);
    expect(mockSchedule).toHaveBeenCalledTimes(1);

    const job2 = makeJob({ id: "job-2", schedule: "0 18 * * *" });
    reloadScheduler([job2]);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledTimes(2);
  });
});

describe("AC-E003-04: setCronJobEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(true);
    mockSchedule.mockReturnValue(mockTask);
  });

  afterEach(() => {
    stopScheduler();
  });

  it("enables a job, saves, and reloads scheduler", () => {
    const jobs = [makeJob({ enabled: false })];
    vi.mocked(loadJobs).mockReturnValue(jobs);

    const result = setCronJobEnabled("job-1", true);

    expect(saveJobs).toHaveBeenCalledWith([{ ...jobs[0], enabled: true }]);
    expect(result?.enabled).toBe(true);
  });

  it("disables a job, saves, and reloads scheduler", () => {
    const jobs = [makeJob({ enabled: true })];
    vi.mocked(loadJobs).mockReturnValue(jobs);

    const result = setCronJobEnabled("job-1", false);

    expect(saveJobs).toHaveBeenCalledWith([{ ...jobs[0], enabled: false }]);
    expect(result?.enabled).toBe(false);
  });

  it("matches job by name (case-insensitive)", () => {
    const jobs = [makeJob({ id: "job-1", name: "Test Job" })];
    vi.mocked(loadJobs).mockReturnValue(jobs);

    const result = setCronJobEnabled("TEST JOB", true);

    expect(result).toBeDefined();
    expect(result?.id).toBe("job-1");
  });

  it("returns undefined when job not found", () => {
    vi.mocked(loadJobs).mockReturnValue([]);

    const result = setCronJobEnabled("nonexistent", true);

    expect(result).toBeUndefined();
    expect(saveJobs).not.toHaveBeenCalled();
  });
});
