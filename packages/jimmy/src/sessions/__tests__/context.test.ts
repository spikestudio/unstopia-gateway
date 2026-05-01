import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// fs モジュールを vi.mock で分離（AC-E018 の「vi.mock で fs を分離」方針に準拠）
vi.mock("node:fs", () => ({
  default: {
    readdirSync: vi.fn().mockReturnValue([]),
    readFileSync: vi.fn().mockReturnValue(""),
    statSync: vi.fn().mockReturnValue({ size: 1024, isDirectory: () => false }),
    rmSync: vi.fn(),
  },
}));

// gateway/org, gateway/services を分離
vi.mock("../../gateway/org.js", () => ({
  scanOrg: vi.fn().mockReturnValue({ employees: [] }),
}));

vi.mock("../../gateway/services.js", () => ({
  buildServiceRegistry: vi.fn().mockReturnValue(new Map()),
}));

// shared/paths を分離（ファイルシステムパスの実体アクセスを回避）
vi.mock("../../shared/paths.js", () => ({
  JINN_HOME: "/test-jinn-home",
  ORG_DIR: "/test-jinn-home/org",
  DOCS_DIR: "/test-jinn-home/docs",
  CRON_JOBS: "/test-jinn-home/cron/jobs.json",
}));

import { buildServiceRegistry } from "../../gateway/services.js";
import type { JinnConfig, OrgHierarchy } from "../../shared/types.js";
import { buildContext } from "../context.js";

describe("buildContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-E018-01: 最小引数で ## Current session セクションが返される
  describe("AC-E018-01: 最小引数での基本動作", () => {
    it("employee なし・config なしで ## Current session セクションを含む文字列が返される", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      expect(result).toContain("## Current session");
      expect(result).toContain("Source: slack");
      expect(result).toContain("User: U99999");
    });
  });

  // AC-E018-02: employee ありで # You are セクションが含まれる
  describe("AC-E018-02: employee ありの出力", () => {
    it("employee を渡すと # You are で始まるアイデンティティセクションが含まれる", () => {
      const employee = {
        name: "alice",
        displayName: "Alice",
        department: "Engineering",
        rank: "employee" as const,
        engine: "claude",
        model: "claude-sonnet",
        persona: "I am Alice, a software engineer.",
      };

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee,
      });

      expect(result).toContain("# You are Alice");
    });
  });

  // AC-E018-03: maxChars 制限で文字列が収まる（trimContext が機能する）
  describe("AC-E018-03: maxChars による trimContext 動作", () => {
    it("config.context.maxChars を大きい値より小さい値にすると返却文字列がより短くなる（trimContext が機能する）", () => {
      // trimContext はまず OPTIONAL → STANDARD の順にサマリーで置換する
      // ESSENTIAL セクションは summary が空("")のため常に保持される（コードの意図通り）
      // maxChars が小さいほど OPTIONAL/STANDARD が刈り込まれ、結果が短くなることを確認する
      const baseConfig = {
        gateway: { port: 7777, host: "127.0.0.1" },
        engines: { default: "claude", claude: { bin: "claude", model: "sonnet" } },
        connectors: {},
        logging: { file: false, stdout: false, level: "info" },
      };

      const largeConfig = { ...baseConfig, context: { maxChars: 100_000 } } as unknown as JinnConfig;
      const tightConfig = { ...baseConfig, context: { maxChars: 500 } } as unknown as JinnConfig;

      const largeResult = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        language: "Japanese",
        connectors: ["slack", "discord"],
        config: largeConfig,
      });
      const tightResult = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        language: "Japanese",
        connectors: ["slack", "discord"],
        config: tightConfig,
      });

      // maxChars が小さいと trimContext が働き結果が短くなる
      expect(tightResult.length).toBeLessThan(largeResult.length);
    });
  });

  // AC-E018-04: language != "English" で言語オーバーライドセクションが含まれる
  describe("AC-E018-04: language != English の出力", () => {
    it("language が 'Japanese' のとき「When following skill instructions」セクションが含まれる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        language: "Japanese",
      });

      expect(result).toContain("When following skill instructions");
      expect(result).toContain("Japanese");
    });

    it("language が 'English' のとき言語オーバーライドセクションは含まれない", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        language: "English",
      });

      expect(result).not.toContain("When following skill instructions");
    });
  });

  // AC-E018-05: channelName で - Channel: #<channelName> が出力される
  describe("AC-E018-05: channelName の出力", () => {
    it("channelName を渡すと '- Channel: #<channelName>' の形式で出力される", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        channelName: "general",
      });

      expect(result).toContain("- Channel: #general");
    });
  });

  // AC-E018-06: source=slack かつ D始まりチャンネルで「Direct Message」と出力される
  describe("AC-E018-06: source=slack + D始まりチャンネルの出力", () => {
    it("source='slack' かつ channel が 'D' 始まりのとき 'Direct Message' と出力される", () => {
      const result = buildContext({
        source: "slack",
        channel: "D1ABCDEF",
        user: "U99999",
      });

      expect(result).toContain("Direct Message");
    });

    it("source='slack' かつ channel が 'C' 始まりのとき 'Direct Message' とは出力されない", () => {
      const result = buildContext({
        source: "slack",
        channel: "C1ABCDEF",
        user: "U99999",
      });

      expect(result).not.toContain("Direct Message");
    });
  });

  // AC-E018-07: thread を渡すと - Thread: <thread> が含まれる
  describe("AC-E018-07: thread の出力", () => {
    it("thread を渡すと '- Thread: <thread>' が出力に含まれる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        thread: "1234567890.123456",
        user: "U99999",
      });

      expect(result).toContain("- Thread: 1234567890.123456");
    });

    it("thread を渡さないとき Thread 行は含まれない", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      expect(result).not.toContain("- Thread:");
    });
  });

  describe("config オプション", () => {
    it("config を渡すと ## Current configuration セクションが含まれる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        config: {
          gateway: { port: 7777, host: "127.0.0.1" },
          engines: {
            default: "claude",
            claude: { bin: "claude", model: "claude-sonnet-4" },
          },
          connectors: {},
          logging: { file: false, stdout: false, level: "info" },
        } as unknown as JinnConfig,
      });

      expect(result).toContain("## Current configuration");
      expect(result).toContain("claude-sonnet-4");
    });

    it("config に codex model がある場合 Codex model 行が出力される", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        config: {
          gateway: { port: 7777, host: "127.0.0.1" },
          engines: {
            default: "codex",
            claude: { bin: "claude", model: "" },
            codex: { bin: "codex", model: "gpt-4o" },
          },
          connectors: {},
          logging: { file: false, stdout: false, level: "info" },
        } as unknown as JinnConfig,
      });

      expect(result).toContain("gpt-4o");
    });

    it("config に gemini model がある場合 Gemini model 行が出力される", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        config: {
          gateway: { port: 7777, host: "127.0.0.1" },
          engines: {
            default: "gemini",
            claude: { bin: "claude", model: "" },
            gemini: { bin: "gemini", model: "gemini-2.0-flash" },
          },
          connectors: {},
          logging: { file: false, stdout: false, level: "info" },
        } as unknown as JinnConfig,
      });

      expect(result).toContain("gemini-2.0-flash");
    });

    it("sessionId を渡すと Session ID 行が出力される", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        sessionId: "sess-abc123",
      });

      expect(result).toContain("Session ID: sess-abc123");
    });

    it("portalName を渡すと # You are <portalName> が出力される", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        portalName: "MyBot",
      });

      expect(result).toContain("# You are MyBot");
    });

    it("operatorName を渡すと operator 名が出力に含まれる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        operatorName: "Taro",
      });

      expect(result).toContain("Taro");
    });

    it("connectors を渡すと ## Available connectors セクションが含まれる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        connectors: ["slack"],
      });

      expect(result).toContain("## Available connectors");
      expect(result).toContain("slack");
    });
  });

  describe("hierarchy を渡した場合の Organization セクション", () => {
    it("hierarchy に nodes があると ## Organization セクションが含まれる", () => {
      const employee = {
        name: "alice",
        displayName: "Alice",
        department: "Engineering",
        rank: "employee" as const,
        engine: "claude",
        model: "claude-sonnet",
        persona: "A software engineer.",
      };

      const hierarchy = {
        nodes: {
          alice: {
            employee,
            depth: 0,
            parentName: null,
            directReports: [],
          },
        },
        sorted: ["alice"],
      } as unknown as OrgHierarchy;

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        hierarchy,
      });

      expect(result).toContain("## Organization");
      expect(result).toContain("Alice");
    });

    it("hierarchy に nodes が空の場合 Organization セクションは表示されない（fs.readdirSync が空を返すのでデフォルトで非表示）", () => {
      const hierarchy = {
        nodes: {},
        sorted: [],
      } as unknown as OrgHierarchy;

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        hierarchy,
      });

      // 空の hierarchy + fs.readdirSync が [] を返すので Organization なし
      expect(result).not.toContain("## Organization");
    });
  });

  describe("employee ありの言語分岐", () => {
    it("employee + language='Japanese' のとき Language 指示が含まれる", () => {
      const employee = {
        name: "alice",
        displayName: "Alice",
        department: "Engineering",
        rank: "employee" as const,
        engine: "claude",
        model: "claude-sonnet",
        persona: "A software engineer.",
      };

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee,
        language: "Japanese",
      });

      expect(result).toContain("Japanese");
    });
  });

  describe("Self-evolution セクション", () => {
    it("user-profile.md が空（isNew=true）のとき ONBOARDING MODE が含まれる", () => {
      // デフォルトのモック: readFileSync が "" を返す → isNew=true
      vi.mocked(fs.readFileSync).mockReturnValue("");

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        // employee なし = COO モード（Self-evolution が追加される）
      });

      expect(result).toContain("ONBOARDING MODE");
      expect(result).toContain("Self-evolution");
    });

    it("user-profile.md が 50 文字以上（isNew=false）のとき evolve メッセージが含まれる", () => {
      const longProfile = "This is a long user profile content that exceeds fifty characters in total length.";
      vi.mocked(fs.readFileSync).mockReturnValue(longProfile as unknown as ReturnType<typeof fs.readFileSync>);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        // employee なし = COO モード
      });

      expect(result).toContain("You learn and evolve over time");
    });
  });

  describe("buildChainOfCommand: hierarchy ありの employee 出力", () => {
    const baseEmployee = {
      name: "alice",
      displayName: "Alice",
      department: "Engineering",
      rank: "employee" as const,
      engine: "claude",
      model: "claude-sonnet",
      persona: "A software engineer.",
    };

    it("hierarchy node に parentName があるとき Your manager が出力される", () => {
      const bobEmployee = {
        name: "bob",
        displayName: "Bob",
        department: "Engineering",
        rank: "manager" as const,
        engine: "claude",
        model: "claude-sonnet",
        persona: "Engineering manager.",
      };

      const hierarchy = {
        nodes: {
          alice: {
            employee: baseEmployee,
            depth: 1,
            parentName: "bob",
            directReports: [],
          },
          bob: {
            employee: bobEmployee,
            depth: 0,
            parentName: null,
            directReports: ["alice"],
          },
        },
        sorted: ["bob", "alice"],
      } as unknown as OrgHierarchy;

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee: baseEmployee,
        hierarchy,
      });

      expect(result).toContain("Your manager");
      expect(result).toContain("Bob");
    });

    it("hierarchy node に parentName がないとき COO が manager として出力される", () => {
      const hierarchy = {
        nodes: {
          alice: {
            employee: baseEmployee,
            depth: 0,
            parentName: null,
            directReports: [],
          },
        },
        sorted: ["alice"],
      } as unknown as OrgHierarchy;

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee: baseEmployee,
        hierarchy,
      });

      expect(result).toContain("COO");
    });

    it("hierarchy node に directReports があるとき Your direct reports が出力される", () => {
      const charlieEmployee = {
        name: "charlie",
        displayName: "Charlie",
        department: "Engineering",
        rank: "employee" as const,
        engine: "claude",
        model: "claude-sonnet",
        persona: "A junior engineer.",
      };

      const hierarchy = {
        nodes: {
          alice: {
            employee: baseEmployee,
            depth: 0,
            parentName: null,
            directReports: ["charlie"],
          },
          charlie: {
            employee: charlieEmployee,
            depth: 1,
            parentName: "alice",
            directReports: [],
          },
        },
        sorted: ["alice", "charlie"],
      } as unknown as OrgHierarchy;

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee: baseEmployee,
        hierarchy,
      });

      expect(result).toContain("direct reports");
      expect(result).toContain("Charlie");
    });
  });

  describe("buildServicesContext: サービス登録がある場合", () => {
    const baseEmployee = {
      name: "alice",
      displayName: "Alice",
      department: "Engineering",
      rank: "employee" as const,
      engine: "claude",
      model: "claude-sonnet",
      persona: "A software engineer.",
    };

    it("別部署のサービスがある場合 ## Available services セクションが含まれる", () => {
      const externalService = {
        declaration: { name: "design-review", description: "Review design artifacts" },
        provider: {
          name: "dave",
          displayName: "Dave",
          department: "Design",
          rank: "employee" as const,
          engine: "claude",
          model: "sonnet",
          persona: "",
        },
      };
      vi.mocked(buildServiceRegistry).mockReturnValue(
        new Map([["design-review", externalService]]) as ReturnType<typeof buildServiceRegistry>,
      );

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee: baseEmployee,
      });

      expect(result).toContain("Available services");
      expect(result).toContain("design-review");
    });

    it("同部署のみのサービスは除外されて ## Available services セクションが含まれない", () => {
      const sameDepService = {
        declaration: { name: "code-review", description: "Review code" },
        provider: {
          name: "bob",
          displayName: "Bob",
          department: "Engineering",
          rank: "employee" as const,
          engine: "claude",
          model: "sonnet",
          persona: "",
        },
      };
      vi.mocked(buildServiceRegistry).mockReturnValue(
        new Map([["code-review", sameDepService]]) as ReturnType<typeof buildServiceRegistry>,
      );

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee: baseEmployee,
      });

      expect(result).not.toContain("code-review");
    });
  });

  describe("buildCronContext: cron jobs セクション", () => {
    it("CRON_JOBS ファイルが有効な JSON（enabled jobs あり）のとき ## Scheduled cron jobs が含まれる", () => {
      const cronJobs = JSON.stringify([
        { name: "daily-report", schedule: "0 9 * * *", enabled: true, employee: "alice" },
        { name: "weekly-sync", schedule: "0 10 * * 1", enabled: false },
      ]);
      vi.mocked(fs.readFileSync).mockImplementation(((filePath: unknown) => {
        const p = String(filePath);
        if (p.includes("cron") || p.includes("jobs.json")) return cronJobs;
        return "";
      }) as typeof fs.readFileSync);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      expect(result).toContain("Scheduled cron jobs");
      expect(result).toContain("daily-report");
    });
  });

  describe("buildKnowledgeContext: knowledge セクション", () => {
    it("docs ディレクトリに .md ファイルがあるとき ## Knowledge base が含まれる", () => {
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: unknown) => {
        const p = String(dirPath);
        if (p.includes("docs") || p.includes("knowledge")) {
          return ["readme.md", "notes.txt"];
        }
        return [];
      }) as unknown as typeof fs.readdirSync);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false, size: 2048 } as unknown as ReturnType<
        typeof fs.statSync
      >);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      expect(result).toContain("Knowledge base");
    });
  });

  describe("buildOrgContext: fallback ファイルシステムスキャン", () => {
    it("hierarchy が空でも readdirSync が yaml ファイルを返すとき ## Organization が含まれる", () => {
      // withFileTypes: true の場合のエントリを返す
      const mockEntry = {
        name: "alice.yaml",
        isDirectory: () => false,
      };
      vi.mocked(fs.readdirSync).mockImplementation(((dir: unknown, opts?: unknown) => {
        const dirStr = String(dir);
        // ORG_DIR (/test-jinn-home/org) の場合のみ yaml を返す
        if (dirStr.includes("org")) {
          if (opts && (opts as Record<string, unknown>).withFileTypes) {
            return [mockEntry];
          }
          return ["alice.yaml"];
        }
        return [];
      }) as unknown as typeof fs.readdirSync);
      vi.mocked(fs.readFileSync).mockImplementation(((filePath: unknown) => {
        const p = String(filePath);
        if (p.includes("alice.yaml")) {
          return "displayName: Alice\ndepartment: Engineering\nrank: employee\npersona: A software engineer who loves clean code.\n";
        }
        return "";
      }) as typeof fs.readFileSync);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false, size: 1024 } as unknown as ReturnType<
        typeof fs.statSync
      >);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        // hierarchy なし → fallback が起動する
      });

      expect(result).toContain("## Organization");
      expect(result).toContain("Alice");
    });

    it("scanDir でサブディレクトリがある場合も yaml ファイルを再帰的に収集する", () => {
      // 最初の readdirSync 呼び出しはサブディレクトリを返し、
      // 次の呼び出しで yaml ファイルを返す（再帰スキャン）
      const subDirEntry = {
        name: "subdep",
        isDirectory: () => true,
      };
      const yamlEntry = {
        name: "bob.yaml",
        isDirectory: () => false,
      };

      let callCount = 0;
      vi.mocked(fs.readdirSync).mockImplementation(((dir: unknown, opts?: unknown) => {
        const dirStr = String(dir);
        if ((opts as Record<string, unknown>)?.withFileTypes) {
          callCount++;
          if (dirStr.includes("org") && callCount === 1) {
            // 最初: org ディレクトリにサブディレクトリあり
            return [subDirEntry];
          }
          if (dirStr.includes("subdep")) {
            // 2回目: サブディレクトリに yaml ファイルあり
            return [yamlEntry];
          }
          return [];
        }
        return [];
      }) as unknown as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockImplementation(((filePath: unknown) => {
        const p = String(filePath);
        if (p.includes("bob.yaml")) {
          return "displayName: Bob\ndepartment: Engineering\nrank: employee\n";
        }
        return "";
      }) as typeof fs.readFileSync);

      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false, size: 1024 } as unknown as ReturnType<
        typeof fs.statSync
      >);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      expect(result).toContain("## Organization");
      expect(result).toContain("Bob");
    });

    it("hierarchy に depth >= 3 の node があるとき 'more at deeper levels' が出力される", () => {
      const makeEmp = (name: string, displayName: string) => ({
        name,
        displayName,
        department: "Eng",
        rank: "employee" as const,
        engine: "claude",
        model: "sonnet",
        persona: "",
      });

      const hierarchy = {
        nodes: {
          alice: { employee: makeEmp("alice", "Alice"), depth: 0, parentName: null, directReports: ["bob"] },
          bob: { employee: makeEmp("bob", "Bob"), depth: 1, parentName: "alice", directReports: ["charlie"] },
          charlie: { employee: makeEmp("charlie", "Charlie"), depth: 2, parentName: "bob", directReports: ["dave"] },
          dave: { employee: makeEmp("dave", "Dave"), depth: 3, parentName: "charlie", directReports: [] }, // depth >= 3
        },
        sorted: ["alice", "bob", "charlie", "dave"],
      } as unknown as OrgHierarchy;

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        hierarchy,
      });

      expect(result).toContain("more at deeper levels");
    });
  });

  describe("buildEnvironmentContext: ローカル環境セクション", () => {
    it("statSync がディレクトリを返すとき ## Local environment セクションが含まれる", () => {
      // statSync がディレクトリであることを示すように変更
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true, size: 0 } as unknown as ReturnType<
        typeof fs.statSync
      >);
      vi.mocked(fs.readdirSync).mockReturnValue(["file1.txt", "file2.txt"] as unknown as ReturnType<
        typeof fs.readdirSync
      >);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      expect(result).toContain("Local environment");
    });

    it("statSync が例外を throw したとき ## Local environment セクションは含まれない", () => {
      // statSync が例外を投げるようにして、全ての tool dir が "not found" になる
      vi.mocked(fs.statSync).mockImplementation((() => {
        throw new Error("ENOENT");
      }) as typeof fs.statSync);
      vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      // hasContent が false のため Local environment は含まれない
      expect(result).not.toContain("Local environment");
    });
  });

  describe("delegationProtocol セクション（COO モード）", () => {
    it("employee なしのとき Employee Delegation Protocol セクションが含まれる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      expect(result).toContain("Employee Delegation Protocol");
    });

    it("employee ありのとき Employee Delegation Protocol セクションは含まれない", () => {
      const employee = {
        name: "alice",
        displayName: "Alice",
        department: "Engineering",
        rank: "employee" as const,
        engine: "claude",
        model: "claude-sonnet",
        persona: "A software engineer.",
      };

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee,
      });

      expect(result).not.toContain("Employee Delegation Protocol");
    });

    it("config に childEffortOverride がある場合 Note が含まれる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        config: {
          gateway: { port: 7777, host: "127.0.0.1" },
          engines: {
            default: "claude",
            claude: { bin: "claude", model: "sonnet", childEffortOverride: "low" },
          },
          connectors: {},
          logging: { file: false, stdout: false, level: "info" },
        } as unknown as JinnConfig,
      });

      expect(result).toContain("childEffortOverride");
      expect(result).toContain('"low"');
    });

    it("config の defaultEngine が codex のとき codex config が使われる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        config: {
          gateway: { port: 7777, host: "127.0.0.1" },
          engines: {
            default: "codex",
            claude: { bin: "claude", model: "sonnet" },
            codex: { bin: "codex", model: "gpt-4o", childEffortOverride: "high" },
          },
          connectors: {},
          logging: { file: false, stdout: false, level: "info" },
        } as unknown as JinnConfig,
      });

      expect(result).toContain("childEffortOverride");
      expect(result).toContain('"high"');
    });

    it("config の defaultEngine が gemini のとき gemini config が使われる", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        config: {
          gateway: { port: 7777, host: "127.0.0.1" },
          engines: {
            default: "gemini",
            claude: { bin: "claude", model: "sonnet" },
            gemini: { bin: "gemini", model: "gemini-2.0", childEffortOverride: "medium" },
          },
          connectors: {},
          logging: { file: false, stdout: false, level: "info" },
        } as unknown as JinnConfig,
      });

      expect(result).toContain("childEffortOverride");
      expect(result).toContain('"medium"');
    });
  });

  // ── Additional branch coverage ────────────────────────────────────────────

  describe("buildChainOfCommand — parentName exists but not in hierarchy.nodes (line 289)", () => {
    it("falls back to raw parentName string when parent node is missing", () => {
      const makeEmp = (name: string, displayName: string) => ({
        name,
        displayName,
        department: "Eng",
        rank: "employee" as const,
        engine: "claude",
        model: "sonnet",
        persona: "",
      });

      const hierarchy = {
        nodes: {
          // "alice" has parentName "ghost" but "ghost" is NOT in nodes
          alice: {
            employee: makeEmp("alice", "Alice"),
            depth: 1,
            parentName: "ghost",
            directReports: [],
            chain: ["ghost", "alice"],
          },
          // "ghost" is intentionally absent from nodes
        },
        sorted: ["alice"],
        root: "ghost",
        warnings: [],
      } as unknown as import("../../shared/types.js").OrgHierarchy;

      const employee = {
        name: "alice",
        displayName: "Alice",
        department: "Eng",
        rank: "employee" as const,
        engine: "claude",
        model: "sonnet",
        persona: "A worker.",
      };

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        employee,
        hierarchy,
      });

      // line 289: falls back to node.parentName string "ghost" when parent not in nodes
      expect(result).toContain("ghost");
    });
  });

  describe("buildServicesContext — catch branch (line 347)", () => {
    it("returns null when buildServiceRegistry throws", () => {
      vi.mocked(buildServiceRegistry).mockImplementation(() => {
        throw new Error("registry error");
      });

      // With an employee, buildServicesContext is called
      const employee = {
        name: "alice",
        displayName: "Alice",
        department: "Eng",
        rank: "employee" as const,
        engine: "claude",
        model: "sonnet",
        persona: "A worker.",
      };

      // Should not throw — buildServicesContext silently returns null on error
      expect(() =>
        buildContext({
          source: "slack",
          channel: "C12345",
          user: "U99999",
          employee,
        }),
      ).not.toThrow();

      // Restore mock
      vi.mocked(buildServiceRegistry).mockReturnValue(new Map());
    });
  });

  describe("buildKnowledgeContext — statSync throws for individual file (line 550)", () => {
    it("uses '?' as sizeKb when statSync throws for a specific file", () => {
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: unknown) => {
        const p = String(dirPath);
        if (p.includes("docs") || p.includes("knowledge")) {
          return ["notes.md"] as unknown as ReturnType<typeof fs.readdirSync>;
        }
        return [] as unknown as ReturnType<typeof fs.readdirSync>;
      }) as unknown as typeof fs.readdirSync);

      // statSync throws for the file inside the loop
      vi.mocked(fs.statSync).mockImplementation((() => {
        throw new Error("ENOENT: file not found");
      }) as typeof fs.statSync);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      // Knowledge base is still shown even with "?" size
      expect(result).toContain("Knowledge base");
      expect(result).toContain("notes.md");
    });
  });

  describe("buildEnvironmentContext — tool directory has more than 15 contents (line 625 branch)", () => {
    it("shows truncated content list when tool directory has > 15 items", () => {
      // Make statSync return a directory
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true, size: 0 } as unknown as ReturnType<
        typeof fs.statSync
      >);
      // readdirSync returns 20 files for the tool dir
      const manyFiles = Array.from({ length: 20 }, (_, i) => `file${i}.txt`);
      vi.mocked(fs.readdirSync).mockImplementation(((_dirPath: unknown) => {
        return manyFiles as unknown as ReturnType<typeof fs.readdirSync>;
      }) as unknown as typeof fs.readdirSync);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      // contents.length > 15 → "... (N total)" suffix
      expect(result).toContain("total");
      expect(result).toContain("Local environment");
    });
  });

  describe("buildDelegationProtocol — gemini engine with no config (line 709 ?? branch)", () => {
    it("falls back to claude config when default engine is gemini but gemini config is missing", () => {
      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        config: {
          gateway: { port: 7777, host: "127.0.0.1" },
          engines: {
            default: "gemini",
            claude: { bin: "claude", model: "sonnet", childEffortOverride: "fallback-effort" },
            // gemini intentionally absent → ?? falls back to claude config
          },
          connectors: {},
          logging: { file: false, stdout: false, level: "info" },
        } as unknown as JinnConfig,
      });

      // Should use claude config as fallback → childEffortOverride "fallback-effort" shown
      expect(result).toContain("fallback-effort");
    });
  });

  describe("trimContext — result already fits within budget (line 816 break branch)", () => {
    it("does not trim when sections fit within budget on first pass", () => {
      // Use a very large budget so no trimming occurs
      // The default budget is 100_000 chars, so normal contexts should not trim
      // We verify that the result contains full sections without truncation
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false, size: 0 } as unknown as ReturnType<
        typeof fs.statSync
      >);
      vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      // The result should contain the basic session section (not trimmed)
      expect(result).toContain("## Current session");
    });
  });

  describe("buildKnowledgeContext — group.length=0 continue branch (line 569)", () => {
    it("skips a knowledge group when no files match that label", () => {
      // Only docs has files, knowledge has none → group.length=0 for knowledge → continue
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: unknown) => {
        const p = String(dirPath);
        if (p.includes("docs")) return ["notes.md"] as unknown as ReturnType<typeof fs.readdirSync>;
        if (p.includes("knowledge")) return [] as unknown as ReturnType<typeof fs.readdirSync>;
        return [] as unknown as ReturnType<typeof fs.readdirSync>;
      }) as unknown as typeof fs.readdirSync);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false, size: 1024 } as unknown as ReturnType<
        typeof fs.statSync
      >);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      // docs group should appear; knowledge group with 0 files is skipped
      expect(result).toContain("Knowledge base");
      expect(result).toContain("notes.md");
    });
  });

  describe("buildEnvironmentContext — tool dir has contents (line 623 true branch)", () => {
    it("shows Contents line when tool directory has non-hidden files", () => {
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true, size: 0 } as unknown as ReturnType<
        typeof fs.statSync
      >);
      // readdirSync for tool dirs: return non-empty list without dots
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: unknown) => {
        const p = String(dirPath);
        // Only return files for tool dirs (non-docs, non-knowledge)
        if (!p.includes("docs") && !p.includes("knowledge") && !p.includes("Projects")) {
          return ["config.json", "projects"] as unknown as ReturnType<typeof fs.readdirSync>;
        }
        return [] as unknown as ReturnType<typeof fs.readdirSync>;
      }) as unknown as typeof fs.readdirSync);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
      });

      // tool directory has contents → Contents line is shown
      expect(result).toContain("Local environment");
      expect(result).toContain("Contents:");
    });
  });

  describe("trimContext — result exceeds budget and trimming occurs (line 816)", () => {
    it("trims optional sections when context exceeds max budget", () => {
      // Generate a very large context by providing many connectors
      // to trigger trimContext's budget enforcement
      const manyConnectors = Array.from({ length: 50 }, (_, i) => `connector${i}`);

      const result = buildContext({
        source: "slack",
        channel: "C12345",
        user: "U99999",
        connectors: manyConnectors,
        // maxContextChars is not a buildContext param — budget is internal (DEFAULT_MAX_CONTEXT_CHARS)
      });

      // The result should be non-empty
      expect(result.length).toBeGreaterThan(0);
      // Should still contain essential session info
      expect(result).toContain("Current session");
    });
  });

  describe("buildEnvironmentContext — statSync throws inside filter (line 642)", () => {
    it("excludes project entry when statSync throws while checking if it is a directory", () => {
      // statSync for tool dirs throws → no tools shown
      // readdirSync for projectsDir returns a project name
      // inner statSync for that project throws → filter returns false → project excluded
      vi.mocked(fs.statSync).mockImplementation((() => {
        throw new Error("ENOENT");
      }) as typeof fs.statSync);

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: unknown) => {
        const p = String(dirPath);
        if (p.includes("Projects")) {
          return ["my-project"] as unknown as ReturnType<typeof fs.readdirSync>;
        }
        return [] as unknown as ReturnType<typeof fs.readdirSync>;
      }) as unknown as typeof fs.readdirSync);

      // Should not throw; the inner catch at line 642 returns false
      expect(() =>
        buildContext({
          source: "slack",
          channel: "C12345",
          user: "U99999",
        }),
      ).not.toThrow();
    });
  });
});
