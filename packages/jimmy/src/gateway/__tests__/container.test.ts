import { describe, expect, it } from "vitest";
import { buildConnectorNames, buildEngines } from "../container.js";
import type { JinnConfig } from "../../shared/types.js";

function makeConfig(connectors: JinnConfig["connectors"] = {}): JinnConfig {
  return {
    gateway: { port: 7777, host: "0.0.0.0" },
    engines: { default: "claude", claude: { bin: "claude", model: "sonnet" }, codex: { bin: "codex", model: "" } },
    connectors,
    logging: { file: false, stdout: false, level: "info" },
  } as unknown as JinnConfig;
}

describe("buildEngines", () => {
  it("claude / codex / gemini の 3 エンジンを返す", () => {
    const engines = buildEngines();
    expect(engines.size).toBe(3);
    expect(engines.has("claude")).toBe(true);
    expect(engines.has("codex")).toBe(true);
    expect(engines.has("gemini")).toBe(true);
  });

  it("各エンジンが run メソッドを持つ", () => {
    const engines = buildEngines();
    for (const engine of engines.values()) {
      expect(typeof engine.run).toBe("function");
    }
  });
});

describe("buildConnectorNames", () => {
  it("コネクター設定がない場合は空配列を返す", () => {
    expect(buildConnectorNames(makeConfig())).toEqual([]);
  });

  it("slack の appToken と botToken が揃っている場合に slack を含む", () => {
    const config = makeConfig({ slack: { appToken: "xapp-1", botToken: "xoxb-1" } } as JinnConfig["connectors"]);
    expect(buildConnectorNames(config)).toContain("slack");
  });

  it("slack の片方だけの場合は slack を含まない", () => {
    const config = makeConfig({ slack: { appToken: "xapp-1" } } as JinnConfig["connectors"]);
    expect(buildConnectorNames(config)).not.toContain("slack");
  });

  it("discord の botToken がある場合に discord を含む", () => {
    const config = makeConfig({ discord: { botToken: "tok" } } as JinnConfig["connectors"]);
    expect(buildConnectorNames(config)).toContain("discord");
  });

  it("discord の proxyVia がある場合に discord を含む", () => {
    const config = makeConfig({ discord: { proxyVia: "http://proxy" } } as JinnConfig["connectors"]);
    expect(buildConnectorNames(config)).toContain("discord");
  });

  it("telegram の botToken がある場合に telegram を含む", () => {
    const config = makeConfig({ telegram: { botToken: "tel-tok" } } as JinnConfig["connectors"]);
    expect(buildConnectorNames(config)).toContain("telegram");
  });

  it("whatsapp 設定がある場合に whatsapp を含む", () => {
    const config = makeConfig({ whatsapp: {} } as JinnConfig["connectors"]);
    expect(buildConnectorNames(config)).toContain("whatsapp");
  });

  it("複数コネクターが有効な場合に全て含む", () => {
    const config = makeConfig({
      slack: { appToken: "xapp-1", botToken: "xoxb-1" },
      telegram: { botToken: "tel-tok" },
    } as JinnConfig["connectors"]);
    const names = buildConnectorNames(config);
    expect(names).toContain("slack");
    expect(names).toContain("telegram");
    expect(names).not.toContain("discord");
    expect(names).not.toContain("whatsapp");
  });
});
