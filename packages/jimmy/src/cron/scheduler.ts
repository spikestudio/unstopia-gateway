import cron, { type ScheduledTask } from "node-cron";
import { logger } from "../shared/logger.js";
import type { Connector, CronJob, GatewayConfig, SessionRouter } from "../shared/types.js";
import { loadJobs, saveJobs } from "./jobs.js";
import { runCronJob } from "./runner.js";

let tasks: ScheduledTask[] = [];
let currentSessionRouter: SessionRouter;
let currentConfig: GatewayConfig;
let currentConnectors: Map<string, Connector>;

export function startScheduler(
  jobs: CronJob[],
  sessionManager: SessionRouter,
  config: GatewayConfig,
  connectors: Map<string, Connector>,
): void {
  currentSessionRouter = sessionManager;
  currentConfig = config;
  currentConnectors = connectors;
  scheduleJobs(jobs);
}

export function reloadScheduler(jobs: CronJob[]): void {
  stopScheduler();
  scheduleJobs(jobs);
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
}

function scheduleJobs(jobs: CronJob[]): void {
  for (const job of jobs) {
    if (!job.enabled) continue;
    if (!cron.validate(job.schedule)) {
      logger.warn(`Invalid cron schedule for job "${job.name}": ${job.schedule}`);
      continue;
    }
    const task = cron.schedule(
      job.schedule,
      () => {
        runCronJob(job, currentSessionRouter, currentConfig, currentConnectors);
      },
      { timezone: job.timezone },
    );
    tasks.push(task);
    logger.info(`Scheduled cron job "${job.name}" (${job.schedule})`);
  }
}

export async function triggerCronJob(idOrName: string): Promise<CronJob | undefined> {
  const job = findJob(idOrName);
  if (!job) return undefined;
  await runCronJob(job, currentSessionRouter, currentConfig, currentConnectors);
  return job;
}

export function setCronJobEnabled(idOrName: string, enabled: boolean): CronJob | undefined {
  const jobs = loadJobs();
  const index = jobs.findIndex((job) => matchesJob(job, idOrName));
  if (index === -1) return undefined;
  jobs[index] = { ...jobs[index], enabled };
  saveJobs(jobs);
  reloadScheduler(jobs);
  return jobs[index];
}

function findJob(idOrName: string): CronJob | undefined {
  return loadJobs().find((job) => matchesJob(job, idOrName));
}

function matchesJob(job: CronJob, idOrName: string): boolean {
  const needle = idOrName.trim().toLowerCase();
  return job.id.toLowerCase() === needle || job.name.toLowerCase() === needle;
}
