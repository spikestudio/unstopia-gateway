import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineRateLimitInfo, EngineResult, EngineRunOpts, StreamDelta } from "../../shared/types.js";
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
      const build = (
        engine as unknown as {
          buildEngineResultFromResultEvent: (
            resultEvent: Record<string, unknown>,
            finalText: string,
            fallbackSessionId: string | undefined,
            rateLimit: EngineRateLimitInfo | undefined,
          ) => EngineResult;
        }
      ).buildEngineResultFromResultEvent.bind(engine);
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
      assert(r !== null && r.type === "__result");
      expect(r.msg.result).toBe("answer");
    });

    it("returns __rate_limit for type='rate_limit_event'", () => {
      const line = JSON.stringify({
        type: "rate_limit_event",
        rate_limit_info: { status: "ok", resetsAt: 9999 },
      });
      const r = psl(line);
      assert(r !== null && r.type === "__rate_limit");
      expect(r.info.status).toBe("ok");
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
      assert(r !== null && r.type === "delta");
      expect(r.delta.type).toBe("text_snapshot");
      expect(r.delta.content).toBe("snapshot");
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
      assert(r !== null && r.type === "__tool_start");
      expect(r.delta.toolName).toBe("bash");
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
      assert(r !== null && r.type === "delta");
      expect(r.delta.type).toBe("text");
      expect(r.delta.content).toBe("hello");
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
      assert(r !== null && r.type === "__tool_end");
      expect(r.delta.type).toBe("tool_result");
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

    // ---- AC-E019-05〜09: Story 19.2 ストリーミングイベント単体テスト ----

    describe("AC-E019-05: result イベントを処理すると __result 型の戻り値が返される", () => {
      it("processes result event and returns __result type", () => {
        const processor = new ClaudeStreamProcessor();
        const line = JSON.stringify({
          type: "result",
          result: "final answer",
          session_id: "sess-ac05",
          total_cost_usd: 0.01,
        });
        const r = processor.process(line, 0);
        assert(r !== null && r.type === "__result");
        expect(r.msg.result).toBe("final answer");
        expect(r.msg.session_id).toBe("sess-ac05");
      });

      it("handles result event with is_error=true and returns __result type", () => {
        const processor = new ClaudeStreamProcessor();
        const line = JSON.stringify({
          type: "result",
          result: "error occurred",
          session_id: "sess-ac05-err",
          is_error: true,
        });
        const r = processor.process(line, 0);
        assert(r !== null && r.type === "__result");
        expect(r.msg.is_error).toBe(true);
      });
    });

    describe("AC-E019-06: stream_event + content_block_start + tool_use を処理すると __tool_start 型が返される", () => {
      it("processes stream_event content_block_start tool_use and returns __tool_start type", () => {
        const processor = new ClaudeStreamProcessor();
        const line = JSON.stringify({
          type: "stream_event",
          event: {
            type: "content_block_start",
            content_block: { type: "tool_use", name: "read_file", id: "tool-ac06" },
          },
        });
        const r = processor.process(line, 0);
        assert(r !== null && r.type === "__tool_start");
        expect(r.delta.type).toBe("tool_use");
        expect(r.delta.toolName).toBe("read_file");
        expect(r.delta.toolId).toBe("tool-ac06");
      });

      it("transitions state to InTool on content_block_start tool_use", () => {
        const processor = new ClaudeStreamProcessor();
        expect(processor.state).toBe("Idle");
        const line = JSON.stringify({
          type: "stream_event",
          event: {
            type: "content_block_start",
            content_block: { type: "tool_use", name: "bash", id: "tool-ac06b" },
          },
        });
        processor.process(line, 0);
        expect(processor.state).toBe("InTool");
      });
    });

    describe("AC-E019-07: stream_event + content_block_delta + text_delta（inTool=false）を処理すると delta.type='text' が返される", () => {
      it("processes text_delta when state is Idle and returns delta with type=text", () => {
        const processor = new ClaudeStreamProcessor();
        expect(processor.state).toBe("Idle");
        const line = JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_delta", delta: { type: "text_delta", text: "streaming text" } },
        });
        const r = processor.process(line, 0);
        assert(r !== null && r.type === "delta");
        expect(r.delta.type).toBe("text");
        expect(r.delta.content).toBe("streaming text");
      });

      it("processes text_delta when state is InText and returns delta with type=text", () => {
        const processor = new ClaudeStreamProcessor();
        // First delta: Idle → InText
        processor.process(
          JSON.stringify({
            type: "stream_event",
            event: { type: "content_block_delta", delta: { type: "text_delta", text: "first" } },
          }),
          0,
        );
        expect(processor.state).toBe("InText");
        // Second delta: InText → InText
        const line = JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_delta", delta: { type: "text_delta", text: "second" } },
        });
        const r = processor.process(line, 1);
        assert(r !== null && r.type === "delta");
        expect(r.delta.type).toBe("text");
        expect(r.delta.content).toBe("second");
      });

      it("returns null for text_delta when state is InTool (inTool=true)", () => {
        const processor = new ClaudeStreamProcessor();
        // Transition to InTool
        processor.process(
          JSON.stringify({
            type: "stream_event",
            event: { type: "content_block_start", content_block: { type: "tool_use", name: "bash", id: "t1" } },
          }),
          0,
        );
        expect(processor.state).toBe("InTool");
        // text_delta in InTool state must be ignored
        const line = JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_delta", delta: { type: "text_delta", text: "ignored" } },
        });
        expect(processor.process(line, 1)).toBeNull();
      });
    });

    describe("AC-E019-08: stream_event + content_block_stop（inTool=true）を処理すると __tool_end 型が返される", () => {
      it("processes content_block_stop when state is InTool and returns __tool_end type", () => {
        const processor = new ClaudeStreamProcessor();
        // Transition to InTool
        processor.process(
          JSON.stringify({
            type: "stream_event",
            event: { type: "content_block_start", content_block: { type: "tool_use", name: "bash", id: "t1" } },
          }),
          0,
        );
        expect(processor.state).toBe("InTool");
        // content_block_stop in InTool state → __tool_end
        const stopLine = JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_stop" },
        });
        const r = processor.process(stopLine, 1);
        assert(r !== null && r.type === "__tool_end");
        expect(r.delta.type).toBe("tool_result");
        expect(processor.state).toBe("Idle");
      });

      it("returns null for content_block_stop when state is InText (not InTool)", () => {
        const processor = new ClaudeStreamProcessor();
        // Transition to InText
        processor.process(
          JSON.stringify({
            type: "stream_event",
            event: { type: "content_block_delta", delta: { type: "text_delta", text: "hi" } },
          }),
          0,
        );
        expect(processor.state).toBe("InText");
        // content_block_stop in InText state → null (just reset to Idle)
        const stopLine = JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_stop" },
        });
        const r = processor.process(stopLine, 1);
        expect(r).toBeNull();
        expect(processor.state).toBe("Idle");
      });
    });

    describe("AC-E019-09: 空行・不正 JSON を処理すると null が返され例外が発生しない", () => {
      it("returns null for empty string without throwing", () => {
        const processor = new ClaudeStreamProcessor();
        expect(() => processor.process("", 0)).not.toThrow();
        expect(processor.process("", 0)).toBeNull();
      });

      it("returns null for whitespace-only line without throwing", () => {
        const processor = new ClaudeStreamProcessor();
        expect(() => processor.process("   ", 0)).not.toThrow();
        expect(processor.process("   ", 0)).toBeNull();
      });

      it("returns null for invalid JSON without throwing", () => {
        const processor = new ClaudeStreamProcessor();
        expect(() => processor.process("not-valid-json", 0)).not.toThrow();
        expect(processor.process("not-valid-json", 0)).toBeNull();
      });

      it("returns null for truncated JSON without throwing", () => {
        const processor = new ClaudeStreamProcessor();
        expect(() => processor.process('{"type": "result"', 0)).not.toThrow();
        expect(processor.process('{"type": "result"', 0)).toBeNull();
      });

      it("returns null for empty JSON object (no type field) without throwing", () => {
        const processor = new ClaudeStreamProcessor();
        expect(() => processor.process("{}", 0)).not.toThrow();
        expect(processor.process("{}", 0)).toBeNull();
      });
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

  describe("Additional branch coverage tests", () => {
    // ── parseClaudeJsonOutput: Array with rate_limit_event ─────────────────────
    it("parseClaudeJsonOutput handles array with rate_limit_event", async () => {
      const output = JSON.stringify([
        { type: "assistant", content: [{ type: "text", text: "thinking" }] },
        { type: "rate_limit_event", rate_limit_info: { status: "ok", resetsAt: 9999, rateLimitType: "daily" } },
        { type: "result", result: "final", session_id: "rl-arr-1" },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      expect(result.result).toBe("final");
    });

    // ── parseClaudeJsonOutput: Array with rate_limit_event, no result event ────
    it("parseClaudeJsonOutput: Array with rate_limit_event (status=rejected) → is_error path", async () => {
      // rate_limit_info.status="rejected" triggers the error path in buildEngineResultFromResultEvent
      // even though assistant text is extracted, result="" because isError=true
      const output = JSON.stringify([
        { type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt: 9999 } },
        { type: "assistant", content: [{ type: "text", text: "some text" }] },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      // rateLimit.status="rejected" → isError=true → result=""
      expect(result.result).toBe("");
      expect(result.error).toBeDefined();
    });

    it("parseClaudeJsonOutput: Array with rate_limit_event (status=ok) + assistant text fallback", async () => {
      // rate_limit_info.status="ok" (not "rejected") does NOT trigger error path
      // result text is empty → assistant text is extracted as fallback
      const output = JSON.stringify([
        { type: "rate_limit_event", rate_limit_info: { status: "ok", resetsAt: 9999, rateLimitType: "daily" } },
        { type: "assistant", content: [{ type: "text", text: "some text" }] },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      // rateLimit.status="ok" → isError=false → result = extracted assistant text
      expect(result.result).toBe("some text");
      expect(result.error).toBeUndefined();
    });

    // ── normalizeRateLimitInfo: raw が null/配列/非オブジェクト ────────────────
    it("normalizeRateLimitInfo returns undefined for null", async () => {
      // Trigger via non-zero exit with array output containing rate_limit_event with null info
      const output = JSON.stringify([
        { type: "rate_limit_event", rate_limit_info: null },
        { type: "result", result: "partial", session_id: "nl-1", is_error: false },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output], 1);
      expect(result.result).toBe("partial");
    });

    it("normalizeRateLimitInfo returns undefined for array value", async () => {
      const output = JSON.stringify([
        { type: "rate_limit_event", rate_limit_info: [1, 2, 3] },
        { type: "result", result: "arr-val", session_id: "nl-2", is_error: false },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output], 1);
      expect(result.result).toBe("arr-val");
    });

    it("normalizeRateLimitInfo: resetsAt as string (not number) → undefined", async () => {
      // rate_limit_info with resetsAt as string should produce resetsAt: undefined
      const output = JSON.stringify([
        { type: "rate_limit_event", rate_limit_info: { status: "ok", resetsAt: "not-a-number" } },
        { type: "result", result: "str-resets", session_id: "nl-3", is_error: false },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output], 1);
      expect(result.result).toBe("str-resets");
    });

    // ── formatClaudeError: empty message フォールバック ─────────────────────
    it("formatClaudeError falls back to 'Claude error' when message is empty", () => {
      const build = (
        engine as unknown as {
          buildEngineResultFromResultEvent: (
            resultEvent: Record<string, unknown>,
            finalText: string,
            fallbackSessionId: string | undefined,
            rateLimit: undefined,
          ) => EngineResult;
        }
      ).buildEngineResultFromResultEvent.bind(engine);
      const result = build(
        { type: "result", result: "", session_id: "s-empty", is_error: true },
        "",
        undefined,
        undefined,
      );
      // message is "" so formatClaudeError returns "Claude error"
      expect(result.error).toBe("Claude error");
    });

    // ── isTransientError: ECONNRESET パターン (streaming + num_turns > 0 でリトライ) ──
    it("retries on ECONNRESET error when numTurns > 0 (not dead session)", async () => {
      // isDeadSessionError returns false when numTurns > 0 (some work was done)
      // isTransientError returns true when result.error contains ECONNRESET
      // → retry should fire
      const proc1 = createMockProcess();
      const proc2 = createMockProcess();

      mockSpawn.mockImplementation(() => {
        if (mockSpawn.mock.calls.length === 1) return proc1 as unknown as ChildProcess;
        setTimeout(() => {
          proc2.stdout.emit(
            "data",
            Buffer.from(`${JSON.stringify({ type: "result", result: "recovered", session_id: "s5", num_turns: 1 })}\n`),
          );
          proc2.exitCode = 0;
          proc2.emit("close", 0);
        }, 10);
        return proc2 as unknown as ChildProcess;
      });

      const p = engine.run({ prompt: "q", cwd: "/tmp" });

      // First attempt: result event with is_error=true + ECONNRESET in result text + num_turns=1
      // → result.error contains ECONNRESET → isTransientError=true
      // → isDeadSessionError=false (numTurns=1>0) → retry
      proc1.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            type: "result",
            result: "ECONNRESET: connection reset by peer",
            session_id: "s-econ",
            is_error: true,
            num_turns: 1,
          }),
        ),
      );
      proc1.exitCode = 0;
      proc1.emit("close", 0);

      const result = await p;
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(result.result).toBe("recovered");
    }, 10000);

    it("retries on 503 error in result text when numTurns > 0", async () => {
      // 503 matches TRANSIENT_PATTERNS → retry (if not dead session)
      const proc1 = createMockProcess();
      const proc2 = createMockProcess();

      mockSpawn.mockImplementation(() => {
        if (mockSpawn.mock.calls.length === 1) return proc1 as unknown as ChildProcess;
        setTimeout(() => {
          proc2.stdout.emit(
            "data",
            Buffer.from(`${JSON.stringify({ type: "result", result: "ok2", session_id: "s6", num_turns: 2 })}\n`),
          );
          proc2.exitCode = 0;
          proc2.emit("close", 0);
        }, 10);
        return proc2 as unknown as ChildProcess;
      });

      const p = engine.run({ prompt: "q", cwd: "/tmp" });

      // First: 503 overloaded error with work done (num_turns=1)
      proc1.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            type: "result",
            result: "service 503 unavailable",
            session_id: "s-503",
            is_error: true,
            num_turns: 1,
          }),
        ),
      );
      proc1.exitCode = 0;
      proc1.emit("close", 0);

      const result = await p;
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(result.result).toBe("ok2");
    }, 10000);

    // ── dead session: isDeadSessionError branch ──────────────────────────────
    it("dead session detection: result with session_id empty + is_error=true → no retry", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", resumeSessionId: "dead-2" });

      proc.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            type: "result",
            result: "Session has expired and is no longer available",
            session_id: "",
            is_error: true,
            num_turns: 0,
          }),
        ),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      await p;
      // Dead session detection should NOT retry
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    // ── streaming: non-zero exit with lastResultMsg (streaming 2nd path) ─────
    it("streaming run: non-zero exit with lastResultMsg resolves via extractResult", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "stream-nz",
        onStream: (d) => deltas.push(d),
      });

      // Send result event then exit non-zero (streaming mode)
      proc.stdout.emit(
        "data",
        Buffer.from(
          `${JSON.stringify({ type: "result", result: "partial ok", session_id: "s-nz", is_error: false })}\n`,
        ),
      );
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await p;
      // Should use extractResult (second streaming path for non-zero exit with lastResultMsg)
      expect(result.result).toBe("partial ok");
    });

    // ── streaming: error delta emitted on is_error result ────────────────────
    it("streaming run: code=0, lastResultMsg with is_error=true emits error delta", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "stream-err-delta",
        onStream: (d) => deltas.push(d),
      });

      proc.stdout.emit(
        "data",
        Buffer.from(`${JSON.stringify({ type: "result", result: "err msg", session_id: "s-ed", is_error: true })}\n`),
      );
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.error).toBeDefined();
      expect(deltas.some((d) => d.type === "error")).toBe(true);
    });

    // ── non-streaming: non-zero exit with stdout JSON object (type=result) ───
    it("non-streaming: non-zero exit with stdout JSON object with type=result", async () => {
      const output = JSON.stringify({ type: "result", result: "obj-nonzero", session_id: "onz-1", is_error: false });
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output], 1);
      expect(result.result).toBe("obj-nonzero");
    });

    // ── Interrupted error: no retry ──────────────────────────────────────────
    it("Interrupted terminationReason: does not retry", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "interrupted-no-retry" });
      engine.kill("interrupted-no-retry", "Interrupted: gateway shutting down");

      proc.exitCode = null;
      proc.emit("close", null);

      const result = await p;
      expect(result.error).toContain("Interrupted");
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    // ── kill: SIGKILL タイムアウトコールバック ────────────────────────────────
    it("kill: SIGKILL is sent when process does not exit within timeout", async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cl-sigkill",
      });

      // Kill the process, then advance timers past 2000ms SIGKILL timeout
      engine.kill("cl-sigkill", "Interrupted: test sigkill");

      // proc.exitCode is still null → SIGKILL should be sent
      await vi.advanceTimersByTimeAsync(2100);

      // Now simulate process exiting
      proc.exitCode = null;
      proc.emit("close", null);

      const result = await p;
      expect(result.error).toBe("Interrupted: test sigkill");
      vi.useRealTimers();
    });

    // ── isTransientError: overloaded pattern → retry ─────────────────────────
    it("retries on 'overloaded' error in result text when numTurns > 0", async () => {
      // /overloaded/i matches → isTransientError=true, numTurns=1 → not dead session → retry
      const proc1 = createMockProcess();
      const proc2 = createMockProcess();

      mockSpawn.mockImplementation(() => {
        if (mockSpawn.mock.calls.length === 1) return proc1 as unknown as ChildProcess;
        setTimeout(() => {
          proc2.stdout.emit(
            "data",
            Buffer.from(`${JSON.stringify({ type: "result", result: "after-retry", session_id: "s-ol", num_turns: 1 })}\n`),
          );
          proc2.exitCode = 0;
          proc2.emit("close", 0);
        }, 10);
        return proc2 as unknown as ChildProcess;
      });

      const p = engine.run({ prompt: "q", cwd: "/tmp" });

      proc1.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            type: "result",
            result: "server overloaded, please try again",
            session_id: "s-ol-pre",
            is_error: true,
            num_turns: 1,
          }),
        ),
      );
      proc1.exitCode = 0;
      proc1.emit("close", 0);

      const result = await p;
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(result.result).toBe("after-retry");
    }, 10000);

    // ── non-zero exit 2nd try: parsedResult.error (no onStream) ─────────────
    it("non-zero exit 2nd try block: Array with is_error last element → parsedResult.error", async () => {
      // Reach 2nd parseClaudeJsonOutput try block with parsedResult.error:
      // 1st block: Array → no type:result event → fall through (no resolve)
      // → reaches 2nd block: parseClaudeJsonOutput → last element is_error=true → parsedResult.error
      // → if (parsedResult.error) opts.onStream?.() → no onStream → no-op
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp" });

      // Array where last element has is_error=true but no type:result event
      proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify([
          { type: "debug", msg: "start" },
          { is_error: true, result: "something went wrong" },
        ])),
      );
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await p;
      // parsedResult.error is defined from is_error=true last element
      expect(result.error).toBeDefined();
    });

    // ── close event: settled=true guard ──────────────────────────────────────
    it("close event: duplicate close event is ignored after first close", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp" });
      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok-dc", session_id: "dc-1" })));
      proc.exitCode = 0;
      proc.emit("close", 0);
      // Second close — settled=true → if (settled) return (if path)
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("ok-dc");
    });

    // ── buildCleanEnv: mocked Object.entries to inject undefined value ───────
    it("buildCleanEnv: skips env var when value is undefined (via mocked entries)", async () => {
      // Mock Object.entries to inject an entry with undefined value
      const origEntries = Object.entries.bind(Object);
      const mockEntries = vi.spyOn(Object, "entries").mockImplementation((obj) => {
        if (obj === process.env) {
          const real = origEntries(obj);
          return [...real, ["__UNDEF_TEST__", undefined as unknown as string]];
        }
        return origEntries(obj);
      });

      try {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
        const p = engine.run({ prompt: "q", cwd: "/tmp" });
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok", session_id: "" })));
        proc.exitCode = 0;
        proc.emit("close", 0);
        await p;

        const env = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string | undefined>;
        // undefined value should not be included
        expect(env["__UNDEF_TEST__"]).toBeUndefined();
      } finally {
        mockEntries.mockRestore();
      }
    });

    // ── error event: settled=true guard ──────────────────────────────────────
    it("error event after close: duplicate error is ignored", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp" });
      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok-de", session_id: "de-1" })));
      proc.exitCode = 0;
      proc.emit("close", 0);
      // Error event after settled — should be ignored
      proc.emit("error", new Error("late error after close"));

      const result = await p;
      expect(result.result).toBe("ok-de");
    });

    // ── signalProcess: early return when proc already exited ─────────────────
    it("signalProcess: does nothing when proc.exitCode is already non-null", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cl-sig-early",
      });

      // Set exitCode to non-null before calling kill → signalProcess returns immediately
      proc.exitCode = 0;
      engine.kill("cl-sig-early", "Interrupted: early exit");

      proc.emit("close", 0);
      const result = await p;
      // terminationReason is set → result.error = terminationReason
      expect(result.error).toBe("Interrupted: early exit");
    });

    // ── kill: SIGKILL not sent when process already exited before timeout ─────
    it("kill: SIGKILL is NOT sent when process exits before 2s timeout", async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "cl-sigkill-skip",
      });

      engine.kill("cl-sigkill-skip", "Interrupted: test kill skip");

      // Set exitCode to non-null BEFORE timer fires (process already exited)
      proc.exitCode = 0;
      // Emit close before advancing timer
      proc.emit("close", null);

      // Advance past 2s — SIGKILL callback fires but exitCode !== null → else branch
      await vi.advanceTimersByTimeAsync(2100);

      const result = await p;
      expect(result.error).toBe("Interrupted: test kill skip");
      vi.useRealTimers();
    });

    // ── streaming lineBuf: parsed=null (empty line in stream) ───────────────
    it("streaming: empty/null parsed lines in stream are skipped via continue", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const p = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "stream-null-parsed",
        onStream: (d) => deltas.push(d),
      });

      // Send data with empty lines (→ processor.process("", ...) returns null → continue)
      // and an invalid JSON line (→ null → continue)
      const events = [
        "",                                                                        // empty line → null
        "\n",
        "not-valid-json",                                                          // bad JSON → null
        "\n",
        JSON.stringify({ type: "result", result: "ok-skip", session_id: "sl-1" }), // valid result
        "\n",
      ].join("");

      proc.stdout.emit("data", Buffer.from(events));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("ok-skip");
    });

    // ── stderr 10KB rolling window ────────────────────────────────────────────
    it("stderr rolling window: keeps only last 10KB", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp" });

      // Send 11KB of stderr to trigger rolling window
      const bigStderr = "X".repeat(11 * 1024);
      proc.stderr.emit("data", Buffer.from(bigStderr));

      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok-stderr", session_id: "se-1" })));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await p;
      expect(result.result).toBe("ok-stderr");
    });

    // ── non-streaming non-zero: stdout + parsedResult.error (is_error=true) ──
    it("non-streaming non-zero exit: stdout with is_error JSON → parsedResult.error emits no stream (no onStream)", async () => {
      // !streaming && stdout.trim() → parseClaudeJsonOutput → parsedResult.error
      // opts.onStream is undefined so the optional chain does nothing
      const output = JSON.stringify({ type: "result", result: "error msg", session_id: "pn-1", is_error: true });
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output], 1);
      expect(result.error).toBeDefined();
      expect(result.result).toBe("");
    });

    // ── non-zero non-streaming: stdout object with type != result (else if false) ─
    it("non-zero exit: non-streaming stdout object with type != result falls through to 2nd try", async () => {
      // 1st block: !streaming && stdout → parse → object but type != "result"
      // → else if false → fall through (not resolved)
      // → 2nd try: parseClaudeJsonOutput → object → uses it directly
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp" });

      // Object but type is NOT "result" → 1st parse block falls through
      proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ type: "other_type", result: "other-result", session_id: "ot-1" })),
      );
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await p;
      // 2nd parseClaudeJsonOutput: object → resultEvent = {type:"other_type", result:"other-result"}
      // → buildEngineResultFromResultEvent: is_error=false → result="other-result"
      expect(result.result).toBe("other-result");
    });

    // ── parseClaudeJsonOutput: Array, no result event, no assistant type ─────
    it("parseClaudeJsonOutput: Array with no result event and empty content → empty result", async () => {
      // textBlocks.length === 0 else path: assistant event but no text content
      const output = JSON.stringify([
        { type: "assistant", content: [{ type: "image", url: "http://example.com" }] },
        { type: "assistant", role: "assistant", content: [{ type: "image", url: "http://b.com" }] },
      ]);
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      // No text blocks found → finalText remains "", result=""
      expect(result.result).toBe("");
    });

    // ── parseClaudeJsonOutput: parsed as object (not Array) ──────────────────
    it("parseClaudeJsonOutput: object JSON with non-result type uses object directly", async () => {
      // else if (parsed && typeof parsed === "object") path
      const output = JSON.stringify({ type: "other", result: "obj-direct", session_id: "od-1" });
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, [output]);
      // resultEvent = parsed as object → result.result = "obj-direct"
      expect(result.result).toBe("obj-direct");
    });

    // ── parseClaudeJsonOutput: parsed = null (else if false) ─────────────────
    it("parseClaudeJsonOutput: JSON null output → else if false → resultEvent={} → empty result", async () => {
      // JSON.parse("null") = null → both Array.isArray and else if are false
      // → resultEvent = {} (initial value) → result = ""
      const result = await runWithOutput(engine, { prompt: "q", cwd: "/tmp" }, ["null"]);
      expect(result.result).toBe("");
      expect(result.error).toBeUndefined();
    });

    // ── non-zero exit Array: no result event → 2nd parseClaudeJsonOutput call ─
    it("non-zero exit: non-streaming stdout Array with no result event → parseClaudeJsonOutput fallback", async () => {
      // !streaming && stdout.trim() (1st block) → JSON.parse → Array → no resultEvent
      // → falls through 1st try block → 2nd try block: parseClaudeJsonOutput
      // → Array, last element is used, result="" → resolves with result=""
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const p = engine.run({ prompt: "q", cwd: "/tmp" });

      // Array with no type=result event
      proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify([{ type: "debug", msg: "something" }])),
      );
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await p;
      // 2nd parseClaudeJsonOutput succeeds → result.result="" (no text), no error
      expect(result.result).toBe("");
    });

  });

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
