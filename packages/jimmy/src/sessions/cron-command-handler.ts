import { loadJobs } from "../cron/jobs.js";
import { setCronJobEnabled, triggerCronJob } from "../cron/scheduler.js";
import type { Connector, Target } from "../shared/types.js";

export async function handleCronCommand(
  text: string,
  connector: Connector,
  target: Target,
): Promise<boolean> {
  const [_, subcommand = "", ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();

  if (!subcommand || subcommand === "list") {
    const jobs = loadJobs();
    if (jobs.length === 0) {
      await connector.replyMessage(target, "No cron jobs configured.");
      return true;
    }

    const lines = jobs.map(
      (job) => `- ${job.name} (${job.id}) — ${job.enabled ? "enabled" : "disabled"} — ${job.schedule}`,
    );
    await connector.replyMessage(target, ["Cron jobs:", ...lines].join("\n"));
    return true;
  }

  if (subcommand === "run") {
    if (!arg) {
      await connector.replyMessage(target, "Usage: /cron run <job-id-or-name>");
      return true;
    }
    const job = await triggerCronJob(arg);
    await connector.replyMessage(target, job ? `Triggered cron job "${job.name}".` : `Cron job "${arg}" not found.`);
    return true;
  }

  if (subcommand === "enable" || subcommand === "disable") {
    if (!arg) {
      await connector.replyMessage(target, `Usage: /cron ${subcommand} <job-id-or-name>`);
      return true;
    }
    const job = setCronJobEnabled(arg, subcommand === "enable");
    await connector.replyMessage(
      target,
      job ? `Cron job "${job.name}" ${job.enabled ? "enabled" : "disabled"}.` : `Cron job "${arg}" not found.`,
    );
    return true;
  }

  await connector.replyMessage(target, "Usage: /cron [list|run|enable|disable] <job-id-or-name>");
  return true;
}
