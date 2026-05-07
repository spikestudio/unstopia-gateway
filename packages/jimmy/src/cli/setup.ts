import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { initDb } from "../sessions/registry.js";
import {
  AGENTS_SKILLS_DIR,
  CLAUDE_SKILLS_DIR,
  CONFIG_PATH,
  CRON_JOBS,
  CRON_RUNS,
  DOCS_DIR,
  GATEWAY_HOME,
  LOGS_DIR,
  ORG_DIR,
  SKILLS_DIR,
  TEMPLATE_DIR,
  TMP_DIR,
} from "../shared/paths.js";
import { getPackageVersion } from "../shared/version.js";
import { DEFAULT_CONFIG, defaultAgentsMd, defaultClaudeMd, detectProjectContext } from "./setup-context.js";
import { applyTemplateReplacements, copyTemplateDir, ensureDir, ensureFile, runVersion, whichBin } from "./setup-fs.js";
import { DIM, fail, GREEN, info, ok, prompt, RESET, warn, YELLOW } from "./setup-ui.js";

export async function runSetup(opts?: { force?: boolean }): Promise<void> {
  console.log("\nGateway Setup\n");

  if (opts?.force && fs.existsSync(GATEWAY_HOME)) {
    console.log(`  ${YELLOW}[force]${RESET} Removing ${GATEWAY_HOME}...`);
    fs.rmSync(GATEWAY_HOME, { recursive: true, force: true });
    console.log(`  ${GREEN}[ok]${RESET} Removed ${GATEWAY_HOME}\n`);
  }

  // 1. Check Node.js version
  const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
  if (nodeVersion >= 22) {
    ok(`Node.js v${process.versions.node}`);
  } else {
    warn(`Node.js v${process.versions.node} -- v22+ recommended`);
  }

  // 2. Check for claude binary
  const claudePath = whichBin("claude");
  if (claudePath) {
    ok(`claude found at ${claudePath}`);
  } else {
    fail("claude not found");
    info("Install with: npm install -g @anthropic-ai/claude-code");
  }

  // 3. Check for codex binary
  const codexPath = whichBin("codex");
  if (codexPath) {
    ok(`codex found at ${codexPath}`);
  } else {
    fail("codex not found");
    info("Install with: npm install -g @openai/codex");
  }

  // 4. Check auth / versions
  console.log("");
  if (claudePath) {
    const ver = runVersion("claude");
    if (ver) ok(`claude --version: ${ver}`);
    else warn("claude --version failed");
  }
  if (codexPath) {
    const ver = runVersion("codex");
    if (ver) ok(`codex --version: ${ver}`);
    else warn("codex --version failed");
  }

  // 5. Interactive setup (only when stdin is a TTY and config doesn't exist yet)
  const isFreshSetup = !fs.existsSync(CONFIG_PATH);
  const isInteractive = process.stdin.isTTY && isFreshSetup;

  // Derive default COO name from instance name if set, otherwise "Gateway"
  const instanceName = process.env.GATEWAY_INSTANCE;
  const defaultName = instanceName ? instanceName.charAt(0).toUpperCase() + instanceName.slice(1) : "Gateway";

  let chosenName = defaultName;
  let chosenEngine: "claude" | "codex" = "claude";

  if (isInteractive) {
    console.log("");
    chosenName = await prompt("What should your AI assistant be called?", defaultName);

    // Determine available engines
    const engines: string[] = [];
    if (claudePath) engines.push("claude");
    if (codexPath) engines.push("codex");

    if (engines.length === 2) {
      const engineAnswer = await prompt("Preferred engine? (claude/codex)", "claude");
      chosenEngine = engineAnswer === "codex" ? "codex" : "claude";
    } else if (engines.length === 1) {
      chosenEngine = engines[0] as "claude" | "codex";
      ok(`Using ${chosenEngine} as default engine (only engine installed)`);
    }
  }

  // 6. Create ~/.gateway directory structure
  console.log("");
  const created: string[] = [];

  if (ensureDir(GATEWAY_HOME)) created.push(GATEWAY_HOME);

  // Copy or create config files
  const templateConfig = path.join(TEMPLATE_DIR, "config.yaml");
  const templateClaude = path.join(TEMPLATE_DIR, "CLAUDE.md");
  const templateAgents = path.join(TEMPLATE_DIR, "AGENTS.md");

  if (!fs.existsSync(CONFIG_PATH)) {
    let source = fs.existsSync(templateConfig) ? fs.readFileSync(templateConfig, "utf-8") : DEFAULT_CONFIG;
    // Stamp the current package version into the config
    source = source.replace(/version:\s*"[^"]*"/, `version: "${getPackageVersion()}"`);
    // Apply interactive choices
    source = source.replace(/default:\s*claude/, `default: ${chosenEngine}`);
    if (chosenName !== "Gateway") {
      source = source.replace("portal: {}", `portal:\n  portalName: "${chosenName}"`);
    }
    ensureFile(CONFIG_PATH, source);
    created.push(CONFIG_PATH);
  }

  // Read portal name from config for template replacements
  const portalName = (() => {
    try {
      const cfg = yaml.load(fs.readFileSync(CONFIG_PATH, "utf-8")) as Record<string, unknown>;
      const portal = cfg?.portal;
      if (portal && typeof portal === "object") {
        const portalName = (portal as Record<string, unknown>).portalName;
        if (typeof portalName === "string") return portalName;
      }
      return "Gateway";
    } catch {
      return "Gateway";
    }
  })();
  const portalSlug = portalName.toLowerCase().replace(/\s+/g, "-");

  const templateReplacements: Record<string, string> = {
    "{{portalName}}": portalName,
    "{{portalSlug}}": portalSlug,
  };

  const claudeMdPath = path.join(GATEWAY_HOME, "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) {
    let source = fs.existsSync(templateClaude) ? fs.readFileSync(templateClaude, "utf-8") : defaultClaudeMd(portalName);
    source = applyTemplateReplacements(source, templateReplacements);
    ensureFile(claudeMdPath, source);
    created.push(claudeMdPath);
  }

  const agentsMdPath = path.join(GATEWAY_HOME, "AGENTS.md");
  if (!fs.existsSync(agentsMdPath)) {
    let source = fs.existsSync(templateAgents) ? fs.readFileSync(templateAgents, "utf-8") : defaultAgentsMd(portalName);
    source = applyTemplateReplacements(source, templateReplacements);
    ensureFile(agentsMdPath, source);
    created.push(agentsMdPath);
  }

  // 6. Initialize SQLite database
  try {
    initDb();
    ok("Sessions database initialized");
  } catch (err) {
    warn(`Failed to initialize sessions database: ${err}`);
  }

  // 7. Create cron/jobs.json
  if (ensureFile(CRON_JOBS, "[]")) created.push(CRON_JOBS);

  // 8. Create cron/runs/
  if (ensureDir(CRON_RUNS)) created.push(CRON_RUNS);

  // 9. Create connectors/
  const connectorsDir = path.join(GATEWAY_HOME, "connectors");
  if (ensureDir(connectorsDir)) created.push(connectorsDir);

  // 10. Create knowledge/
  const knowledgeDir = path.join(GATEWAY_HOME, "knowledge");
  if (ensureDir(knowledgeDir)) created.push(knowledgeDir);

  // 11. Create tmp/
  if (ensureDir(TMP_DIR)) created.push(TMP_DIR);

  // Other standard dirs
  if (ensureDir(LOGS_DIR)) created.push(LOGS_DIR);

  // Copy template contents for docs, skills, and org (skips existing files)
  created.push(...copyTemplateDir(path.join(TEMPLATE_DIR, "docs"), DOCS_DIR, templateReplacements));
  created.push(...copyTemplateDir(path.join(TEMPLATE_DIR, "skills"), SKILLS_DIR, templateReplacements));
  created.push(...copyTemplateDir(path.join(TEMPLATE_DIR, "org"), ORG_DIR, templateReplacements));

  // Copy skills.json manifest
  const templateSkillsJson = path.join(TEMPLATE_DIR, "skills.json");
  const destSkillsJson = path.join(GATEWAY_HOME, "skills.json");
  if (fs.existsSync(templateSkillsJson) && !fs.existsSync(destSkillsJson)) {
    fs.copyFileSync(templateSkillsJson, destSkillsJson);
    created.push(destSkillsJson);
  }

  // Ensure dirs exist even if template had nothing to copy
  ensureDir(DOCS_DIR);
  ensureDir(SKILLS_DIR);
  ensureDir(ORG_DIR);

  // Create .claude/skills/ and .agents/skills/ with symlinks to skills/
  ensureDir(CLAUDE_SKILLS_DIR);
  ensureDir(AGENTS_SKILLS_DIR);

  if (fs.existsSync(SKILLS_DIR)) {
    const skillDirs = fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const name of skillDirs) {
      const relTarget = path.join("..", "..", "skills", name);
      for (const targetDir of [CLAUDE_SKILLS_DIR, AGENTS_SKILLS_DIR]) {
        const linkPath = path.join(targetDir, name);
        if (!fs.existsSync(linkPath)) {
          try {
            fs.symlinkSync(relTarget, linkPath);
          } catch {
            // ignore — may fail on some platforms
          }
        }
      }
    }
  }

  // Create .claude/settings.local.json for engine permissions
  const settingsPath = path.join(GATEWAY_HOME, ".claude", "settings.local.json");
  if (
    ensureFile(
      settingsPath,
      `${JSON.stringify(
        {
          permissions: {
            allow: [
              "Bash(npm:*)",
              "Bash(pnpm:*)",
              "Bash(node:*)",
              "Bash(gateway:*)",
              "Bash(curl:*)",
              "Bash(cat:*)",
              "Bash(ls:*)",
              "Bash(mkdir:*)",
              "Bash(cp:*)",
              "Bash(mv:*)",
              "Bash(rm:*)",
              "Bash(git:*)",
              "Read",
              "Write",
              "Edit",
              "Glob",
              "Grep",
            ],
          },
        },
        null,
        2,
      )}\n`,
    )
  ) {
    created.push(settingsPath);
  }

  // Pre-cache skills CLI for instant searches later
  spawn("npx", ["skills", "--version"], { stdio: "ignore", detached: true }).unref();

  // Detect project context and suggest relevant skills
  detectProjectContext(portalSlug);

  // 12. Print summary
  console.log("");
  if (created.length === 0) {
    ok("Everything already set up -- nothing to do");
  } else {
    ok(`Created ${created.length} item(s):`);
    for (const item of created) {
      info(item);
    }
  }

  console.log(`\n${GREEN}Setup complete.${RESET} Run ${DIM}gateway start${RESET} to launch the gateway.\n`);
}
