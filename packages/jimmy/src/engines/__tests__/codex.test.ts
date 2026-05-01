import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineRunOpts, StreamDelta } from "../../shared/types.js";
import { CodexEngine } from "../codex.js";

// Mock child_process.spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";

const mockSpawn = vi.mocked(spawn);

interface MockProcess {
  emit: EventEmitter["emit"];
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { end: ReturnType<typeof vi.fn> };
  pid: number;
  exitCode: number | null;
  killed: boolean;
  kill: ReturnType<typeof vi.fn>;
}

function createMockProcess(): MockProcess {
  const emitter = new EventEmitter();
  const proc: MockProcess = Object.assign(emitter, {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: { end: vi.fn() },
    pid: 22222,
    exitCode: null as number | null,
    killed: false,
    kill: vi.fn(() => {
      proc.killed = true;
      return true;
    }),
  });
  return proc;
}

describe("CodexEngine", () => {
  let engine: CodexEngine;

  beforeEach(() => {
    engine = new CodexEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Identity ─────────────────────────────────────────────────────────────

  describe("identity", () => {
    it("has name 'codex'", () => {
      expect(engine.name).toBe("codex");
    });

    it("implements InterruptibleEngine interface", () => {
      expect(typeof engine.kill).toBe("function");
      expect(typeof engine.isAlive).toBe("function");
      expect(typeof engine.killAll).toBe("function");
      expect(typeof engine.run).toBe("function");
    });
  });

  // ── 2. Lifecycle (kill / isAlive / killAll) without spawn ────────────────────

  describe("lifecycle with no running processes", () => {
    it("isAlive returns false for unknown session", () => {
      expect(engine.isAlive("nonexistent")).toBe(false);
    });

    it("kill does not throw for unknown session", () => {
      expect(() => engine.kill("nonexistent")).not.toThrow();
    });

    it("killAll does not throw when no processes", () => {
      expect(() => engine.killAll()).not.toThrow();
    });
  });

  // ── 3. buildFreshArgs (via any cast) ─────────────────────────────────────────

  describe("buildFreshArgs (internal)", () => {
    // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
    const bfa = (opts: EngineRunOpts, prompt: string) => (engine as any).buildFreshArgs(opts, prompt);

    it("starts with 'exec'", () => {
      const args = bfa({ prompt: "q", cwd: "/tmp" }, "q");
      expect(args[0]).toBe("exec");
    });

    it("includes --model when specified", () => {
      const args = bfa({ prompt: "q", cwd: "/tmp", model: "o4-mini" }, "q");
      expect(args).toContain("--model");
      expect(args).toContain("o4-mini");
    });

    it("includes effort config when effortLevel is not default", () => {
      const args = bfa({ prompt: "q", cwd: "/tmp", effortLevel: "high" }, "q");
      expect(args).toContain("-c");
      expect(args.some((a: string) => a.includes("high"))).toBe(true);
    });

    it("does NOT include effort config when effortLevel is 'default'", () => {
      const args = bfa({ prompt: "q", cwd: "/tmp", effortLevel: "default" }, "q");
      expect(args).not.toContain("-c");
    });

    it("includes --json and --color never", () => {
      const args = bfa({ prompt: "q", cwd: "/tmp" }, "q");
      expect(args).toContain("--json");
      expect(args).toContain("never");
    });

    it("includes -C with cwd", () => {
      const args = bfa({ prompt: "q", cwd: "/my/dir" }, "q");
      expect(args).toContain("-C");
      expect(args).toContain("/my/dir");
    });

    it("appends cliFlags", () => {
      const args = bfa({ prompt: "q", cwd: "/tmp", cliFlags: ["--flag1"] }, "q");
      expect(args).toContain("--flag1");
    });

    it("puts prompt as last argument", () => {
      const args = bfa({ prompt: "q", cwd: "/tmp" }, "my-prompt");
      expect(args[args.length - 1]).toBe("my-prompt");
    });
  });

  // ── 4. buildResumeArgs (via any cast) ────────────────────────────────────────

  describe("buildResumeArgs (internal)", () => {
    // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
    const bra = (opts: EngineRunOpts, prompt: string) => (engine as any).buildResumeArgs(opts, prompt);

    it("starts with 'exec resume'", () => {
      const args = bra({ prompt: "q", cwd: "/tmp", resumeSessionId: "tid-abc" }, "q");
      expect(args[0]).toBe("exec");
      expect(args[1]).toBe("resume");
    });

    it("includes resumeSessionId before prompt", () => {
      const args = bra({ prompt: "q", cwd: "/tmp", resumeSessionId: "tid-xyz" }, "my-prompt");
      const tidIdx = args.indexOf("tid-xyz");
      const promptIdx = args.indexOf("my-prompt");
      expect(tidIdx).toBeGreaterThan(-1);
      expect(promptIdx).toBeGreaterThan(tidIdx);
    });

    it("throws when resumeSessionId is not provided", () => {
      expect(() => bra({ prompt: "q", cwd: "/tmp" }, "q")).toThrow("resumeSessionId is required");
    });

    it("includes --model when specified", () => {
      const args = bra({ prompt: "q", cwd: "/tmp", resumeSessionId: "t1", model: "o4" }, "q");
      expect(args).toContain("--model");
      expect(args).toContain("o4");
    });
  });

  // ── 5. processJsonlLine (via any cast) ───────────────────────────────────────

  describe("processJsonlLine (internal)", () => {
    // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
    const pjl = (line: string) => (engine as any).processJsonlLine(line);

    it("returns null for empty line", () => {
      expect(pjl("")).toBeNull();
      expect(pjl("   ")).toBeNull();
    });

    it("returns null for unparseable JSON", () => {
      expect(pjl("not json")).toBeNull();
    });

    it("parses thread.started → thread_id", () => {
      const line = JSON.stringify({ type: "thread.started", thread_id: "th-abc" });
      const r = pjl(line);
      expect(r?.type).toBe("thread_id");
      expect(r?.threadId).toBe("th-abc");
    });

    it("parses item.started command_execution → tool_start", () => {
      const line = JSON.stringify({
        type: "item.started",
        item: { type: "command_execution", command: "ls -la", id: "cmd-1" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_start");
      expect(r?.delta.toolName).toBe("command_execution");
      expect(r?.delta.content).toContain("ls -la");
    });

    it("parses item.started file_edit → tool_start", () => {
      const line = JSON.stringify({
        type: "item.started",
        item: { type: "file_edit", file_path: "/src/foo.ts", id: "fe-1" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_start");
      expect(r?.delta.toolName).toBe("file_edit");
      expect(r?.delta.content).toContain("foo.ts");
    });

    it("parses item.started file_read → tool_start", () => {
      const line = JSON.stringify({
        type: "item.started",
        item: { type: "file_read", filename: "bar.ts", id: "fr-1" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_start");
      expect(r?.delta.toolName).toBe("file_read");
    });

    it("returns null for item.started with unknown item type", () => {
      const line = JSON.stringify({
        type: "item.started",
        item: { type: "unknown_item" },
      });
      expect(pjl(line)).toBeNull();
    });

    it("returns null for item.started without item field", () => {
      const line = JSON.stringify({ type: "item.started" });
      expect(pjl(line)).toBeNull();
    });

    it("parses item.completed agent_message → text", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "Hello from codex!" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("text");
      expect(r?.delta.content).toBe("Hello from codex!");
    });

    it("returns null for agent_message with empty text", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "" },
      });
      expect(pjl(line)).toBeNull();
    });

    it("parses item.completed command_execution → tool_end", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "echo hi",
          aggregated_output: "hi",
          exit_code: 0,
        },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_end");
      expect(r?.delta.type).toBe("tool_result");
      expect(r?.delta.content).toContain("hi");
    });

    it("parses item.completed command_execution with no output", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "command_execution", command: "exit", aggregated_output: "", exit_code: 0 },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_end");
      expect(r?.delta.content).toContain("exit (exit 0)");
    });

    it("parses item.completed file_edit → tool_end", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "file_edit", file_path: "/src/a.ts" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_end");
      expect(r?.delta.content).toContain("a.ts");
    });

    it("parses item.completed file_read → tool_end", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "file_read", file_path: "/src/b.ts" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_end");
      expect(r?.delta.content).toContain("b.ts");
    });

    it("parses item.completed error → error", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "error", message: "Something failed" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("error");
      expect(r?.message).toBe("Something failed");
    });

    it("suppresses Under-development features warning", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "error", message: "Under-development features not available" },
      });
      expect(pjl(line)).toBeNull();
    });

    it("suppresses Model metadata warning", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "error", message: "Model metadata fetch failed" },
      });
      expect(pjl(line)).toBeNull();
    });

    it("returns null for item.completed with unknown item type", () => {
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "unknown_item" },
      });
      expect(pjl(line)).toBeNull();
    });

    it("returns null for item.completed without item", () => {
      const line = JSON.stringify({ type: "item.completed" });
      expect(pjl(line)).toBeNull();
    });

    it("parses turn.completed → usage", () => {
      const line = JSON.stringify({ type: "turn.completed" });
      const r = pjl(line);
      expect(r?.type).toBe("usage");
    });

    it("parses turn.failed → turn_failed", () => {
      const line = JSON.stringify({
        type: "turn.failed",
        error: { message: "Turn failed due to X" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("turn_failed");
      expect(r?.message).toBe("Turn failed due to X");
    });

    it("parses error → error", () => {
      const line = JSON.stringify({ type: "error", message: "Top-level error" });
      const r = pjl(line);
      expect(r?.type).toBe("error");
      expect(r?.message).toBe("Top-level error");
    });

    it("returns null for unrecognized event type", () => {
      const line = JSON.stringify({ type: "future_event", data: "x" });
      expect(pjl(line)).toBeNull();
    });
  });

  // ── 6. run() — successful run ────────────────────────────────────────────────

  describe("run() — success", () => {
    it("resolves with result text and thread_id", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "hello", cwd: "/tmp", sessionId: "cx-1" });

      const events = [
        JSON.stringify({ type: "thread.started", thread_id: "th-cx-1" }),
        "\n",
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "Hello from Codex!" } }),
        "\n",
        JSON.stringify({ type: "turn.completed" }),
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.sessionId).toBe("th-cx-1");
      expect(result.result).toBe("Hello from Codex!");
      expect(result.numTurns).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("uses resumeSessionId for resume args", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "continue",
        cwd: "/tmp",
        resumeSessionId: "th-resume-1",
        sessionId: "cx-resume",
      });

      proc.stdout.emit(
        "data",
        Buffer.from(
          `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "Resumed!" } })}\n`,
        ),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("Resumed!");
      const args = mockSpawn.mock.lastCall?.[1] as string[];
      expect(args).toContain("resume");
      expect(args).toContain("th-resume-1");
    });

    it("prepends systemPrompt to prompt", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "user task",
        cwd: "/tmp",
        systemPrompt: "Be precise.",
        sessionId: "cx-sys",
      });

      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done" } })}\n`),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      const args = mockSpawn.mock.lastCall?.[1] as string[];
      const promptArg = args[args.length - 1];
      expect(promptArg).toContain("Be precise.");
      expect(promptArg).toContain("user task");
    });

    it("appends attachments to prompt", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "review",
        cwd: "/tmp",
        attachments: ["/a/b.ts"],
        sessionId: "cx-att",
      });

      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok" } })}\n`),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      const args = mockSpawn.mock.lastCall?.[1] as string[];
      const promptArg = args[args.length - 1];
      expect(promptArg).toContain("/a/b.ts");
    });

    it("defaults bin to 'codex'", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-bin" });
      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok" } })}\n`),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      expect(mockSpawn).toHaveBeenCalledWith("codex", expect.any(Array), expect.any(Object));
    });

    it("uses custom bin when specified", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", bin: "/custom/codex", sessionId: "cx-cbin" });
      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok" } })}\n`),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      expect(mockSpawn).toHaveBeenCalledWith("/custom/codex", expect.any(Array), expect.any(Object));
    });
  });

  // ── 7. run() — streaming ────────────────────────────────────────────────────

  describe("run() — streaming", () => {
    it("streams tool_start, tool_end and text deltas", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "do work",
        cwd: "/tmp",
        sessionId: "cx-stream",
        onStream: (d) => deltas.push(d),
      });

      const events = [
        JSON.stringify({ type: "thread.started", thread_id: "th-s1" }),
        "\n",
        JSON.stringify({
          type: "item.started",
          item: { type: "command_execution", command: "ls", id: "cmd-s1" },
        }),
        "\n",
        JSON.stringify({
          type: "item.completed",
          item: { type: "command_execution", command: "ls", aggregated_output: "file.ts", exit_code: 0 },
        }),
        "\n",
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "Done." } }),
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("Done.");
      expect(deltas.some((d) => d.type === "tool_use" && d.toolName === "command_execution")).toBe(true);
      expect(deltas.some((d) => d.type === "tool_result")).toBe(true);
      expect(deltas.some((d) => d.type === "text" && d.content === "Done.")).toBe(true);
    });

    it("streams error event", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cx-err-stream",
        onStream: (d) => deltas.push(d),
      });

      proc.stdout.emit("data", Buffer.from(`${JSON.stringify({ type: "error", message: "API error occurred" })}\n`));
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await p;
      expect(result.error).toBeDefined();
      expect(deltas.some((d) => d.type === "error")).toBe(true);
    });

    it("streams turn_failed event", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cx-tf-stream",
        onStream: (d) => deltas.push(d),
      });

      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "turn.failed", error: { message: "Turn failed hard" } })}\n`),
      );
      proc.exitCode = 1;
      proc.emit("close", 1);

      await p;
      expect(deltas.some((d) => d.type === "error" && String(d.content).includes("Turn failed hard"))).toBe(true);
    });
  });

  // ── 8. run() — error scenarios ───────────────────────────────────────────────

  describe("run() — error scenarios", () => {
    it("rejects on spawn error", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-spawn-err" });
      proc.emit("error", new Error("ENOENT: codex not found"));

      await expect(p).rejects.toThrow("Failed to spawn Codex CLI");
    });

    it("resolves with error on non-zero exit with no thread", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-nz" });
      proc.stderr.emit("data", Buffer.from("codex: error occurred"));
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await p;
      expect(result.error).toContain("1");
    });

    it("resolves with result when non-zero exit but thread_id acquired", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-partial" });

      const events = [
        JSON.stringify({ type: "thread.started", thread_id: "th-partial" }),
        "\n",
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "partial answer" } }),
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await p;
      expect(result.sessionId).toBe("th-partial");
      expect(result.result).toBe("partial answer");
    });

    it("resolves with terminationReason when killed", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "long task", cwd: "/tmp", sessionId: "cx-kill" });
      engine.kill("cx-kill", "User cancelled");

      proc.exitCode = null;
      proc.emit("close", null);

      const result = await p;
      expect(result.error).toBe("User cancelled");
    });

    it("processes remaining lineBuf on close", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-buf" });

      // Send data without trailing newline — will be in lineBuf at close
      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "thread.started", thread_id: "th-buf" })));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.sessionId).toBe("th-buf");
    });
  });

  // ── 9. run() — isAlive tracking ─────────────────────────────────────────────

  describe("run() — isAlive tracking", () => {
    it("killAll kills all running sessions", async () => {
      const proc1 = createMockProcess();
      const proc2 = createMockProcess();
      mockSpawn
        .mockReturnValueOnce(proc1 as unknown as ChildProcess)
        .mockReturnValueOnce(proc2 as unknown as ChildProcess);

      const p1 = engine.run({ prompt: "q1", cwd: "/tmp", sessionId: "cx-all-1" });
      const p2 = engine.run({ prompt: "q2", cwd: "/tmp", sessionId: "cx-all-2" });

      engine.killAll();

      proc1.exitCode = null;
      proc1.emit("close", null);
      proc2.exitCode = null;
      proc2.emit("close", null);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.error).toContain("gateway shutting down");
      expect(r2.error).toContain("gateway shutting down");
    });
  });

  // ── Additional branch coverage tests ────────────────────────────────────────

  describe("Additional branch coverage tests", () => {
    // ── processJsonlLine: tool_call / tool_output (alias types) ──────────────
    it("processJsonlLine: item.started file_edit with filename field", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const pjl = (line: string) => (engine as any).processJsonlLine(line);
      const line = JSON.stringify({
        type: "item.started",
        item: { type: "file_edit", filename: "myfile.ts", id: "fe-fn" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_start");
      expect(r?.delta.content).toContain("myfile.ts");
    });

    it("processJsonlLine: item.started file_read with filename field", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const pjl = (line: string) => (engine as any).processJsonlLine(line);
      const line = JSON.stringify({
        type: "item.started",
        item: { type: "file_read", filename: "readme.md", id: "fr-fn" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_start");
      expect(r?.delta.toolName).toBe("file_read");
    });

    it("processJsonlLine: item.completed file_edit with filename field fallback", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const pjl = (line: string) => (engine as any).processJsonlLine(line);
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "file_edit", filename: "other.ts" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_end");
      expect(r?.delta.content).toContain("other.ts");
    });

    it("processJsonlLine: item.completed file_read with filename field fallback", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const pjl = (line: string) => (engine as any).processJsonlLine(line);
      const line = JSON.stringify({
        type: "item.completed",
        item: { type: "file_read", filename: "config.json" },
      });
      const r = pjl(line);
      expect(r?.type).toBe("tool_end");
      expect(r?.delta.content).toContain("config.json");
    });

    it("processJsonlLine: turn.failed with no error field returns default message", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const pjl = (line: string) => (engine as any).processJsonlLine(line);
      const line = JSON.stringify({ type: "turn.failed" });
      const r = pjl(line);
      expect(r?.type).toBe("turn_failed");
      expect(r?.message).toBe("Turn failed");
    });

    it("processJsonlLine: top-level error with no message field", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const pjl = (line: string) => (engine as any).processJsonlLine(line);
      const line = JSON.stringify({ type: "error" });
      const r = pjl(line);
      expect(r?.type).toBe("error");
      expect(r?.message).toBe("Unknown error");
    });

    // ── lineBuf flush on close: text / usage / error / turn_failed ───────────
    it("processes remaining lineBuf text on close", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cx-buf-text",
        onStream: (d) => deltas.push(d),
      });

      // Send agent_message without trailing newline (stays in lineBuf at close)
      proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "buf-answer" } })),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("buf-answer");
    });

    it("processes remaining lineBuf usage on close", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-buf-usage" });

      const events = [
        JSON.stringify({ type: "thread.started", thread_id: "th-bu" }),
        "\n",
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done" } }),
        "\n",
      ].join("");
      proc.stdout.emit("data", Buffer.from(events));
      // Turn.completed without trailing newline in lineBuf at close
      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "turn.completed" })));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.numTurns).toBe(1);
    });

    it("processes remaining lineBuf error on close", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-buf-err" });

      proc.stdout.emit(
        "data",
        Buffer.from(
          [
            JSON.stringify({ type: "thread.started", thread_id: "th-be" }),
            "\n",
          ].join(""),
        ),
      );
      // error without trailing newline
      proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ type: "item.completed", item: { type: "error", message: "buf error msg" } })),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.error).toBe("buf error msg");
    });

    it("processes remaining lineBuf turn_failed on close", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-buf-tf" });

      proc.stdout.emit(
        "data",
        Buffer.from(
          [JSON.stringify({ type: "thread.started", thread_id: "th-btf" }), "\n"].join(""),
        ),
      );
      // turn.failed without trailing newline
      proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ type: "turn.failed", error: { message: "buf turn fail" } })),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.error).toBe("buf turn fail");
    });

    // ── buildResumeArgs: effortLevel in resume mode ───────────────────────────
    it("buildResumeArgs includes effort config when effortLevel is not default", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const bra = (opts: EngineRunOpts, prompt: string) => (engine as any).buildResumeArgs(opts, prompt);
      const args = bra({ prompt: "q", cwd: "/tmp", resumeSessionId: "t1", effortLevel: "high" }, "q");
      expect(args).toContain("-c");
      expect(args.some((a: string) => a.includes("high"))).toBe(true);
    });

    it("buildResumeArgs does NOT include effort config when effortLevel is 'default'", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const bra = (opts: EngineRunOpts, prompt: string) => (engine as any).buildResumeArgs(opts, prompt);
      const args = bra({ prompt: "q", cwd: "/tmp", resumeSessionId: "t1", effortLevel: "default" }, "q");
      expect(args).not.toContain("-c");
    });

    // ── non-zero exit + no thread + turnError (errMsg from turnError) ─────────
    it("resolves with turnError message on non-zero exit with no thread", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cx-te-nz",
        onStream: (d) => deltas.push(d),
      });

      // turn_failed without thread_id
      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "turn.failed", error: { message: "model overloaded" } })}\n`),
      );
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await p;
      expect(result.error).toBe("model overloaded");
    });

    // ── close event: settled=true guard (if settled return) ─────────────────
    it("close event: duplicate close event is ignored after first close", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-settled-close" });

      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok-sc" } })}\n`),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);
      // Second close event — should be ignored (settled=true)
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("ok-sc");
    });

    // ── error event: settled=true guard ──────────────────────────────────────
    it("error event after close: duplicate error is ignored after settled", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-settled-err" });

      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok-se-cx" } })}\n`),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);
      // Error event after close — should be ignored (settled=true)
      proc.emit("error", new Error("late error"));

      const result = await p;
      expect(result.result).toBe("ok-se-cx");
    });

    // ── signalProcess: early return when proc already exited ─────────────────
    it("signalProcess: does nothing when proc.exitCode is non-null", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cx-sig-early",
        onStream: vi.fn(),
      });

      // Set exitCode to non-null before kill → signalProcess returns immediately
      proc.exitCode = 0;
      engine.kill("cx-sig-early", "Interrupted: early exit cx");

      proc.emit("close", 0);
      const result = await p;
      expect(result.error).toBe("Interrupted: early exit cx");
    });

    // ── kill: SIGKILL not sent when proc exits before timeout ────────────────
    it("kill: SIGKILL not sent when process exits before 2s timeout", async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cx-sigkill-skip",
        onStream: vi.fn(),
      });

      engine.kill("cx-sigkill-skip", "Interrupted: skip sigkill cx");

      proc.exitCode = 0;
      proc.emit("close", null);

      // Advance past 2s — SIGKILL callback fires but exitCode !== null
      await vi.advanceTimersByTimeAsync(2100);

      const result = await p;
      expect(result.error).toBe("Interrupted: skip sigkill cx");
      vi.useRealTimers();
    });

    // ── kill: SIGKILL タイムアウトコールバック ────────────────────────────────
    it("kill: SIGKILL is sent when process does not exit within timeout", async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cx-sigkill",
        onStream: vi.fn(),
      });

      // Kill then advance timers past 2000ms
      engine.kill("cx-sigkill", "Interrupted: test sigkill cx");
      await vi.advanceTimersByTimeAsync(2100);

      // Simulate process finally closing
      proc.exitCode = null;
      proc.emit("close", null);

      const result = await p;
      expect(result.error).toBe("Interrupted: test sigkill cx");
      vi.useRealTimers();
    });

    // ── streaming: invalid JSON in stream → parsed=null → continue ───────────
    it("streaming: null parsed line (invalid JSON) is skipped", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cx-null-parsed",
        onStream: (d) => deltas.push(d),
      });

      const events = [
        "not-valid-json",
        "\n",
        JSON.stringify({ type: "thread.started", thread_id: "th-np" }),
        "\n",
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok-null" } }),
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("ok-null");
    });

    // ── streaming without onStream: tool_start/tool_end/error/turn_failed ─────
    it("tool_start/tool_end without onStream (no callback) runs without error", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      // No onStream provided → onStream=null → if(onStream) branches are false
      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-no-stream" });

      const events = [
        JSON.stringify({ type: "thread.started", thread_id: "th-ns" }),
        "\n",
        JSON.stringify({ type: "item.started", item: { type: "command_execution", command: "ls", id: "cmd-ns" } }),
        "\n",
        JSON.stringify({
          type: "item.completed",
          item: { type: "command_execution", command: "ls", aggregated_output: "file.ts", exit_code: 0 },
        }),
        "\n",
        JSON.stringify({ type: "item.completed", item: { type: "error", message: "some warning" } }),
        "\n",
        JSON.stringify({ type: "turn.failed", error: { message: "turn err no stream" } }),
        "\n",
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done-ns" } }),
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("done-ns");
    });

    // ── stderr 10KB rolling window ────────────────────────────────────────────
    it("stderr rolling window: keeps only last 10KB", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-stderr-big" });

      // Send > 10KB of stderr
      proc.stderr.emit("data", Buffer.from("E".repeat(11 * 1024)));

      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok-se" } })}\n`),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("ok-se");
    });

    // ── lineBuf at close: parsed=null (invalid remaining buf) ────────────────
    it("lineBuf at close: invalid JSON in lineBuf → parsed=null → if(parsed) else path", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-null-lbuf" });

      proc.stdout.emit(
        "data",
        Buffer.from([JSON.stringify({ type: "thread.started", thread_id: "th-nlb" }), "\n"].join("")),
      );
      // Invalid JSON without newline → stays in lineBuf, processJsonlLine returns null
      proc.stdout.emit("data", Buffer.from("not-json-at-close"));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.sessionId).toBe("th-nlb");
    });

    // ── buildFreshArgs: cwd 未設定 ───────────────────────────────────────────
    it("buildFreshArgs: no cwd → -C not added", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const bfa = (opts: EngineRunOpts, prompt: string) => (engine as any).buildFreshArgs(opts, prompt);
      // cwd="" → falsy → else path for opts.cwd check
      const args = bfa({ prompt: "q", cwd: "" }, "q");
      expect(args).not.toContain("-C");
    });

    // ── buildResumeArgs: cliFlags ─────────────────────────────────────────────
    it("buildResumeArgs includes cliFlags", () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const bra = (opts: EngineRunOpts, prompt: string) => (engine as any).buildResumeArgs(opts, prompt);
      const args = bra({ prompt: "q", cwd: "/tmp", resumeSessionId: "t1", cliFlags: ["--flag-x"] }, "q");
      expect(args).toContain("--flag-x");
    });
  });

  // ── 10. buildCleanEnv ───────────────────────────────────────────────────────

  describe("buildCleanEnv", () => {
    it("strips CLAUDE_CODE_* vars", async () => {
      const origVar = process.env.CLAUDE_CODE_FOO;
      process.env.CLAUDE_CODE_FOO = "stripped";

      try {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
        const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-env1" });
        proc.stdout.emit(
          "data",
          Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok" } })}\n`),
        );
        proc.exitCode = 0;
        proc.emit("close", 0);
        await p;

        const env = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string>;
        expect(env.CLAUDE_CODE_FOO).toBeUndefined();
      } finally {
        if (origVar !== undefined) process.env.CLAUDE_CODE_FOO = origVar;
        else delete process.env.CLAUDE_CODE_FOO;
      }
    });

    it("strips CODEX vars", async () => {
      const origVar = process.env.CODEX;
      process.env.CODEX = "stripped";

      try {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
        const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-env2" });
        proc.stdout.emit(
          "data",
          Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok" } })}\n`),
        );
        proc.exitCode = 0;
        proc.emit("close", 0);
        await p;

        const env = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string>;
        expect(env.CODEX).toBeUndefined();
      } finally {
        if (origVar !== undefined) process.env.CODEX = origVar;
        else delete process.env.CODEX;
      }
    });

    it("strips CODEX_* vars", async () => {
      const origVar = process.env.CODEX_API_KEY;
      process.env.CODEX_API_KEY = "secret";

      try {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
        const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-env3" });
        proc.stdout.emit(
          "data",
          Buffer.from(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "ok" } })}\n`),
        );
        proc.exitCode = 0;
        proc.emit("close", 0);
        await p;

        const env = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string>;
        expect(env.CODEX_API_KEY).toBeUndefined();
      } finally {
        if (origVar !== undefined) process.env.CODEX_API_KEY = origVar;
        else delete process.env.CODEX_API_KEY;
      }
    });
  });
});
