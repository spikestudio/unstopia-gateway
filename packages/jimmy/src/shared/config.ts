import fs from "node:fs";
import yaml from "js-yaml";
import { CONFIG_PATH } from "./paths.js";
import type { GatewayConfig } from "./types.js";

export function loadConfig(): GatewayConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Gateway config not found at ${CONFIG_PATH}. Run "gateway setup" first.`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return yaml.load(raw) as GatewayConfig;
}
