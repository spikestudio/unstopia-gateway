import fs from "node:fs";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import path from "node:path";
import yaml from "js-yaml";
import { loadInstances } from "../../cli/instances.js";
import { initDb, listSessions } from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import { CONFIG_PATH, JINN_HOME, LOGS_DIR, ORG_DIR } from "../../shared/paths.js";
import { handleFilesRequest } from "../files.js";
import type { ApiContext } from "../types.js";
import { badRequest, checkInstanceHealth, deepMerge, json, matchRoute, notFound, readJsonBody } from "./utils.js";

export async function handleMiscRequest(
  req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  method: string,
  pathname: string,
  url: URL,
): Promise<boolean> {
  // GET /api/status
  if (method === "GET" && pathname === "/api/status") {
    const config = context.getConfig();
    const sessions = listSessions();
    const running = sessions.filter((s) => s.status === "running").length;
    const connectors = Object.fromEntries(
      Array.from(context.connectors.values()).map((connector) => [connector.name, connector.getHealth()]),
    );
    json(res, {
      status: "ok",
      uptime: Math.floor((Date.now() - context.startTime) / 1000),
      port: config.gateway.port || 7777,
      engines: {
        default: config.engines.default,
        claude: { model: config.engines.claude.model, available: true },
        codex: { model: config.engines.codex.model, available: true },
        ...(config.engines.gemini ? { gemini: { model: config.engines.gemini.model, available: true } } : {}),
      },
      sessions: { total: sessions.length, running, active: running },
      connectors,
    });
    return true;
  }

  // GET /api/instances
  if (method === "GET" && pathname === "/api/instances") {
    const instances = loadInstances();
    const currentPort = context.getConfig().gateway.port || 7777;
    const results = await Promise.all(
      instances.map(async (inst) => ({
        name: inst.name,
        port: inst.port,
        running: inst.port === currentPort ? true : await checkInstanceHealth(inst.port),
        current: inst.port === currentPort,
      })),
    );
    json(res, results);
    return true;
  }

  // GET /api/config
  if (method === "GET" && pathname === "/api/config") {
    const config = context.getConfig();
    // Sanitize: remove any secrets/tokens from connectors
    const rawConnectors = config.connectors || {};
    const sanitizedConnectors: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawConnectors)) {
      if (k === "instances" && Array.isArray(v)) {
        sanitizedConnectors.instances = v.map((inst: unknown) => {
          const i = inst as Record<string, unknown>;
          return {
            ...i,
            token: i?.token ? "***" : undefined,
            signingSecret: i?.signingSecret ? "***" : undefined,
            botToken: i?.botToken ? "***" : undefined,
            appToken: i?.appToken ? "***" : undefined,
          };
        });
      } else if (v && typeof v === "object") {
        const vObj = v as Record<string, unknown>;
        sanitizedConnectors[k] = {
          ...vObj,
          token: vObj.token ? "***" : undefined,
          signingSecret: vObj.signingSecret ? "***" : undefined,
          botToken: vObj.botToken ? "***" : undefined,
          appToken: vObj.appToken ? "***" : undefined,
        };
      } else {
        sanitizedConnectors[k] = v;
      }
    }
    const sanitized = {
      ...config,
      connectors: sanitizedConnectors,
    };
    json(res, sanitized);
    return true;
  }

  // PUT /api/config
  if (method === "PUT" && pathname === "/api/config") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;
    // Basic validation: must be a plain object
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      badRequest(res, "Config must be a JSON object");
      return true;
    }
    // Validate known top-level keys
    // Keep this aligned with `JinnConfig` in src/shared/types.ts
    const KNOWN_KEYS = [
      "jinn",
      "gateway",
      "engines",
      "connectors",
      "logging",
      "mcp",
      "sessions",
      "cron",
      "notifications",
      "portal",
      "context",
      "stt",
      "skills",
      "remotes",
    ];
    const unknownKeys = Object.keys(body).filter((k) => !KNOWN_KEYS.includes(k));
    if (unknownKeys.length > 0) {
      badRequest(res, `Unknown config keys: ${unknownKeys.join(", ")}`);
      return true;
    }
    // Validate critical field types
    if (body.gateway !== undefined) {
      if (typeof body.gateway !== "object" || Array.isArray(body.gateway) || body.gateway === null) {
        badRequest(res, "gateway must be an object");
        return true;
      }
      const gateway = body.gateway as Record<string, unknown>;
      if (gateway.port !== undefined && typeof gateway.port !== "number") {
        badRequest(res, "gateway.port must be a number");
        return true;
      }
    }
    if (body.engines !== undefined && (typeof body.engines !== "object" || Array.isArray(body.engines))) {
      badRequest(res, "engines must be an object");
      return true;
    }
    // Deep-merge incoming config with existing config to preserve
    // fields not included in the update (e.g. connector tokens).
    let existing: Record<string, unknown> = {};
    try {
      existing = (yaml.load(fs.readFileSync(CONFIG_PATH, "utf-8")) as Record<string, unknown>) || {};
    } catch {
      /* start fresh if unreadable */
    }
    const merged = deepMerge(existing, body);
    const yamlStr = yaml.dump(merged);
    fs.writeFileSync(CONFIG_PATH, yamlStr);
    logger.info("Config updated via API");
    json(res, { status: "ok" });
    return true;
  }

  // GET /api/logs
  if (method === "GET" && pathname === "/api/logs") {
    const logFile = path.join(LOGS_DIR, "gateway.log");
    if (!fs.existsSync(logFile)) {
      json(res, { lines: [] });
      return true;
    }
    const n = parseInt(url.searchParams.get("n") || "100", 10);
    // Read only the last 64KB to avoid loading the entire file into memory
    const MAX_BYTES = 64 * 1024;
    const stat = fs.statSync(logFile);
    const readSize = Math.min(stat.size, MAX_BYTES);
    const fd = fs.openSync(logFile, "r");
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    const allLines = buf.toString("utf-8").split("\n").filter(Boolean);
    const lines = allLines.slice(-n);
    json(res, { lines });
    return true;
  }

  // GET /api/activity — recent activity derived from sessions
  if (method === "GET" && pathname === "/api/activity") {
    const sessions = listSessions();
    const events: Array<{ event: string; payload: unknown; ts: number }> = [];
    for (const s of sessions) {
      const ts = new Date(s.lastActivity || s.createdAt).getTime();
      const transportState = context.sessionManager.getQueue().getTransportState(s.sessionKey || s.sourceRef, s.status);
      if (transportState === "running") {
        events.push({
          event: "session:started",
          payload: { sessionId: s.id, employee: s.employee, engine: s.engine, connector: s.connector },
          ts,
        });
      } else if (transportState === "queued") {
        events.push({
          event: "session:queued",
          payload: { sessionId: s.id, employee: s.employee, engine: s.engine, connector: s.connector },
          ts,
        });
      } else if (transportState === "idle") {
        events.push({
          event: "session:completed",
          payload: { sessionId: s.id, employee: s.employee, engine: s.engine, connector: s.connector },
          ts,
        });
      } else if (transportState === "error") {
        events.push({
          event: "session:error",
          payload: { sessionId: s.id, employee: s.employee, error: s.lastError, connector: s.connector },
          ts,
        });
      }
    }
    events.sort((a, b) => b.ts - a.ts);
    json(res, events.slice(0, 30));
    return true;
  }

  // GET /api/onboarding — check if onboarding is needed
  if (method === "GET" && pathname === "/api/onboarding") {
    const sessions = listSessions();
    const hasEmployees =
      fs.existsSync(ORG_DIR) &&
      fs
        .readdirSync(ORG_DIR, { recursive: true })
        .some((f) => String(f).endsWith(".yaml") && !String(f).endsWith("department.yaml"));
    const config = context.getConfig();
    const onboarded = config.portal?.onboarded === true;
    json(res, {
      needed: !onboarded && sessions.length === 0 && !hasEmployees,
      onboarded,
      sessionsCount: sessions.length,
      hasEmployees,
      portalName: config.portal?.portalName ?? null,
      operatorName: config.portal?.operatorName ?? null,
    });
    return true;
  }

  // POST /api/onboarding — persist portal personalization
  if (method === "POST" && pathname === "/api/onboarding") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;
    const { portalName, operatorName, language } = body;

    // Read current config and merge portal settings
    const config = context.getConfig();
    const updated = {
      ...config,
      portal: {
        ...config.portal,
        onboarded: true,
        ...(portalName !== undefined && { portalName: portalName || undefined }),
        ...(operatorName !== undefined && { operatorName: operatorName || undefined }),
        ...(language !== undefined && { language: language || undefined }),
      },
    };

    // Write updated config
    const yamlStr = yaml.dump(updated, { lineWidth: -1 });
    fs.writeFileSync(CONFIG_PATH, yamlStr);
    logger.info(`Onboarding: portal name="${portalName}", operator="${operatorName}", language="${language}"`);

    const effectiveName = portalName || "Jinn";
    const languageSection =
      language && language !== "English"
        ? `\n\n## Language\nAlways respond in ${language}. All communication with the user must be in ${language}.`
        : "";

    // Update CLAUDE.md with personalized COO name and language
    const claudeMdPath = path.join(JINN_HOME, "CLAUDE.md");
    if (fs.existsSync(claudeMdPath)) {
      let claudeMd = fs.readFileSync(claudeMdPath, "utf-8");
      // Replace the identity line in CLAUDE.md
      claudeMd = claudeMd.replace(
        /^You are \w+, the COO of the user's AI organization\.$/m,
        `You are ${effectiveName}, the COO of the user's AI organization.`,
      );
      // Remove existing language section if present, then add new one if needed
      claudeMd = claudeMd.replace(
        /\n\n## Language\nAlways respond in .+\. All communication with the user must be in .+\./m,
        "",
      );
      if (languageSection) {
        claudeMd = `${claudeMd.trimEnd() + languageSection}\n`;
      }
      fs.writeFileSync(claudeMdPath, claudeMd);
    }

    // Update AGENTS.md with personalized name and language
    const agentsMdPath = path.join(JINN_HOME, "AGENTS.md");
    if (fs.existsSync(agentsMdPath)) {
      let agentsMd = fs.readFileSync(agentsMdPath, "utf-8");
      // Replace the bold identity line (e.g. "You are **Jinn**")
      agentsMd = agentsMd.replace(/You are \*\*\w+\*\*/, `You are **${effectiveName}**`);
      // Remove existing language section if present, then add new one if needed
      agentsMd = agentsMd.replace(
        /\n\n## Language\nAlways respond in .+\. All communication with the user must be in .+\./m,
        "",
      );
      if (languageSection) {
        agentsMd = `${agentsMd.trimEnd() + languageSection}\n`;
      }
      fs.writeFileSync(agentsMdPath, agentsMd);
    }

    context.emit("config:updated", { portal: updated.portal });
    json(res, { status: "ok", portal: updated.portal });
    return true;
  }

  // /api/files — file upload/download/management
  if (pathname.startsWith("/api/files")) {
    const handled = await handleFilesRequest(req, res, pathname, method, context);
    if (handled) return true;
  }

  // ── Goals ────────────────────────────────────────────────────────
  // GET /api/goals
  if (method === "GET" && pathname === "/api/goals") {
    const { listGoals } = await import("../goals.js");
    const db = initDb();
    json(res, listGoals(db));
    return true;
  }

  // GET /api/goals/tree
  if (method === "GET" && pathname === "/api/goals/tree") {
    const { getGoalTree } = await import("../goals.js");
    const db = initDb();
    json(res, getGoalTree(db));
    return true;
  }

  // POST /api/goals
  if (method === "POST" && pathname === "/api/goals") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const { createGoal } = await import("../goals.js");
    const db = initDb();
    const goal = createGoal(db, _parsed.body as Record<string, unknown>);
    json(res, goal, 201);
    return true;
  }

  // GET /api/goals/:id
  let params = matchRoute("/api/goals/:id", pathname);
  if (method === "GET" && params) {
    const { getGoal } = await import("../goals.js");
    const db = initDb();
    const goal = getGoal(db, params.id);
    if (!goal) {
      notFound(res);
      return true;
    }
    json(res, goal);
    return true;
  }

  // PUT /api/goals/:id
  params = matchRoute("/api/goals/:id", pathname);
  if (method === "PUT" && params) {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const { updateGoal } = await import("../goals.js");
    const db = initDb();
    const goal = updateGoal(db, params.id, _parsed.body as Record<string, unknown>);
    if (!goal) {
      notFound(res);
      return true;
    }
    json(res, goal);
    return true;
  }

  // DELETE /api/goals/:id
  params = matchRoute("/api/goals/:id", pathname);
  if (method === "DELETE" && params) {
    const { deleteGoal } = await import("../goals.js");
    const db = initDb();
    deleteGoal(db, params.id);
    json(res, { status: "ok" });
    return true;
  }

  // ── Costs ────────────────────────────────────────────────────────
  // GET /api/costs/summary
  if (method === "GET" && pathname === "/api/costs/summary") {
    const { getCostSummary } = await import("../costs.js");
    const rawPeriod = url.searchParams.get("period") ?? "month";
    const period = rawPeriod === "day" || rawPeriod === "week" || rawPeriod === "month" ? rawPeriod : "month";
    json(res, getCostSummary(period));
    return true;
  }

  // GET /api/costs/by-employee
  if (method === "GET" && pathname === "/api/costs/by-employee") {
    const { getCostsByEmployee } = await import("../costs.js");
    const rawPeriod = url.searchParams.get("period") ?? "month";
    const period = rawPeriod === "week" ? "week" : "month";
    json(res, getCostsByEmployee(period));
    return true;
  }

  // ── Budgets ──────────────────────────────────────────────────────
  // GET /api/budgets
  if (method === "GET" && pathname === "/api/budgets") {
    const { getBudgetStatus } = await import("../budgets.js");
    const config = context.getConfig();
    const configRecord = config as unknown as Record<string, unknown>;
    const budgets = configRecord.budgets as Record<string, unknown> | undefined;
    const budgetConfig = (budgets?.employees as Record<string, number> | undefined) ?? {};
    const employees = Object.keys(budgetConfig);
    const statuses = employees.map((emp) => ({
      employee: emp,
      ...getBudgetStatus(emp, budgetConfig),
    }));
    json(res, { employees: budgetConfig, statuses });
    return true;
  }

  // PUT /api/budgets
  if (method === "PUT" && pathname === "/api/budgets") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;
    let existing: Record<string, unknown> = {};
    try {
      existing = (yaml.load(fs.readFileSync(CONFIG_PATH, "utf-8")) as Record<string, unknown>) || {};
    } catch {
      /* start fresh if unreadable */
    }
    const merged = deepMerge(existing, { budgets: { employees: body } });
    fs.writeFileSync(CONFIG_PATH, yaml.dump(merged));
    logger.info("Budget limits updated via API");
    json(res, { status: "ok" });
    return true;
  }

  // POST /api/budgets/:employee/override
  params = matchRoute("/api/budgets/:employee/override", pathname);
  if (method === "POST" && params) {
    const { overrideBudget } = await import("../budgets.js");
    const config = context.getConfig();
    const configRecord2 = config as unknown as Record<string, unknown>;
    const budgets2 = configRecord2.budgets as Record<string, unknown> | undefined;
    const budgetConfig = (budgets2?.employees as Record<string, number> | undefined) ?? {};
    json(res, overrideBudget(params.employee, budgetConfig));
    return true;
  }

  // GET /api/budgets/events
  if (method === "GET" && pathname === "/api/budgets/events") {
    const { getBudgetEvents } = await import("../budgets.js");
    json(res, getBudgetEvents());
    return true;
  }

  return false;
}
