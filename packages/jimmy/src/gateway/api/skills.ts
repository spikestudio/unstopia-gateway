import fs from "node:fs";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import path from "node:path";
import { logger } from "../../shared/logger.js";
import { SKILLS_DIR } from "../../shared/paths.js";
import type { ApiContext } from "../types.js";
import { badRequest, json, matchRoute, notFound, readJsonBody, serverError, stripAnsi } from "./utils.js";

function parseSkillsSearchOutput(
  output: string,
): Array<{ name: string; source: string; url: string; installs: number }> {
  const results: Array<{ name: string; source: string; url: string; installs: number }> = [];
  const lines = output.trim().split("\n");

  for (let i = 0; i < lines.length; i++) {
    const headerLine = stripAnsi(lines[i]).trim();
    // Match "owner/repo@skill-name  <N> installs"
    const headerMatch = headerLine.match(/^(\S+)\s+(\d+)\s+installs?$/);
    if (!headerMatch) continue;

    const source = headerMatch[1];
    const installs = parseInt(headerMatch[2], 10);
    const atIdx = source.lastIndexOf("@");
    const name = atIdx > 0 ? source.slice(atIdx + 1) : source;

    // Next line should be the URL
    let url = "";
    if (i + 1 < lines.length) {
      const urlLine = stripAnsi(lines[i + 1]).trim();
      const urlMatch = urlLine.match(/[└]\s*(https?:\/\/\S+)/);
      if (urlMatch) {
        url = urlMatch[1];
        i++; // consume the URL line
      }
    }

    results.push({ name, source, url, installs });
  }
  return results;
}

export async function handleSkillsRequest(
  req: HttpRequest,
  res: ServerResponse,
  _context: ApiContext,
  method: string,
  pathname: string,
  url: URL,
): Promise<boolean> {
  // GET /api/skills/search?q=<query> — search the skills.sh registry
  if (method === "GET" && pathname === "/api/skills/search") {
    const query = url.searchParams.get("q") || "";
    if (!query) {
      badRequest(res, "q parameter is required");
      return true;
    }
    try {
      const { execFileSync } = await import("node:child_process");
      const output = execFileSync("npx", ["skills", "find", query], {
        encoding: "utf-8",
        timeout: 30000,
      });
      const results = parseSkillsSearchOutput(output);
      json(res, results);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? (err as Error & { stderr?: string }).stderr || err.message : String(err);
      json(res, { results: [], error: msg });
      return true;
    }
  }

  // GET /api/skills/manifest — return skills.json contents
  if (method === "GET" && pathname === "/api/skills/manifest") {
    const { readManifest } = await import("../../cli/skills.js");
    json(res, readManifest());
    return true;
  }

  // POST /api/skills/install — install a skill from skills.sh
  if (method === "POST" && pathname === "/api/skills/install") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;
    const source = body.source as string | undefined;
    if (!source) {
      badRequest(res, "source is required");
      return true;
    }
    try {
      const { snapshotDirs, diffSnapshots, copySkillToInstance, upsertManifest, extractSkillName, findExistingSkill } =
        await import("../../cli/skills.js");
      const { execFileSync } = await import("node:child_process");

      const before = snapshotDirs();
      execFileSync("npx", ["skills", "add", String(source), "-g", "-y"], {
        encoding: "utf-8",
        timeout: 60000,
      });
      const after = snapshotDirs();
      const newDirs = diffSnapshots(before, after);

      let skillName: string;
      if (newDirs.length > 0) {
        const installed = newDirs[0];
        skillName = installed.name;
        copySkillToInstance(installed.name, path.join(installed.dir, installed.name));
      } else {
        skillName = extractSkillName(source);
        const existing = findExistingSkill(skillName);
        if (existing) {
          copySkillToInstance(existing.name, existing.dir);
        } else {
          serverError(res, "Skill installed globally but could not locate the directory");
          return true;
        }
      }
      upsertManifest(skillName, source);
      json(res, { status: "installed", name: skillName });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      serverError(res, msg);
      return true;
    }
  }

  // GET /api/skills
  if (method === "GET" && pathname === "/api/skills") {
    if (!fs.existsSync(SKILLS_DIR)) {
      json(res, []);
      return true;
    }
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    const skills = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const skillMdPath = path.join(SKILLS_DIR, e.name, "SKILL.md");
        let description = "";
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, "utf-8");
          // Extract description from YAML frontmatter, ## Trigger section, or first paragraph
          const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
          if (frontmatterMatch) {
            const descMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
            if (descMatch) {
              description = descMatch[1].trim();
            }
          }
          if (!description) {
            const triggerMatch = content.match(/##\s*Trigger\s*\n+([^\n#]+)/);
            if (triggerMatch) {
              description = triggerMatch[1].trim();
            } else {
              // Use first non-heading, non-empty, non-frontmatter line
              const bodyContent = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content;
              const lines = bodyContent.split("\n");
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith("#")) {
                  description = trimmed;
                  break;
                }
              }
            }
          }
        }
        return { name: e.name, description };
      });
    json(res, skills);
    return true;
  }

  // GET /api/skills/:name
  let params = matchRoute("/api/skills/:name", pathname);
  if (method === "GET" && params) {
    const skillMd = path.join(SKILLS_DIR, params.name, "SKILL.md");
    if (!fs.existsSync(skillMd)) {
      notFound(res);
      return true;
    }
    const content = fs.readFileSync(skillMd, "utf-8");
    json(res, { name: params.name, content });
    return true;
  }

  // DELETE /api/skills/:name — remove a skill
  params = matchRoute("/api/skills/:name", pathname);
  if (method === "DELETE" && params) {
    const skillDir = path.join(SKILLS_DIR, params.name);
    if (!fs.existsSync(skillDir)) {
      notFound(res);
      return true;
    }
    fs.rmSync(skillDir, { recursive: true, force: true });
    const { removeFromManifest } = await import("../../cli/skills.js");
    removeFromManifest(params.name);
    logger.info(`Skill removed via API: ${params.name}`);
    json(res, { status: "removed", name: params.name });
    return true;
  }

  return false;
}
