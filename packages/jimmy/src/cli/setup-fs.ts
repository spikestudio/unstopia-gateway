import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function whichBin(name: string): string | null {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    return execSync(`${cmd} ${name}`, { encoding: "utf-8" }).trim().split("\n")[0];
  } catch {
    return null;
  }
}

export function runVersion(bin: string): string | null {
  try {
    return execSync(`${bin} --version`, { encoding: "utf-8", timeout: 10000 }).trim();
  } catch {
    return null;
  }
}

export function ensureDir(dir: string): boolean {
  if (fs.existsSync(dir)) return false;
  fs.mkdirSync(dir, { recursive: true });
  return true;
}

export function ensureFile(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}

/**
 * Apply template placeholder replacements to file content.
 * Only applies to .md and .yaml files.
 */
export function applyTemplateReplacements(content: string, replacements: Record<string, string>): string {
  let result = content;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}

/**
 * Recursively copy template directory contents into dest, skipping files that already exist.
 * Applies template placeholder replacements to .md and .yaml files.
 * Returns list of created file paths.
 */
export function copyTemplateDir(srcDir: string, destDir: string, replacements?: Record<string, string>): string[] {
  const created: string[] = [];
  if (!fs.existsSync(srcDir)) return created;

  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      created.push(...copyTemplateDir(srcPath, destPath, replacements));
    } else if (entry.name === ".gitkeep") {
    } else if (!fs.existsSync(destPath)) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const ext = path.extname(entry.name).toLowerCase();
      if (replacements && (ext === ".md" || ext === ".yaml" || ext === ".yml")) {
        const content = fs.readFileSync(srcPath, "utf-8");
        fs.writeFileSync(destPath, applyTemplateReplacements(content, replacements), "utf-8");
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
      created.push(destPath);
    }
  }
  return created;
}
