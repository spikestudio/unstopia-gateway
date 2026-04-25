import { ClaudeEngine } from "../engines/claude.js";
import { CodexEngine } from "../engines/codex.js";
import { GeminiEngine } from "../engines/gemini.js";
import type { Engine, JinnConfig } from "../shared/types.js";

/** Build the engine map. Each key matches JinnConfig.engines keys. */
export function buildEngines(): Map<string, Engine> {
  const engines = new Map<string, Engine>();
  engines.set("claude", new ClaudeEngine());
  engines.set("codex", new CodexEngine());
  engines.set("gemini", new GeminiEngine());
  return engines;
}

/** Derive the list of active connector names from config. */
export function buildConnectorNames(config: JinnConfig): string[] {
  const names: string[] = [];
  if (config.connectors?.slack?.appToken && config.connectors?.slack?.botToken) {
    names.push("slack");
  }
  if (config.connectors?.discord?.botToken || config.connectors?.discord?.proxyVia) {
    names.push("discord");
  }
  if (config.connectors?.telegram?.botToken) {
    names.push("telegram");
  }
  if (config.connectors?.whatsapp) {
    names.push("whatsapp");
  }
  return names;
}
