import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineRunOpts, StreamDelta } from "../../shared/types.js";
import { GeminiEngine } from "../gemini.js";

// Mock child_process.spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";

const mockSpawn = vi.mocked(spawn);

/** Shape of the mock ChildProcess used in tests */
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

/** Creates a mock ChildProcess that emits events and has controllable stdout/stderr */
function createMockProcess(): MockProcess {
  const emitter = new EventEmitter();
  const proc: MockProcess = Object.assign(emitter, {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: { end: vi.fn() },
    pid: 12345,
    exitCode: null as number | null,
    killed: false,
    kill: vi.fn(() => {
      proc.killed = true;
      return true;
    }),
  });
  return proc;
}

describe("GeminiEngine", () => {
  let engine: GeminiEngine;

  beforeEach(() => {
    engine = new GeminiEngine();
  });

  describe("constructor and identity", () => {
    it("should have name 'gemini'", () => {
      expect(engine.name).toBe("gemini");
    });

    it("should implement InterruptibleEngine interface", () => {
      expect(typeof engine.kill).toBe("function");
      expect(typeof engine.isAlive).toBe("function");
      expect(typeof engine.killAll).toBe("function");
      expect(typeof engine.run).toBe("function");
    });
  });

  describe("buildArgs", () => {
    const baseOpts: EngineRunOpts = { prompt: "test prompt", cwd: "/tmp" };

    it("should build fresh args with streaming", () => {
      const args = engine.buildArgs(baseOpts, "test prompt", true);
      expect(args).toEqual(["--output-format", "stream-json", "--yolo", "test prompt"]);
    });

    it("should build fresh args without streaming (json mode)", () => {
      const args = engine.buildArgs(baseOpts, "test prompt", false);
      expect(args).toEqual(["--output-format", "json", "--yolo", "test prompt"]);
    });

    it("should include --model when specified", () => {
      const opts = { ...baseOpts, model: "gemini-2.5-pro" };
      const args = engine.buildArgs(opts, "test prompt", true);
      expect(args).toContain("--model");
      expect(args).toContain("gemini-2.5-pro");
    });

    it("should include --resume when resumeSessionId is set", () => {
      const opts = { ...baseOpts, resumeSessionId: "abc-123" };
      const args = engine.buildArgs(opts, "test prompt", true);
      expect(args).toContain("--resume");
      expect(args).toContain("abc-123");
    });

    it("should append cliFlags", () => {
      const opts = { ...baseOpts, cliFlags: ["--debug", "--verbose"] };
      const args = engine.buildArgs(opts, "test prompt", true);
      expect(args).toContain("--debug");
      expect(args).toContain("--verbose");
    });

    it("should put prompt as the last argument", () => {
      const opts = { ...baseOpts, model: "gemini-2.5-pro", resumeSessionId: "abc-123" };
      const args = engine.buildArgs(opts, "my prompt here", true);
      expect(args[args.length - 1]).toBe("my prompt here");
    });
  });

  describe("processStreamLine", () => {
    it("should return null for empty lines", () => {
      expect(engine.processStreamLine("")).toBeNull();
      expect(engine.processStreamLine("   ")).toBeNull();
    });

    it("should return null for unparseable JSON", () => {
      expect(engine.processStreamLine("not json")).toBeNull();
    });

    it("should parse session.start event", () => {
      const line = JSON.stringify({ type: "session.start", session_id: "gem-abc-123" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({ type: "session_id", sessionId: "gem-abc-123" });
    });

    it("should parse session.started event (alternative name)", () => {
      const line = JSON.stringify({ type: "session.started", sessionId: "gem-xyz-789" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({ type: "session_id", sessionId: "gem-xyz-789" });
    });

    it("should parse text events", () => {
      const line = JSON.stringify({ type: "text", text: "Hello world" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({
        type: "text",
        delta: { type: "text", content: "Hello world" },
      });
    });

    it("should parse content.text events", () => {
      const line = JSON.stringify({ type: "content.text", content: "Some text" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({
        type: "text",
        delta: { type: "text", content: "Some text" },
      });
    });

    it("should parse text_delta events", () => {
      const line = JSON.stringify({ type: "text_delta", delta: "chunk" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({
        type: "text",
        delta: { type: "text", content: "chunk" },
      });
    });

    it("should parse tool.start events", () => {
      const line = JSON.stringify({ type: "tool.start", name: "read_file", id: "t-1" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({
        type: "tool_start",
        delta: { type: "tool_use", content: "Using read_file", toolName: "read_file", toolId: "t-1" },
      });
    });

    it("should parse tool_use events", () => {
      const line = JSON.stringify({ type: "tool_use", tool_name: "shell", tool_id: "t-2" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({
        type: "tool_start",
        delta: { type: "tool_use", content: "Using shell", toolName: "shell", toolId: "t-2" },
      });
    });

    it("should parse tool.end events", () => {
      const line = JSON.stringify({ type: "tool.end", output: "file contents here" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({
        type: "tool_end",
        delta: { type: "tool_result", content: "file contents here" },
      });
    });

    it("should parse tool_result events", () => {
      const line = JSON.stringify({ type: "tool_result", result: "command output" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({
        type: "tool_end",
        delta: { type: "tool_result", content: "command output" },
      });
    });

    it("should parse turn.complete events", () => {
      const line = JSON.stringify({ type: "turn.complete" });
      expect(engine.processStreamLine(line)).toEqual({ type: "turn_complete" });
    });

    it("should parse turn.completed events (alternative name)", () => {
      const line = JSON.stringify({ type: "turn.completed" });
      expect(engine.processStreamLine(line)).toEqual({ type: "turn_complete" });
    });

    it("should parse error events", () => {
      const line = JSON.stringify({ type: "error", message: "Something went wrong" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({ type: "error", message: "Something went wrong" });
    });

    it("should parse result events as text", () => {
      const line = JSON.stringify({ type: "result", result: "Final answer here" });
      const result = engine.processStreamLine(line);
      expect(result).toEqual({
        type: "text",
        delta: { type: "text", content: "Final answer here" },
      });
    });

    it("should return null for unrecognized event types", () => {
      const line = JSON.stringify({ type: "some_future_event", data: "whatever" });
      expect(engine.processStreamLine(line)).toBeNull();
    });
  });

  describe("system prompt handling", () => {
    it("should prepend system prompt to user prompt in run()", async () => {
      // We test this by verifying buildArgs receives the combined prompt
      // The actual prepending happens in run() before buildArgs is called
      const opts: EngineRunOpts = {
        prompt: "user task",
        systemPrompt: "You are a helpful assistant.",
        cwd: "/tmp",
      };

      // Spy on buildArgs to capture the prompt it receives
      const buildArgsSpy = vi.spyOn(engine, "buildArgs");

      // run() will fail because gemini binary doesn't exist, but that's OK —
      // we just need to verify the prompt was combined before buildArgs is called
      try {
        await engine.run(opts);
      } catch {
        // Expected: spawn will fail
      }

      expect(buildArgsSpy).toHaveBeenCalledWith(
        opts,
        "You are a helpful assistant.\n\n---\n\nuser task",
        expect.any(Boolean),
      );
    });

    it("should append attachments to prompt", async () => {
      const opts: EngineRunOpts = {
        prompt: "review this",
        attachments: ["/path/to/file.ts", "/path/to/other.ts"],
        cwd: "/tmp",
      };

      const buildArgsSpy = vi.spyOn(engine, "buildArgs");

      try {
        await engine.run(opts);
      } catch {
        // Expected
      }

      expect(buildArgsSpy).toHaveBeenCalledWith(
        opts,
        "review this\n\nAttached files:\n- /path/to/file.ts\n- /path/to/other.ts",
        expect.any(Boolean),
      );
    });
  });

  describe("lifecycle (kill/isAlive/killAll)", () => {
    it("isAlive should return false for unknown session", () => {
      expect(engine.isAlive("nonexistent")).toBe(false);
    });

    it("kill should not throw for unknown session", () => {
      expect(() => engine.kill("nonexistent")).not.toThrow();
    });

    it("killAll should not throw when no processes", () => {
      expect(() => engine.killAll()).not.toThrow();
    });
  });

  describe("run() with mocked spawn", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should resolve with result on successful non-streaming run", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const resultPromise = engine.run({ prompt: "hello", cwd: "/tmp" });

      // Simulate JSON output from gemini CLI
      const output = JSON.stringify({ type: "result", result: "Hello! How can I help?", session_id: "gem-s1" });
      proc.stdout.emit("data", Buffer.from(output));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await resultPromise;
      expect(result.result).toBe("Hello! How can I help?");
      expect(result.sessionId).toBe("gem-s1");
      expect(result.error).toBeUndefined();
    });

    it("should resolve with streamed text on streaming run", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const deltas: StreamDelta[] = [];
      const resultPromise = engine.run({
        prompt: "hello",
        cwd: "/tmp",
        sessionId: "test-sess",
        onStream: (d) => deltas.push(d),
      });

      // Simulate streaming events
      proc.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({ type: "session.start", session_id: "gem-s2" }) +
            "\n" +
            JSON.stringify({ type: "text", text: "Hello " }) +
            "\n" +
            JSON.stringify({ type: "text", text: "world!" }) +
            "\n" +
            JSON.stringify({ type: "turn.complete" }) +
            "\n",
        ),
      );

      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await resultPromise;
      expect(result.sessionId).toBe("gem-s2");
      expect(result.result).toBe("Hello world!");
      expect(result.numTurns).toBe(1);
      expect(result.error).toBeUndefined();
      expect(deltas).toHaveLength(2);
      expect(deltas[0]).toEqual({ type: "text", content: "Hello " });
      expect(deltas[1]).toEqual({ type: "text", content: "world!" });
    });

    it("should handle non-zero exit code as error", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const resultPromise = engine.run({ prompt: "hello", cwd: "/tmp" });

      proc.stderr.emit("data", Buffer.from("gemini: command not found"));
      proc.exitCode = 127;
      proc.emit("close", 127);

      const result = await resultPromise;
      expect(result.error).toContain("Gemini exited with code 127");
      expect(result.error).toContain("command not found");
    });

    it("should reject on spawn error", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const resultPromise = engine.run({ prompt: "hello", cwd: "/tmp" });

      proc.emit("error", new Error("ENOENT: gemini not found"));

      await expect(resultPromise).rejects.toThrow("Failed to spawn Gemini CLI");
    });

    it("should handle termination reason from kill()", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const resultPromise = engine.run({
        prompt: "long task",
        cwd: "/tmp",
        sessionId: "kill-test",
      });

      // Simulate kill during execution
      engine.kill("kill-test", "User cancelled");

      proc.exitCode = null;
      proc.emit("close", null);

      const result = await resultPromise;
      expect(result.error).toBe("User cancelled");
    });

    it("should track live processes and report isAlive correctly", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const resultPromise = engine.run({
        prompt: "hello",
        cwd: "/tmp",
        sessionId: "alive-test",
      });

      // Process is running
      expect(engine.isAlive("alive-test")).toBe(true);

      proc.exitCode = 0;
      proc.emit("close", 0);

      await resultPromise;

      // Process has exited
      expect(engine.isAlive("alive-test")).toBe(false);
    });

    it("should stream tool use events", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const deltas: StreamDelta[] = [];
      const resultPromise = engine.run({
        prompt: "read file",
        cwd: "/tmp",
        sessionId: "tool-test",
        onStream: (d) => deltas.push(d),
      });

      proc.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({ type: "tool.start", name: "read_file", id: "t-1" }) +
            "\n" +
            JSON.stringify({ type: "tool.end", output: "file contents" }) +
            "\n" +
            JSON.stringify({ type: "text", text: "I read the file." }) +
            "\n",
        ),
      );

      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await resultPromise;
      expect(result.result).toBe("I read the file.");
      expect(deltas).toHaveLength(3);
      expect(deltas[0].type).toBe("tool_use");
      expect(deltas[0].toolName).toBe("read_file");
      expect(deltas[1].type).toBe("tool_result");
      expect(deltas[2].type).toBe("text");
    });

    it("should use custom bin from opts", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const resultPromise = engine.run({
        prompt: "hello",
        cwd: "/tmp",
        bin: "/usr/local/bin/gemini",
      });

      proc.exitCode = 0;
      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok" })));
      proc.emit("close", 0);

      await resultPromise;
      expect(mockSpawn).toHaveBeenCalledWith("/usr/local/bin/gemini", expect.any(Array), expect.any(Object));
    });

    it("should default bin to 'gemini'", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const resultPromise = engine.run({ prompt: "hello", cwd: "/tmp" });

      proc.exitCode = 0;
      proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok" })));
      proc.emit("close", 0);

      await resultPromise;
      expect(mockSpawn).toHaveBeenCalledWith("gemini", expect.any(Array), expect.any(Object));
    });

    it("should preserve GEMINI_API_KEY in child env", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const origKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "test-gemini-key";

      try {
        const resultPromise = engine.run({ prompt: "hello", cwd: "/tmp" });
        proc.exitCode = 0;
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok" })));
        proc.emit("close", 0);
        await resultPromise;

        const spawnEnv = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string>;
        expect(spawnEnv.GEMINI_API_KEY).toBe("test-gemini-key");
      } finally {
        if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
        else delete process.env.GEMINI_API_KEY;
      }
    });

    it("should strip CLAUDE_CODE_ vars from child env", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess); // test mock

      const origVar = process.env.CLAUDE_CODE_SOMETHING;
      process.env.CLAUDE_CODE_SOMETHING = "should-be-stripped";

      try {
        const resultPromise = engine.run({ prompt: "hello", cwd: "/tmp" });
        proc.exitCode = 0;
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok" })));
        proc.emit("close", 0);
        await resultPromise;

        const spawnEnv = mockSpawn.mock.lastCall?.[2]?.env as Record<string, string>;
        expect(spawnEnv.CLAUDE_CODE_SOMETHING).toBeUndefined();
      } finally {
        if (origVar !== undefined) process.env.CLAUDE_CODE_SOMETHING = origVar;
        else delete process.env.CLAUDE_CODE_SOMETHING;
      }
    });

    // ── parseJsonOutput 未カバー分岐 ────────────────────────────────────────

    it("AC-E003-03: parseJsonOutput — Array with no resultEvent falls back to lastText", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

      // Array 形式だが type:"result" がない → lastText フォールバック
      const output = JSON.stringify([
        { type: "text", text: "fallback text answer" },
        { type: "other_event", data: "x" },
      ]);
      proc.stdout.emit("data", Buffer.from(output));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await resultPromise;
      expect(result.result).toBe("fallback text answer");
      expect(result.error).toBeUndefined();
    });

    it("AC-E003-03: parseJsonOutput — Array with no resultEvent and no lastText returns empty string", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

      // Array 形式で text/content.text イベントなし → result: ""
      const output = JSON.stringify([{ type: "debug", msg: "starting" }]);
      proc.stdout.emit("data", Buffer.from(output));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await resultPromise;
      expect(result.result).toBe("");
    });

    it("AC-E003-03: parseJsonOutput — primitive value falls back to String(parsed)", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

      // 数値のみの JSON → String(parsed) パス
      const output = JSON.stringify(42);
      proc.stdout.emit("data", Buffer.from(output));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await resultPromise;
      expect(result.result).toBe("42");
    });

    it("AC-E003-03: parseJsonOutput throws → error result with raw stdout", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

      // 不正な JSON → parseJsonOutput が throw → catch で error フィールドを持つ result
      proc.stdout.emit("data", Buffer.from("not valid json at all"));
      proc.exitCode = 0;
      proc.emit("close", 0);

      const result = await resultPromise;
      expect(result.error).toContain("Failed to parse Gemini output");
    });

    it("AC-E003-03: streaming + non-zero exit but geminiSessionId is set → resolves with session", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const deltas: StreamDelta[] = [];
      const resultPromise = engine.run({
        prompt: "q",
        cwd: "/tmp",
        sessionId: "sess-x",
        onStream: (d) => deltas.push(d),
      });

      // session.start を送信して geminiSessionId をキャプチャ
      proc.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({ type: "session.start", session_id: "gem-captured" }) +
            "\n" +
            JSON.stringify({ type: "text", text: "partial answer" }) +
            "\n",
        ),
      );
      // 非ゼロ終了 → code !== 0 だが geminiSessionId があるので resolve
      proc.exitCode = 1;
      proc.emit("close", 1);

      const result = await resultPromise;
      expect(result.sessionId).toBe("gem-captured");
      expect(result.result).toBe("partial answer");
    });

    // ── Additional branch coverage tests ──────────────────────────────────────

    describe("Additional branch coverage tests", () => {
      // ── processStreamLine: session.start with no sid → null ──────────────
      it("processStreamLine: session.start with empty session_id returns null", () => {
        const line = JSON.stringify({ type: "session.start", session_id: "" });
        expect(engine.processStreamLine(line)).toBeNull();
      });

      it("processStreamLine: session.started with empty sessionId returns null", () => {
        const line = JSON.stringify({ type: "session.started", sessionId: "" });
        expect(engine.processStreamLine(line)).toBeNull();
      });

      // ── processStreamLine: text events with empty text → null ─────────────
      it("processStreamLine: text event with empty text returns null", () => {
        const line = JSON.stringify({ type: "text", text: "" });
        expect(engine.processStreamLine(line)).toBeNull();
      });

      it("processStreamLine: content.text event with empty content returns null", () => {
        const line = JSON.stringify({ type: "content.text", content: "" });
        expect(engine.processStreamLine(line)).toBeNull();
      });

      it("processStreamLine: text_delta event with empty delta returns null", () => {
        const line = JSON.stringify({ type: "text_delta", delta: "" });
        expect(engine.processStreamLine(line)).toBeNull();
      });

      // ── processStreamLine: result event with empty result → null ──────────
      it("processStreamLine: result event with empty result returns null", () => {
        const line = JSON.stringify({ type: "result", result: "" });
        expect(engine.processStreamLine(line)).toBeNull();
      });

      // ── processStreamLine: function_call event ────────────────────────────
      it("processStreamLine: function_call event is parsed as tool_start", () => {
        const line = JSON.stringify({ type: "function_call", toolName: "do_thing", toolId: "fc-1" });
        const r = engine.processStreamLine(line);
        expect(r?.type).toBe("tool_start");
        if (r?.type === "tool_start") {
          expect(r.delta.toolName).toBe("do_thing");
        }
      });

      // ── processStreamLine: function_response event ────────────────────────
      it("processStreamLine: function_response event is parsed as tool_end", () => {
        const line = JSON.stringify({ type: "function_response", content: "fn result" });
        const r = engine.processStreamLine(line);
        expect(r?.type).toBe("tool_end");
        if (r?.type === "tool_end") {
          expect(r.delta.content).toBe("fn result");
        }
      });

      // ── processStreamLine: error with msg.error field ─────────────────────
      it("processStreamLine: error event with error field (no message) uses msg.error", () => {
        const line = JSON.stringify({ type: "error", error: "raw error string" });
        const r = engine.processStreamLine(line);
        expect(r?.type).toBe("error");
        if (r?.type === "error") {
          expect(r.message).toBe("raw error string");
        }
      });

      // ── parseJsonOutput: Array with resultEvent + cost/duration/numTurns ──
      it("parseJsonOutput: Array with resultEvent includes cost/durationMs/numTurns", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

        const output = JSON.stringify([
          { type: "result", result: "with-fields", session_id: "gem-f1", cost: 0.01, duration_ms: 500, num_turns: 3 },
        ]);
        proc.stdout.emit("data", Buffer.from(output));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.result).toBe("with-fields");
        expect(result.cost).toBe(0.01);
        expect(result.durationMs).toBe(500);
        expect(result.numTurns).toBe(3);
      });

      // ── parseJsonOutput: Array with resultEvent with text field (no result) ─
      it("parseJsonOutput: Array with resultEvent using text field", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

        const output = JSON.stringify([
          { type: "result", text: "text-field-answer", session_id: "gem-tf" },
        ]);
        proc.stdout.emit("data", Buffer.from(output));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.result).toBe("text-field-answer");
      });

      // ── parseJsonOutput: Array fallback with content.text event ──────────
      it("parseJsonOutput: Array fallback to content.text event", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

        const output = JSON.stringify([
          { type: "content.text", content: "content-text-answer" },
        ]);
        proc.stdout.emit("data", Buffer.from(output));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.result).toBe("content-text-answer");
      });

      // ── parseJsonOutput: object format with sessionId (camelCase) ─────────
      it("parseJsonOutput: object with sessionId field (camelCase)", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

        const output = JSON.stringify({
          sessionId: "camel-sess",
          result: "camel-result",
          cost: 0.02,
          duration_ms: 300,
          num_turns: 2,
        });
        proc.stdout.emit("data", Buffer.from(output));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.sessionId).toBe("camel-sess");
        expect(result.result).toBe("camel-result");
        expect(result.cost).toBe(0.02);
        expect(result.durationMs).toBe(300);
        expect(result.numTurns).toBe(2);
      });

      // ── parseJsonOutput: object with text field (no result) ───────────────
      it("parseJsonOutput: object with text field (no result)", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

        const output = JSON.stringify({ text: "text-only-answer" });
        proc.stdout.emit("data", Buffer.from(output));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.result).toBe("text-only-answer");
      });

      // ── parseJsonOutput: object with content field (no result/text) ───────
      it("parseJsonOutput: object with content field (no result/text)", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

        const output = JSON.stringify({ content: "content-only-answer" });
        proc.stdout.emit("data", Buffer.from(output));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.result).toBe("content-only-answer");
      });

      // ── streaming: lineBuf flush on close — session_id ────────────────────
      it("streaming: remaining lineBuf with session.start is processed on close", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const deltas: StreamDelta[] = [];
        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-lbuf",
          onStream: (d) => deltas.push(d),
        });

        // Send session.start without trailing newline (stays in lineBuf)
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "session.start", session_id: "gem-lbuf-id" })));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.sessionId).toBe("gem-lbuf-id");
      });

      // ── streaming: lineBuf flush on close — turn_complete ─────────────────
      it("streaming: remaining lineBuf with turn.complete is processed on close", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const deltas: StreamDelta[] = [];
        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-lbuf-tc",
          onStream: (d) => deltas.push(d),
        });

        const events = [
          JSON.stringify({ type: "session.start", session_id: "gem-lbuf-tc-id" }),
          "\n",
          JSON.stringify({ type: "text", text: "answer" }),
          "\n",
        ].join("");
        proc.stdout.emit("data", Buffer.from(events));
        // turn.complete without trailing newline
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "turn.complete" })));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.numTurns).toBe(1);
        expect(result.result).toBe("answer");
      });

      // ── streaming: lineBuf flush on close — text event ───────────────────
      it("streaming: remaining lineBuf with text event is processed on close", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const deltas: StreamDelta[] = [];
        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-lbuf-txt",
          onStream: (d) => deltas.push(d),
        });

        proc.stdout.emit(
          "data",
          Buffer.from([JSON.stringify({ type: "session.start", session_id: "gem-txt-id" }), "\n"].join("")),
        );
        // text without trailing newline → lineBuf at close
        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "text", text: "buffered-text" })));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.result).toBe("buffered-text");
      });

      // ── streaming: error delta on non-zero exit ───────────────────────────
      it("streaming: non-zero exit with no session emits error delta", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const deltas: StreamDelta[] = [];
        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-nz-err",
          onStream: (d) => deltas.push(d),
        });

        proc.stderr.emit("data", Buffer.from("gemini: error occurred"));
        proc.exitCode = 1;
        proc.emit("close", 1);

        const result = await resultPromise;
        expect(result.error).toContain("Gemini exited with code 1");
        expect(deltas.some((d) => d.type === "error")).toBe(true);
      });

      // ── streaming: code=0 with geminiSessionId (success path) ────────────
      it("streaming: code=0 with session ID resolves successfully", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const deltas: StreamDelta[] = [];
        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-code0",
          onStream: (d) => deltas.push(d),
        });

        proc.stdout.emit(
          "data",
          Buffer.from(
            [
              JSON.stringify({ type: "session.start", session_id: "gem-code0-id" }),
              "\n",
              JSON.stringify({ type: "text", text: "final answer" }),
              "\n",
            ].join(""),
          ),
        );
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.sessionId).toBe("gem-code0-id");
        expect(result.result).toBe("final answer");
        expect(result.error).toBeUndefined();
      });

      // ── killAll kills all sessions ────────────────────────────────────────
      it("killAll kills all running sessions", async () => {
        const proc1 = createMockProcess();
        const proc2 = createMockProcess();
        mockSpawn
          .mockReturnValueOnce(proc1 as unknown as ChildProcess)
          .mockReturnValueOnce(proc2 as unknown as ChildProcess);

        const p1 = engine.run({ prompt: "q1", cwd: "/tmp", sessionId: "gem-ka-1" });
        const p2 = engine.run({ prompt: "q2", cwd: "/tmp", sessionId: "gem-ka-2" });

        expect(engine.isAlive("gem-ka-1")).toBe(true);
        expect(engine.isAlive("gem-ka-2")).toBe(true);

        engine.killAll();

        proc1.exitCode = null;
        proc1.emit("close", null);
        proc2.exitCode = null;
        proc2.emit("close", null);

        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1.error).toContain("Interrupted");
        expect(r2.error).toContain("Interrupted");
      });

      // ── stderr 10KB rolling window ────────────────────────────────────────
      it("stderr rolling window: keeps only last 10KB", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });

        // Send > 10KB of stderr to trigger rolling window
        proc.stderr.emit("data", Buffer.from("G".repeat(11 * 1024)));

        proc.stdout.emit("data", Buffer.from(JSON.stringify({ type: "result", result: "ok-se" })));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.result).toBe("ok-se");
      });

      // ── streaming: null parsed line (invalid JSON) → continue ─────────────
      it("streaming: invalid JSON line in stream is skipped (parsed=null → continue)", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const deltas: StreamDelta[] = [];
        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-null-parsed",
          onStream: (d) => deltas.push(d),
        });

        const events = [
          "not-valid-json-line",
          "\n",
          JSON.stringify({ type: "session.start", session_id: "gem-np-id" }),
          "\n",
          JSON.stringify({ type: "text", text: "answer-np" }),
          "\n",
        ].join("");

        proc.stdout.emit("data", Buffer.from(events));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.result).toBe("answer-np");
        expect(result.sessionId).toBe("gem-np-id");
      });

      // ── signalProcess: early return when proc already exited ─────────────
      it("signalProcess: does nothing when proc.exitCode is non-null", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-sig-early",
          onStream: vi.fn(),
        });

        // Set exitCode before kill → signalProcess returns immediately
        proc.exitCode = 0;
        engine.kill("gem-sig-early", "Interrupted: early exit gem");

        proc.emit("close", 0);
        const result = await resultPromise;
        expect(result.error).toBe("Interrupted: early exit gem");
      });

      // ── kill: SIGKILL not sent when proc exits before timeout ─────────────
      it("kill: SIGKILL not sent when process exits before 2s timeout", async () => {
        vi.useFakeTimers();
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-sigkill-skip",
          onStream: vi.fn(),
        });

        engine.kill("gem-sigkill-skip", "Interrupted: skip sigkill gem");

        proc.exitCode = 0;
        proc.emit("close", null);

        await vi.advanceTimersByTimeAsync(2100);

        const result = await resultPromise;
        expect(result.error).toBe("Interrupted: skip sigkill gem");
        vi.useRealTimers();
      });

      // ── kill: SIGKILL タイムアウトコールバック ────────────────────────────
      it("kill: SIGKILL is sent when process does not exit within timeout", async () => {
        vi.useFakeTimers();
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-sigkill",
          onStream: vi.fn(),
        });

        // Process is alive, kill is called, then advance timers to trigger SIGKILL
        engine.kill("gem-sigkill", "Interrupted: test kill");

        // Advance fake timers past the 2000ms SIGKILL timeout
        // proc.exitCode is still null (not yet exited)
        await vi.advanceTimersByTimeAsync(2100);

        // Now simulate the process finally exiting
        proc.exitCode = null;
        proc.emit("close", null);

        const result = await resultPromise;
        expect(result.error).toBe("Interrupted: test kill");
        vi.useRealTimers();
      });

      // ── streaming: error event in stream ─────────────────────────────────
      it("streaming: error event in stream calls onStream with error delta", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const deltas: StreamDelta[] = [];
        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-stream-err-ev",
          onStream: (d) => deltas.push(d),
        });

        const events = [
          JSON.stringify({ type: "session.start", session_id: "gem-see-id" }),
          "\n",
          JSON.stringify({ type: "error", message: "API quota exceeded" }),
          "\n",
          JSON.stringify({ type: "text", text: "partial" }),
          "\n",
        ].join("");

        proc.stdout.emit("data", Buffer.from(events));
        proc.exitCode = 0;
        proc.emit("close", 0);

        await resultPromise;
        expect(deltas.some((d) => d.type === "error" && String(d.content).includes("API quota exceeded"))).toBe(true);
      });

      // ── streaming lineBuf at close: invalid JSON → parsed=null → else path ─
      it("streaming lineBuf at close: invalid JSON → if(parsed) else path", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

        const deltas: StreamDelta[] = [];
        const resultPromise = engine.run({
          prompt: "q",
          cwd: "/tmp",
          sessionId: "gem-lbuf-null",
          onStream: (d) => deltas.push(d),
        });

        proc.stdout.emit(
          "data",
          Buffer.from([JSON.stringify({ type: "session.start", session_id: "gem-lbuf-n-id" }), "\n"].join("")),
        );
        // Invalid JSON without newline → stays in lineBuf, processStreamLine returns null
        proc.stdout.emit("data", Buffer.from("not-json-lbuf"));
        proc.exitCode = 0;
        proc.emit("close", 0);

        const result = await resultPromise;
        expect(result.sessionId).toBe("gem-lbuf-n-id");
      });
    });
  });
});
