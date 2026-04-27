import crypto from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import path from "node:path";
import { loadJobs, saveJobs } from "../../cron/jobs.js";
import { runCronJob } from "../../cron/runner.js";
import { reloadScheduler } from "../../cron/scheduler.js";
import { logger } from "../../shared/logger.js";
import { CRON_RUNS } from "../../shared/paths.js";
import type { CronJob } from "../../shared/types.js";
import type { ApiContext } from "../types.js";
import type { CreateCronJobBody, UpdateCronJobBody } from "./api-types.js";
import { json, matchRoute, notFound, readJsonBody } from "./utils.js";

export async function handleCronRequest(
  req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  method: string,
  pathname: string,
): Promise<boolean> {
  // GET /api/cron
  if (method === "GET" && pathname === "/api/cron") {
    const jobs = loadJobs();
    // Enrich with last run status
    const enriched = jobs.map((job) => {
      const runFile = path.join(CRON_RUNS, `${job.id}.jsonl`);
      let lastRun = null;
      if (fs.existsSync(runFile)) {
        const lines = fs.readFileSync(runFile, "utf-8").trim().split("\n").filter(Boolean);
        if (lines.length > 0) {
          try {
            lastRun = JSON.parse(lines[lines.length - 1]);
          } catch {}
        }
      }
      return { ...job, lastRun };
    });
    json(res, enriched);
    return true;
  }

  // GET /api/cron/:id/runs
  let params = matchRoute("/api/cron/:id/runs", pathname);
  if (method === "GET" && params) {
    const runFile = path.join(CRON_RUNS, `${params.id}.jsonl`);
    if (!fs.existsSync(runFile)) {
      json(res, []);
      return true;
    }
    const lines = fs
      .readFileSync(runFile, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    json(res, lines);
    return true;
  }

  // POST /api/cron — create new cron job
  if (method === "POST" && pathname === "/api/cron") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as CreateCronJobBody;
    const jobs = loadJobs();
    const newJob: CronJob = {
      id: (body.id as string | undefined) || crypto.randomUUID(),
      name: (body.name as string | undefined) || "untitled",
      enabled: typeof body.enabled === "boolean" ? body.enabled : true,
      schedule: (body.schedule as string | undefined) || "0 * * * *",
      timezone: body.timezone as string | undefined,
      engine: body.engine as string | undefined,
      model: body.model as string | undefined,
      employee: body.employee as string | undefined,
      prompt: (body.prompt as string | undefined) || "",
      delivery: body.delivery as CronJob["delivery"],
    };
    jobs.push(newJob);
    saveJobs(jobs);
    reloadScheduler(jobs);
    json(res, newJob, 201);
    return true;
  }

  // PUT /api/cron/:id
  params = matchRoute("/api/cron/:id", pathname);
  if (method === "PUT" && params) {
    const jobs = loadJobs();
    const idx = jobs.findIndex((j) => j.id === params?.id);
    if (idx === -1) {
      notFound(res);
      return true;
    }
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as UpdateCronJobBody;
    jobs[idx] = { ...jobs[idx], ...body, id: params.id } as CronJob;
    saveJobs(jobs);
    reloadScheduler(jobs);
    json(res, jobs[idx]);
    return true;
  }

  // DELETE /api/cron/:id
  params = matchRoute("/api/cron/:id", pathname);
  if (method === "DELETE" && params) {
    const jobs = loadJobs();
    const idx = jobs.findIndex((j) => j.id === params?.id);
    if (idx === -1) {
      notFound(res);
      return true;
    }
    const removed = jobs.splice(idx, 1)[0];
    saveJobs(jobs);
    reloadScheduler(jobs);
    json(res, { deleted: removed.id, name: removed.name });
    return true;
  }

  // POST /api/cron/:id/trigger — manually run a cron job now
  params = matchRoute("/api/cron/:id/trigger", pathname);
  if (method === "POST" && params) {
    const jobs = loadJobs();
    const job = jobs.find((j) => j.id === params?.id);
    if (!job) {
      notFound(res);
      return true;
    }

    logger.info(`Manual trigger for cron job "${job.name}" (${job.id})`);

    // Fire and forget — respond immediately, run in background
    runCronJob(job, context.sessionManager, context.getConfig(), context.connectors).catch((err) =>
      logger.error(`Manual cron trigger failed for "${job.name}": ${err}`),
    );

    json(res, {
      triggered: true,
      jobId: job.id,
      name: job.name,
      employee: job.employee,
      message: `Cron job "${job.name}" triggered manually`,
    });
    return true;
  }

  return false;
}
