import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPackageVersion } from "../shared/version.js";
import { DIM, RESET } from "./setup-ui.js";

export const DEFAULT_CONFIG = `meta:
  version: "${getPackageVersion()}"

gateway:
  port: 7777
  host: "127.0.0.1"
engines:
  default: claude
  claude:
    bin: claude
    model: opus
    effortLevel: medium
  codex:
    bin: codex
    model: gpt-5.4
connectors: {}
portal: {}
logging:
  file: true
  stdout: true
  level: info
`;

/**
 * Detect project context by scanning ~/Projects/ for common project indicators
 * and suggest relevant skills the user might want to install.
 */
export function detectProjectContext(portalSlug: string): void {
  const projectsDir = path.join(os.homedir(), "Projects");
  if (!fs.existsSync(projectsDir)) return;

  const indicators: { check: (dir: string) => boolean; query: string; label: string }[] = [
    {
      check: (dir) => {
        try {
          return fs.readdirSync(dir).some((e) => e.endsWith(".xcodeproj"));
        } catch {
          return false;
        }
      },
      query: "ios swift xcode",
      label: "iOS",
    },
    {
      check: (dir) => fs.existsSync(path.join(dir, "Package.swift")),
      query: "ios swift xcode",
      label: "iOS/Swift",
    },
    {
      check: (dir) => fs.existsSync(path.join(dir, "Dockerfile")),
      query: "docker container",
      label: "Docker",
    },
    {
      check: (dir) => fs.existsSync(path.join(dir, ".github", "workflows")),
      query: "github actions ci",
      label: "GitHub Actions",
    },
    {
      check: (dir) => {
        try {
          return fs.readdirSync(dir).some((e) => e.startsWith("playwright.config"));
        } catch {
          return false;
        }
      },
      query: "playwright testing",
      label: "Playwright",
    },
    {
      check: (dir) => {
        const pkgPath = path.join(dir, "package.json");
        if (!fs.existsSync(pkgPath)) return false;
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          return deps != null && ("react" in deps || "next" in deps);
        } catch {
          return false;
        }
      },
      query: "react nextjs",
      label: "React",
    },
  ];

  const detected = new Map<string, string>(); // label → query

  try {
    const topLevel = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());

    const projectDirs: string[] = [];
    for (const dir of topLevel) {
      const dirPath = path.join(projectsDir, dir.name);
      projectDirs.push(dirPath);
      // One level deeper for org-style folders (e.g. ~/Projects/Personal/foo)
      try {
        const subDirs = fs.readdirSync(dirPath, { withFileTypes: true }).filter((e) => e.isDirectory());
        for (const sub of subDirs) {
          projectDirs.push(path.join(dirPath, sub.name));
        }
      } catch {
        // ignore permission errors
      }
    }

    for (const projDir of projectDirs) {
      for (const ind of indicators) {
        if (detected.has(ind.label)) continue;
        if (ind.check(projDir)) {
          detected.set(ind.label, ind.query);
        }
      }
    }
  } catch {
    return;
  }

  if (detected.size > 0) {
    console.log("");
    for (const [label, query] of detected) {
      console.log(
        `  💡 Detected ${label} projects. Run ${DIM}${portalSlug} skills find ${query}${RESET} to discover relevant skills.`,
      );
    }
  }
}

export function defaultClaudeMd(portalName: string): string {
  return `# ${portalName} AI Gateway

This is the ${portalName} home directory (~/.gateway).
${portalName} orchestrates Claude Code and Codex as AI engines.
`;
}

export function defaultAgentsMd(portalName: string): string {
  return `# ${portalName} Agents

Agents are configured via employees in the org/ directory.
`;
}
