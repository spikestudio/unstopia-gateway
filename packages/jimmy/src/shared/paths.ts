import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Resolve the home directory for the current instance. */
function resolveHome(): string {
  if (process.env.GATEWAY_HOME) return process.env.GATEWAY_HOME;
  const instance = process.env.GATEWAY_INSTANCE || "gateway";
  return path.join(os.homedir(), `.${instance}`);
}

export const GATEWAY_HOME = resolveHome();
export const CONFIG_PATH = path.join(GATEWAY_HOME, "config.yaml");
export const SESSIONS_DB = path.join(GATEWAY_HOME, "sessions", "registry.db");
export const CRON_JOBS = path.join(GATEWAY_HOME, "cron", "jobs.json");
export const CRON_RUNS = path.join(GATEWAY_HOME, "cron", "runs");
export const ORG_DIR = path.join(GATEWAY_HOME, "org");
export const SKILLS_DIR = path.join(GATEWAY_HOME, "skills");
export const DOCS_DIR = path.join(GATEWAY_HOME, "docs");
export const LOGS_DIR = path.join(GATEWAY_HOME, "logs");
export const TMP_DIR = path.join(GATEWAY_HOME, "tmp");
export const MODELS_DIR = path.join(GATEWAY_HOME, "models");
export const STT_MODELS_DIR = path.join(GATEWAY_HOME, "models", "whisper");
export const PID_FILE = path.join(GATEWAY_HOME, "gateway.pid");
export const CLAUDE_SKILLS_DIR = path.join(GATEWAY_HOME, ".claude", "skills");
export const AGENTS_SKILLS_DIR = path.join(GATEWAY_HOME, ".agents", "skills");
export const TEMPLATE_DIR = path.join(__dirname, "..", "..", "..", "template");
export const FILES_DIR = path.join(GATEWAY_HOME, "files");
export const MIGRATIONS_DIR = path.join(GATEWAY_HOME, "migrations");
export const TEMPLATE_MIGRATIONS_DIR = path.join(TEMPLATE_DIR, "migrations");

/** Path to the global instances registry (always in default ~/.gateway/) */
export const INSTANCES_REGISTRY = path.join(os.homedir(), ".gateway", "instances.json");
