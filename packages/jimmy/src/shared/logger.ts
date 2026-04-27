import fs from "node:fs";
import path from "node:path";
import { LOGS_DIR } from "./paths.js";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LEVELS;

export interface LogContext {
  sessionId?: string;
  connector?: string;
  engine?: string;
  [key: string]: string | number | boolean | undefined;
}

let minLevel: LogLevel = "info";
let writeToStdout = true;
let logStream: fs.WriteStream | null = null;
let jsonMode = false;

export function configureLogger(opts: { level?: string; stdout?: boolean; file?: boolean; json?: boolean }) {
  if (opts.level && opts.level in LEVELS) minLevel = opts.level as LogLevel;
  if (opts.stdout !== undefined) writeToStdout = opts.stdout;
  if (opts.json !== undefined) jsonMode = opts.json;
  if (opts.file !== false) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    logStream = fs.createWriteStream(path.join(LOGS_DIR, "gateway.log"), {
      flags: "a",
    });
  }
}

function log(level: LogLevel, message: string, ctx?: LogContext) {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  let line: string;
  if (jsonMode) {
    const entry: Record<string, unknown> = {
      level,
      timestamp: new Date().toISOString(),
      message,
    };
    if (ctx) {
      for (const [k, v] of Object.entries(ctx)) {
        if (v !== undefined) entry[k] = v;
      }
    }
    line = JSON.stringify(entry);
  } else {
    line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  }
  if (writeToStdout) process.stdout.write(`${line}\n`);
  if (logStream) logStream.write(`${line}\n`);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
};
