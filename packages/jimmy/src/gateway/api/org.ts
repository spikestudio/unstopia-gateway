import fs from "node:fs";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import path from "node:path";
import { createSession, insertMessage } from "../../sessions/registry.js";
import { logger } from "../../shared/logger.js";
import { ORG_DIR } from "../../shared/paths.js";
import type { ApiContext } from "../types.js";
import type { CrossRequestBody, PatchEmployeeBody, PutBoardBody } from "./api-types.js";
import { badRequest, json, matchRoute, notFound, readJsonBody } from "./utils.js";

export async function handleOrgRequest(
  req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  method: string,
  pathname: string,
): Promise<boolean> {
  // GET /api/org
  if (method === "GET" && pathname === "/api/org") {
    if (!fs.existsSync(ORG_DIR)) {
      json(res, { departments: [], employees: [], hierarchy: { root: null, sorted: [], warnings: [] } });
      return true;
    }
    const entries = fs.readdirSync(ORG_DIR, { withFileTypes: true });
    const departments = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    const { scanOrg } = await import("../org.js");
    const { resolveOrgHierarchy } = await import("../org-hierarchy.js");
    const orgRegistry = scanOrg();
    const hierarchy = resolveOrgHierarchy(orgRegistry);

    const employees = hierarchy.sorted.map((name) => {
      const node = hierarchy.nodes[name];
      const emp = node.employee;
      const { persona, ...rest } = emp;
      return {
        ...rest,
        parentName: node.parentName,
        directReports: node.directReports,
        depth: node.depth,
        chain: node.chain,
      };
    });

    json(res, {
      departments,
      employees,
      hierarchy: {
        root: hierarchy.root,
        sorted: hierarchy.sorted,
        warnings: hierarchy.warnings,
      },
    });
    return true;
  }

  // GET /api/org/services — list all cross-department services
  if (method === "GET" && pathname === "/api/org/services") {
    const { scanOrg } = await import("../org.js");
    const { buildServiceRegistry } = await import("../services.js");
    const orgRegistry = scanOrg();
    const services = buildServiceRegistry(orgRegistry);
    const result = Array.from(services.values()).map((entry) => ({
      name: entry.declaration.name,
      description: entry.declaration.description,
      provider: {
        name: entry.provider.name,
        displayName: entry.provider.displayName,
        department: entry.provider.department,
        rank: entry.provider.rank,
      },
    }));
    json(res, { services: result });
    return true;
  }

  // POST /api/org/cross-request — route a service request to the provider
  if (method === "POST" && pathname === "/api/org/cross-request") {
    const parsed = await readJsonBody(req, res);
    if (!parsed.ok) return true;
    const body = parsed.body as CrossRequestBody;
    const fromEmployee = body.fromEmployee as string | undefined;
    const service = body.service as string | undefined;
    const prompt = body.prompt as string | undefined;
    const parentSessionId = body.parentSessionId as string | undefined;
    if (!fromEmployee || !service || !prompt) {
      badRequest(res, "Missing required fields: fromEmployee, service, prompt");
      return true;
    }

    const { scanOrg } = await import("../org.js");
    const { resolveOrgHierarchy } = await import("../org-hierarchy.js");
    const { buildServiceRegistry, buildRoutePath, resolveManagerChain } = await import("../services.js");

    const orgRegistry = scanOrg();
    const requester = orgRegistry.get(fromEmployee);
    if (!requester) {
      notFound(res);
      return true;
    }

    const services = buildServiceRegistry(orgRegistry);
    const entry = services.get(service);
    if (!entry) {
      json(res, { error: `Service "${service}" not found` }, 404);
      return true;
    }

    const hierarchy = resolveOrgHierarchy(orgRegistry);
    const route = buildRoutePath(fromEmployee, entry.provider.name, hierarchy);
    const managers = resolveManagerChain(route, hierarchy);

    const crossBrief = `## Cross-service request

**From**: ${requester.displayName} (${requester.department})
**Service**: ${service} — ${entry.declaration.description}

### Request
${prompt}

---
Handle this as a priority request from a colleague.`;

    const config = context.getConfig();
    const session = createSession({
      engine: entry.provider.engine || config.engines.default,
      model: entry.provider.model || undefined,
      source: "cross-request",
      sourceRef: `cross:${fromEmployee}:${service}`,
      connector: "web",
      sessionKey: `cross:${Date.now()}`,
      replyContext: { source: "cross-request" },
      employee: entry.provider.name,
      parentSessionId: parentSessionId || undefined,
      prompt: crossBrief,
      portalName: config.portal?.portalName,
      title: `Cross-request: ${fromEmployee} → ${service}`,
    });
    insertMessage(session.id, "user", crossBrief);
    logger.info(`Cross-request session created: ${session.id} (${fromEmployee} → ${service} → ${entry.provider.name})`);

    json(
      res,
      {
        sessionId: session.id,
        provider: {
          name: entry.provider.name,
          displayName: entry.provider.displayName,
          department: entry.provider.department,
        },
        route,
        managers: managers.map((m) => m.employee.name),
        service,
      },
      201,
    );
    return true;
  }

  // GET /api/org/employees/:name
  let params = matchRoute("/api/org/employees/:name", pathname);
  if (method === "GET" && params) {
    const { scanOrg } = await import("../org.js");
    const { resolveOrgHierarchy } = await import("../org-hierarchy.js");
    const orgRegistry = scanOrg();
    const emp = orgRegistry.get(params.name);
    if (!emp) {
      notFound(res);
      return true;
    }

    const hierarchy = resolveOrgHierarchy(orgRegistry);
    const node = hierarchy.nodes[params.name];

    json(res, {
      ...emp,
      parentName: node?.parentName ?? null,
      directReports: node?.directReports ?? [],
      depth: node?.depth ?? 0,
      chain: node?.chain ?? [params.name],
    });
    return true;
  }

  // PATCH /api/org/employees/:name — update employee fields (currently only alwaysNotify)
  params = matchRoute("/api/org/employees/:name", pathname);
  if (method === "PATCH" && params) {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as PatchEmployeeBody;
    const { updateEmployeeYaml } = await import("../org.js");
    const updated = updateEmployeeYaml(params.name, {
      alwaysNotify: typeof body.alwaysNotify === "boolean" ? body.alwaysNotify : undefined,
    });
    if (!updated) {
      notFound(res);
      return true;
    }
    context.emit("org:updated", { employee: params.name });
    json(res, { status: "ok" });
    return true;
  }

  // GET /api/org/departments/:name/board
  params = matchRoute("/api/org/departments/:name/board", pathname);
  if (method === "GET" && params) {
    const boardPath = path.join(ORG_DIR, params.name, "board.json");
    if (!fs.existsSync(boardPath)) {
      notFound(res);
      return true;
    }
    const board = JSON.parse(fs.readFileSync(boardPath, "utf-8"));
    json(res, board);
    return true;
  }

  // PUT /api/org/departments/:name/board
  const putBoardParams = matchRoute("/api/org/departments/:name/board", pathname);
  if (method === "PUT" && putBoardParams) {
    const p = putBoardParams;
    const boardPath = path.join(ORG_DIR, p.name, "board.json");
    const deptDir = path.join(ORG_DIR, p.name);
    if (!fs.existsSync(deptDir)) {
      notFound(res);
      return true;
    }
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as PutBoardBody;
    fs.writeFileSync(boardPath, JSON.stringify(body, null, 2));
    context.emit("board:updated", { department: p.name });
    json(res, { status: "ok" });
    return true;
  }

  return false;
}
