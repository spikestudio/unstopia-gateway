import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineRunOpts, StreamDelta } from "../../shared/types.js";
import { ClaudeEngine } from "../claude.js";
import { ClaudeStreamProcessor, parseRateLimitInfo } from "../claude-stream-processor.js";

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
    pid: 11111,
    exitCode: null as number | null,
    killed: false,
    kill: vi.fn(() => {
      proc.killed = true;
      return true;
    }),
  });
  return proc;
}

// Helper: simulate a successful non-streaming run
async function runWithOutput(engine: ClaudeEngine, opts: EngineRunOpts, outputLines: string[], exitCode = 0) {
  const proc = createMockProcess();
  mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

  const resultPromise = engine.run(opts);

  for (const line of outputLines) {
    proc.stdout.emit("data", Buffer.from(line));
  }
  proc.exitCode = exitCode;
  proc.emit("close", exitCode);

  return resultPromise;
}

describe("ClaudeEngine", () => {
  let engine: ClaudeEngine;

  beforeEach(() => {
    engine = new ClaudeEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Identity ─────────────────────────────────────────────────────────────

  describe("identity", () => {
    it("has name 'claude'", () => {
      expect(engine.name).toBe("claude");
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

  // ── 3. run() — successful non-streaming ─────────────────────────────────────

  describe("run() — non-streaming success", () => {
    it("resolves with result from JSON output", async () => {
      const output = JSON.stringify({
        type: "result",
        result: "The answer is 42.",
        session_id: "cl-sess-1",
        total_cost_usd: 0.005,
        duration_ms: 1200,
        num_turns: 2,
      });
      const result = await runWithOutput(engine, { prompt: "question", cwd: "/tmp" }, [output]);
      expect(result.result).toBe("The answer is 42.");
      expect(result.sessionId).toBe("cl-sess-1");
      expect(result.cost).toBe(0.005);
      expect(result.durationMs).toBe(1200);
      expect(result.numTurns).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it("resolves with result from Array JSON output", async () => {
      const output = JSON.stringify([
        { type: "assistant", message: { content: [{ type: "text", text: "thinking..." }] } },
        {
          type: "result",
          result: "Array answer",
          session_id: "cl-arr-1",
          is_error: false,
        },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      expect(result.result).toBe("Array answer");
      expect(result.sessionId).toBe("cl-arr-1");
    });

    it("extracts assistant text from array when result is empty", async () => {
      const output = JSON.stringify([
        {
          type: "assistant",
          content: [{ type: "text", text: "fallback text" }],
        },
        { type: "result", result: "", session_id: "cl-empty" },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      expect(result.result).toBe("fallback text");
    });

    it("extracts text from role:assistant message format", async () => {
      const output = JSON.stringify([
        {
          role: "assistant",
          content: [{ type: "text", text: "role-based fallback" }],
        },
        { type: "result", result: "", session_id: "cl-role" },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      expect(result.result).toBe("role-based fallback");
    });

    it("handles is_error=true in result event", async () => {
      const output = JSON.stringify({
        type: "result",
        result: "Something went wrong",
        session_id: "cl-err",
        is_error: true,
      });
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      expect(result.error).toBeDefined();
      expect(result.result).toBe("");
    });

    it("returns error when JSON parse fails", async () => {
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, ["not valid json!!!!"]);
      expect(result.error).toContain("Failed to parse Claude output");
    });

    it("uses custom bin from opts", async () => {
      const output = JSON.stringify({ type: "result", result: "ok", session_id: "cl-bin" });
      await runWithOutput(engine, { prompt: "q", cwd: "/tmp", bin: "/usr/local/bin/claude" }, [output]);
      expect(mockSpawn).toHaveBeenCalledWith("/usr/local/bin/claude", expect.any(Array), expect.any(Object));
    });

    it("defaults bin to 'claude'", async () => {
      const output = JSON.stringify({ type: "result", result: "ok", session_id: "cl-def" });
      await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      expect(mockSpawn).toHaveBeenCalledWith("claude", expect.any(Array), expect.any(Object));
    });
  });

  // ── 4. run() — args building ─────────────────────────────────────────────────

  describe("run() — args building", () => {
    async function captureArgs(opts: EngineRunOpts): Promise<string[]> {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
      const p = engine.run(opts);
      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok", session_id: "" })));
      proc.exitCode = 0;
      proc.emit("close", 0);
      await p;
      return (mockSpawn.mock.lastCall?.[1] as string[]) ?? [];
    }

    it("includes --model when specified", async () => {
      const args = await captureArgs({ prompt: "q", cwd: "/tmp", model: "claude-opus-4-5" });
      expect(args).toContain("--model");
      expect(args).toContain("claude-opus-4-5");
    });

    it("includes --resume when resumeSessionId is set", async () => {
      const args = await captureArgs({ prompt: "q", cwd: "/tmp", resumeSessionId: "resume-abc" });
      expect(args).toContain("--resume");
      expect(args).toContain("resume-abc");
    });

    it("includes --effort when effortLevel is not default", async () => {
      const args = await captureArgs({ prompt: "q", cwd: "/tmp", effortLevel: "high" });
      expect(args).toContain("--effort");
      expect(args).toContain("high");
    });

    it("does NOT include --effort when effortLevel is 'default'", async () => {
      const args = await captureArgs({ prompt: "q", cwd: "/tmp", effortLevel: "default" });
      expect(args).not.toContain("--effort");
    });

    it("includes --append-system-prompt when systemPrompt is set", async () => {
      const args = await captureArgs({ prompt: "q", cwd: "/tmp", systemPrompt: "You are helpful." });
      expect(args).toContain("--append-system-prompt");
      expect(args).toContain("You are helpful.");
    });

    it("appends attachment list to prompt", async () => {
      const args = await captureArgs({
        prompt: "review this",
        cwd: "/tmp",
        attachments: ["/a/b.ts", "/c/d.ts"],
      });
      const promptArg = args.find((a) => a.includes("Attached files:"));
      expect(promptArg).toContain("- /a/b.ts");
      expect(promptArg).toContain("- /c/d.ts");
    });

    it("prompt comes before --mcp-config", async () => {
      const args = await captureArgs({
        prompt: "the-prompt",
        cwd: "/tmp",
        mcpConfigPath: "/etc/mcp.json",
      });
      const promptIdx = args.indexOf("the-prompt");
      const mcpIdx = args.indexOf("--mcp-config");
      expect(promptIdx).toBeGreaterThan(-1);
      expect(mcpIdx).toBeGreaterThan(promptIdx);
    });

    it("appends cliFlags", async () => {
      const args = await captureArgs({ prompt: "q", cwd: "/tmp", cliFlags: ["--debug", "--trace"] });
      expect(args).toContain("--debug");
      expect(args).toContain("--trace");
    });

    it("includes --include-partial-messages in streaming mode", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
      const p = engine.run({ prompt: "q", cwd: "/tmp", onStream: vi.fn(), sessionId: "stream-args" });
      proc.emit("error", new Error("spawn error"));
      try {
        await p;
      } catch {
        /* expected */
      }
      const args = (mockSpawn.mock.lastCall?.[1] as string[]) ?? [];
      expect(args).toContain("--include-partial-messages");
    });
  });

  // ── 5. run() — error scenarios ───────────────────────────────────────────────

  describe("run() — error scenarios", () => {
    it("rejects on spawn error", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
      const p = engine.run({ prompt: "q", cwd: "/tmp" });
      proc.emit("error", new Error("ENOENT: claude not found"));
      await expect(p).rejects.toThrow("Failed to spawn Claude CLI");
    });

    it("resolves with error message on non-zero exit", async () => {
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [], 127);
      expect(result.error).toContain("127");
    });

    it("returns terminationReason when session is killed", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "long task", cwd: "/tmp", sessionId: "kill-sess" });
      engine.kill("kill-sess", "User cancelled");

      proc.exitCode = null;
      proc.emit("close", null);

      const result = await p;
      expect(result.error).toBe("User cancelled");
    });

    it("resolves with non-zero exit + stdout JSON (array with result)", async () => {
      const output = JSON.stringify([{ type: "result", result: "partial", session_id: "cl-nz", is_error: false }]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output], 1);
      expect(result.result).toBe("partial");
    });

    it("resolves with non-zero exit + stdout JSON (object result)", async () => {
      const output = JSON.stringify({
        type: "result",
        result: "obj partial",
        session_id: "cl-obj",
        is_error: false,
      });
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output], 1);
      expect(result.result).toBe("obj partial");
    });
  });

  // ── 6. run() — streaming ────────────────────────────────────────────────────

  describe("run() — streaming", () => {
    it("streams text deltas from stream_event content_block_delta", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "stream-1",
        onStream: (d) => deltas.push(d),
      });

      const events = [
        JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } },
        }),
        "\n",
        JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_delta", delta: { type: "text_delta", text: "world!" } },
        }),
        "\n",
        JSON.stringify({ type: "result", result: "Hello world!", session_id: "s1" }),
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("Hello world!");
      expect(deltas.some((d) => d.type === "text" && d.content === "Hello ")).toBe(true);
      expect(deltas.some((d) => d.type === "text" && d.content === "world!")).toBe(true);
    });

    it("streams tool_use and tool_result events", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "stream-tool",
        onStream: (d) => deltas.push(d),
      });

      const events = [
        JSON.stringify({
          type: "stream_event",
          event: {
            type: "content_block_start",
            content_block: { type: "tool_use", name: "read_file", id: "tool-1" },
          },
        }),
        "\n",
        JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_stop" },
        }),
        "\n",
        JSON.stringify({ type: "result", result: "done", session_id: "s2" }),
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      expect(deltas.some((d) => d.type === "tool_use" && d.toolName === "read_file")).toBe(true);
      expect(deltas.some((d) => d.type === "tool_result")).toBe(true);
    });

    it("streams text_snapshot from assistant message", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "stream-snap",
        onStream: (d) => deltas.push(d),
      });

      const events = [
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "snapshot text" }] },
        }),
        "\n",
        JSON.stringify({ type: "result", result: "snapshot text", session_id: "s3" }),
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      expect(deltas.some((d) => d.type === "text_snapshot" && d.content === "snapshot text")).toBe(true);
    });

    it("emits status delta on retry when transient error occurs with prior work", async () => {
      // Retry is triggered when: isTransientError=true AND isDeadSessionError=false
      // isDeadSessionError=false requires numTurns>0 (work was done before the error).
      // Achieve this with streaming + a result event (num_turns:1) on non-zero exit.
      const proc1 = createMockProcess();
      const proc2 = createMockProcess();

      mockSpawn.mockImplementation(() => {
        if (mockSpawn.mock.calls.length === 1) return proc1 as unknown as ChildProcess;
        setTimeout(() => {
          proc2.stdout.emit(
            "data",
            Buffer.from(`${JSON.stringify({ type: "result", result: "ok", session_id: "s4", num_turns: 1 })}\n`),
          );
          proc2.exitCode = 0;
          proc2.emit("close", 0);
        }, 10);
        return proc2 as unknown as ChildProcess;
      });

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "retry-stream",
        onStream: (d) => deltas.push(d),
      });

      // First attempt: result event with is_error:true, socket hang up message, num_turns:1
      // → numTurns=1 → isDeadSessionError=false
      // → error contains "socket hang up" → isTransientError=true → retry fires
      proc1.stdout.emit(
        "data",
        Buffer.from(
          `${JSON.stringify({
            type: "result",
            result: "socket hang up during request",
            session_id: "s-pre",
            is_error: true,
            num_turns: 1,
          })}\n`,
        ),
      );
      proc1.exitCode = 1;
      proc1.emit("close", 1);

      await p;
      expect(deltas.some((d) => d.type === "status" && String(d.content).includes("Retrying"))).toBe(true);
    }, 10000);

    it("resolves successfully with streaming run including rate_limit_event", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "stream-rl",
        onStream: vi.fn(),
      });

      // rate_limit_event alone (no result event) — falls back to non-streaming parse path
      // Just verify the run completes without hanging
      const rateLimitLine = JSON.stringify({
        type: "rate_limit_event",
        rate_limit_info: { status: "ok", resetsAt: 9999999, rateLimitType: "daily" },
      });
      proc.stdout.emit("data", Buffer.from(`${rateLimitLine}\n`));
      proc.exitCode = 0;
      proc.emit("close", 0);

      // Should resolve (not hang)
      const result = await p;
      expect(result).toBeDefined();
    });

    it("resolves with error when result is_error=true (direct buildEngineResultFromResultEvent)", () => {
      // Test the rate-limit-rejected path directly to avoid retry-loop timeout
      // biome-ignore lint/suspicious/noExplicitAny: intentional private method access for testing
      const build = (engine as any).buildEngineResultFromResultEvent.bind(engine);
      const rateLimit = { status: "rejected", rateLimitType: "daily" };
      const result = build(
        { type: "result", result: "Usage limit hit", session_id: "s-rl2", is_error: true },
        "Usage limit hit",
        undefined,
        rateLimit,
      );
      expect(result.error).toContain("usage limit reached");
      expect(result.rateLimit?.status).toBe("rejected");
    });
  });

  // ── 7. run() — isAlive tracking ─────────────────────────────────────────────

  describe("run() — isAlive tracking", () => {
    it("reports alive while running, false after close", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "alive-cl" });

      expect(engine.isAlive("alive-cl")).toBe(true);

      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok", session_id: "alive-cl" })));
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      expect(engine.isAlive("alive-cl")).toBe(false);
    });

    it("killAll kills all running sessions", async () => {
      const proc1 = createMockProcess();
      const proc2 = createMockProcess();
      mockSpawn
        .mockReturnValueOnce(proc1 as unknown as ChildProcess)
        .mockReturnValueOnce(proc2 as unknown as ChildProcess);

      const p1 = engine.run({ prompt: "q1", cwd: "/tmp", sessionId: "all-1" });
      const p2 = engine.run({ prompt: "q2", cwd: "/tmp", sessionId: "all-2" });

      expect(engine.isAlive("all-1")).toBe(true);
      expect(engine.isAlive("all-2")).toBe(true);

      engine.killAll();

      proc1.exitCode = null;
      proc1.emit("close", null);
      proc2.exitCode = null;
      proc2.emit("close", null);

      await Promise.all([p1, p2]);
    });
  });

  // ── 8. Retry logic ───────────────────────────────────────────────────────────

  describe("retry logic", () => {
    it("does not retry on non-transient error", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp" });
      proc.stderr.emit("data", Buffer.from("Permanent error: bad request"));
      proc.exitCode = 2;
      proc.emit("close", 2);

      await p;
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it("does not retry dead session errors", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", resumeSessionId: "dead-sess" });
      // Simulate dead session output
      proc.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            type: "result",
            result: "Session has expired",
            session_id: "",
            is_error: true,
          }),
        ),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      // Dead session should not retry (only 1 spawn call)
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  // ── 9. buildCleanEnv ────────────────────────────────────────────────────────

  describe("buildCleanEnv", () => {
    it("strips CLAUDECODE env var", async () => {
      const origVar = process.env.CLAUDECODE;
      process.env.CLAUDECODE = "should-be-stripped";

      try {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
        const p = engine.run({ prompt: "q", cwd: "/tmp" });
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok", session_id: "" })));
        proc.exitCode = 0;
        proc.emit("close", 0);
        await p;

        const env = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string>;
        expect(env.CLAUDECODE).toBeUndefined();
      } finally {
        if (origVar !== undefined) process.env.CLAUDECODE = origVar;
        else delete process.env.CLAUDECODE;
      }
    });

    it("strips CLAUDE_CODE_* env vars", async () => {
      const origVar = process.env.CLAUDE_CODE_SECRET;
      process.env.CLAUDE_CODE_SECRET = "secret-value";

      try {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
        const p = engine.run({ prompt: "q", cwd: "/tmp" });
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok", session_id: "" })));
        proc.exitCode = 0;
        proc.emit("close", 0);
        await p;

        const env = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string>;
        expect(env.CLAUDE_CODE_SECRET).toBeUndefined();
      } finally {
        if (origVar !== undefined) process.env.CLAUDE_CODE_SECRET = origVar;
        else delete process.env.CLAUDE_CODE_SECRET;
      }
    });

    it("preserves ANTHROPIC_API_KEY", async () => {
      const origKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = "test-key-123";

      try {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
        const p = engine.run({ prompt: "q", cwd: "/tmp" });
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok", session_id: "" })));
        proc.exitCode = 0;
        proc.emit("close", 0);
        await p;

        const env = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string>;
        expect(env.ANTHROPIC_API_KEY).toBe("test-key-123");
      } finally {
        if (origKey !== undefined) process.env.ANTHROPIC_API_KEY = origKey;
        else delete process.env.ANTHROPIC_API_KEY;
      }
    });
  });

  // ── 10. ClaudeStreamProcessor ─────────────────────────────────────────────────

  describe("ClaudeStreamProcessor", () => {
    // AC-E019-03: 外部プロセスなしにテスト可能な独立クラス
    const psl = (line: string, count = 0, processor?: ClaudeStreamProcessor) =>
      (processor ?? new ClaudeStreamProcessor()).process(line, count);

    it("returns null for empty line", () => {
      expect(psl("")).toBeNull();
      expect(psl("   ")).toBeNull();
    });

    it("returns null for unparseable JSON", () => {
      expect(psl("not json at all")).toBeNull();
    });

    it("returns __result for type='result'", () => {
      const line = JSON.stringify({ type: "result", result: "answer", session_id: "s1" });
      const r = psl(line);
      expect(r?.type).toBe("__result");
      expect((r as { type: "__result"; msg: Record<string, unknown> })?.msg.result).toBe("answer");
    });

    it("returns __rate_limit for type='rate_limit_event'", () => {
      const line = JSON.stringify({
        type: "rate_limit_event",
        rate_limit_info: { status: "ok", resetsAt: 9999 },
      });
      const r = psl(line);
      expect(r?.type).toBe("__rate_limit");
      expect((r as { type: "__rate_limit"; info: { status: string } })?.info.status).toBe("ok");
    });

    it("returns null for rate_limit_event with no valid info", () => {
      const line = JSON.stringify({ type: "rate_limit_event", rate_limit_info: null });
      expect(psl(line)).toBeNull();
    });

    it("returns text_snapshot delta for assistant message with text", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "snapshot" }] },
      });
      const r = psl(line);
      expect(r?.type).toBe("delta");
      expect((r as { type: "delta"; delta: StreamDelta })?.delta.type).toBe("text_snapshot");
      expect((r as { type: "delta"; delta: StreamDelta })?.delta.content).toBe("snapshot");
    });

    it("returns null for assistant message without text content", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "image" }] },
      });
      expect(psl(line)).toBeNull();
    });

    it("returns null for assistant message without message field", () => {
      const line = JSON.stringify({ type: "assistant" });
      expect(psl(line)).toBeNull();
    });

    it("returns __tool_start for content_block_start tool_use", () => {
      const line = JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_start", content_block: { type: "tool_use", name: "bash", id: "t1" } },
      });
      const r = psl(line);
      expect(r?.type).toBe("__tool_start");
      expect((r as { type: "__tool_start"; delta: StreamDelta })?.delta.toolName).toBe("bash");
    });

    it("returns delta text for content_block_delta text_delta when NOT inTool (state=Idle)", () => {
      // AC-E019-01: Idle 状態からのテキストデルタ処理
      const processor = new ClaudeStreamProcessor();
      expect(processor.state).toBe("Idle");
      const line = JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "hello" } },
      });
      const r = processor.process(line, 0);
      expect(r?.type).toBe("delta");
      expect((r as { type: "delta"; delta: StreamDelta })?.delta.type).toBe("text");
      expect((r as { type: "delta"; delta: StreamDelta })?.delta.content).toBe("hello");
    });

    it("returns null for content_block_delta text_delta when state=InTool", () => {
      // AC-E019-01: InTool 状態ではテキストデルタを無視する
      const processor = new ClaudeStreamProcessor();
      // InTool 状態に遷移させる
      const startLine = JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_start", content_block: { type: "tool_use", name: "bash", id: "t1" } },
      });
      processor.process(startLine, 0);
      expect(processor.state).toBe("InTool");

      const line = JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "hello" } },
      });
      expect(processor.process(line, 1)).toBeNull();
    });

    it("returns null for empty text in content_block_delta", () => {
      const line = JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "" } },
      });
      expect(psl(line)).toBeNull();
    });

    it("returns __tool_end for content_block_stop when state=InTool", () => {
      // AC-E019-01: InTool → Idle 遷移
      const processor = new ClaudeStreamProcessor();
      const startLine = JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_start", content_block: { type: "tool_use", name: "bash", id: "t1" } },
      });
      processor.process(startLine, 0);
      expect(processor.state).toBe("InTool");

      const stopLine = JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_stop" },
      });
      const r = processor.process(stopLine, 1);
      expect(r?.type).toBe("__tool_end");
      expect((r as { type: "__tool_end"; delta: StreamDelta })?.delta.type).toBe("tool_result");
      expect(processor.state).toBe("Idle");
    });

    it("returns null for stream_event without event field", () => {
      const line = JSON.stringify({ type: "stream_event" });
      expect(psl(line)).toBeNull();
    });

    it("returns null for stream_event with unknown event type", () => {
      const line = JSON.stringify({
        type: "stream_event",
        event: { type: "some_future_event" },
      });
      expect(psl(line)).toBeNull();
    });

    it("returns null for content_block_start non-tool_use", () => {
      const line = JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_start", content_block: { type: "text" } },
      });
      expect(psl(line)).toBeNull();
    });

    it("returns null for unrecognized top-level type", () => {
      const line = JSON.stringify({ type: "future_type", data: "x" });
      expect(psl(line)).toBeNull();
    });

    it("logs first 5 lines at debug level (no throw)", () => {
      // Just ensure no throw for early lines
      const processor = new ClaudeStreamProcessor();
      for (let i = 0; i <= 5; i++) {
        expect(() => processor.process(JSON.stringify({ type: "result", result: "ok" }), i)).not.toThrow();
      }
    });

    // AC-E019-01: 状態遷移テスト
    describe("AC-E019-01: state transitions", () => {
      it("initial state is Idle", () => {
        const processor = new ClaudeStreamProcessor();
        expect(processor.state).toBe("Idle");
      });

      it("transitions Idle → InTool on content_block_start (tool_use)", () => {
        const processor = new ClaudeStreamProcessor();
        const line = JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_start", content_block: { type: "tool_use", name: "bash", id: "t1" } },
        });
        processor.process(line, 0);
        expect(processor.state).toBe("InTool");
      });

      it("transitions Idle → InText on content_block_delta (text_delta)", () => {
        const processor = new ClaudeStreamProcessor();
        const line = JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_delta", delta: { type: "text_delta", text: "hello" } },
        });
        processor.process(line, 0);
        expect(processor.state).toBe("InText");
      });

      it("transitions InTool → Idle on content_block_stop", () => {
        const processor = new ClaudeStreamProcessor();
        processor.process(
          JSON.stringify({
            type: "stream_event",
            event: { type: "content_block_start", content_block: { type: "tool_use", name: "bash", id: "t1" } },
          }),
          0,
        );
        processor.process(JSON.stringify({ type: "stream_event", event: { type: "content_block_stop" } }), 1);
        expect(processor.state).toBe("Idle");
      });

      it("transitions InText → Idle on content_block_stop", () => {
        const processor = new ClaudeStreamProcessor();
        processor.process(
          JSON.stringify({
            type: "stream_event",
            event: { type: "content_block_delta", delta: { type: "text_delta", text: "hi" } },
          }),
          0,
        );
        processor.process(JSON.stringify({ type: "stream_event", event: { type: "content_block_stop" } }), 1);
        expect(processor.state).toBe("Idle");
      });
    });
  });

  // ── 11. parseRateLimitInfo (exported function) ────────────────────────────────

  describe("parseRateLimitInfo (exported function)", () => {
    it("returns undefined for null", () => {
      expect(parseRateLimitInfo(null)).toBeUndefined();
    });

    it("returns undefined for non-object", () => {
      expect(parseRateLimitInfo("string")).toBeUndefined();
    });

    it("returns undefined for empty object (no recognized fields)", () => {
      expect(parseRateLimitInfo({})).toBeUndefined();
    });

    it("parses resetsAt as numeric string", () => {
      const result = parseRateLimitInfo({ resetsAt: "1234567890" });
      expect(result?.resetsAt).toBe(1234567890);
    });

    it("parses all known fields", () => {
      const result = parseRateLimitInfo({
        status: "ok",
        resetsAt: 9999,
        rateLimitType: "daily",
        overageStatus: "active",
        overageDisabledReason: "none",
        isUsingOverage: true,
      });
      expect(result?.status).toBe("ok");
      expect(result?.rateLimitType).toBe("daily");
      expect(result?.isUsingOverage).toBe(true);
    });
  });
});
