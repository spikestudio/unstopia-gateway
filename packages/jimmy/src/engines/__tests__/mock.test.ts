import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineRunOpts, StreamDelta } from "../../shared/types.js";
import { MockEngine } from "../mock.js";

describe("AC-E003-04: MockEngine", () => {
  let engine: MockEngine;

  beforeEach(() => {
    engine = new MockEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor and configuration", () => {
    it("sets name to 'mock'", () => {
      expect(engine.name).toBe("mock");
    });

    it("creates engine without options", () => {
      const e = new MockEngine();
      expect(e.name).toBe("mock");
    });

    it("creates engine with fixedResponse option", () => {
      const e = new MockEngine({ fixedResponse: "fixed reply" });
      expect(e.name).toBe("mock");
    });
  });

  describe("run() — basic output", () => {
    it("returns a result containing a canned response string", async () => {
      const opts: EngineRunOpts = { prompt: "hello", cwd: "/tmp" };
      const promise = engine.run(opts);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(typeof result.result).toBe("string");
      expect(result.result.length).toBeGreaterThan(0);
    });

    it("cycles through canned responses on repeated calls", async () => {
      const opts: EngineRunOpts = { prompt: "hi", cwd: "/tmp" };

      const p1 = engine.run(opts);
      await vi.runAllTimersAsync();
      const r1 = await p1;

      const p2 = engine.run(opts);
      await vi.runAllTimersAsync();
      const r2 = await p2;

      const p3 = engine.run(opts);
      await vi.runAllTimersAsync();
      const r3 = await p3;

      const p4 = engine.run(opts);
      await vi.runAllTimersAsync();
      const r4 = await p4;

      // After 3 canned responses the cycle restarts — result 4 equals result 1
      expect(r4.result).toBe(r1.result);
      // First 3 responses should not all be equal (they cycle through different strings)
      expect(new Set([r1.result, r2.result, r3.result]).size).toBeGreaterThan(1);
    });

    it("returns fixedResponse when configured", async () => {
      const fixed = new MockEngine({ fixedResponse: "always this" });
      const opts: EngineRunOpts = { prompt: "q", cwd: "/tmp" };

      const p1 = fixed.run(opts);
      await vi.runAllTimersAsync();
      const r1 = await p1;

      const p2 = fixed.run(opts);
      await vi.runAllTimersAsync();
      const r2 = await p2;

      expect(r1.result).toBe("always this");
      expect(r2.result).toBe("always this");
    });

    it("returns cost of 0.001", async () => {
      const opts: EngineRunOpts = { prompt: "x", cwd: "/tmp" };
      const p = engine.run(opts);
      await vi.runAllTimersAsync();
      const result = await p;
      expect(result.cost).toBe(0.001);
    });

    it("returns numTurns of 1", async () => {
      const opts: EngineRunOpts = { prompt: "x", cwd: "/tmp" };
      const p = engine.run(opts);
      await vi.runAllTimersAsync();
      const result = await p;
      expect(result.numTurns).toBe(1);
    });

    it("returns a durationMs >= 0", async () => {
      const opts: EngineRunOpts = { prompt: "x", cwd: "/tmp" };
      const p = engine.run(opts);
      await vi.runAllTimersAsync();
      const result = await p;
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("run() — sessionId handling", () => {
    it("uses resumeSessionId when provided", async () => {
      const opts: EngineRunOpts = { prompt: "q", cwd: "/tmp", resumeSessionId: "resume-123" };
      const p = engine.run(opts);
      await vi.runAllTimersAsync();
      const result = await p;
      expect(result.sessionId).toBe("resume-123");
    });

    it("uses sessionId when resumeSessionId is absent", async () => {
      const opts: EngineRunOpts = { prompt: "q", cwd: "/tmp", sessionId: "sess-456" };
      const p = engine.run(opts);
      await vi.runAllTimersAsync();
      const result = await p;
      expect(result.sessionId).toBe("sess-456");
    });

    it("generates a UUID when neither resumeSessionId nor sessionId is provided", async () => {
      const opts: EngineRunOpts = { prompt: "q", cwd: "/tmp" };
      const p = engine.run(opts);
      await vi.runAllTimersAsync();
      const result = await p;
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("prefers resumeSessionId over sessionId", async () => {
      const opts: EngineRunOpts = {
        prompt: "q",
        cwd: "/tmp",
        resumeSessionId: "resume-999",
        sessionId: "sess-111",
      };
      const p = engine.run(opts);
      await vi.runAllTimersAsync();
      const result = await p;
      expect(result.sessionId).toBe("resume-999");
    });
  });

  describe("run() — streaming (onStream callback)", () => {
    it("emits text chunks when onStream is provided", async () => {
      const chunks: StreamDelta[] = [];
      const onStream = vi.fn((delta: StreamDelta) => chunks.push(delta));

      const fixed = new MockEngine({ fixedResponse: "hello world" });
      const opts: EngineRunOpts = { prompt: "q", cwd: "/tmp", onStream };

      const p = fixed.run(opts);
      await vi.runAllTimersAsync();
      await p;

      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks.length).toBe(2); // "hello" and " world"
      expect(textChunks[0].content).toBe("hello");
      expect(textChunks[1].content).toBe(" world");
    });

    it("emits text_snapshot at the end of streaming", async () => {
      const chunks: StreamDelta[] = [];
      const onStream = vi.fn((delta: StreamDelta) => chunks.push(delta));

      const fixed = new MockEngine({ fixedResponse: "hi there" });
      const opts: EngineRunOpts = { prompt: "q", cwd: "/tmp", onStream };

      const p = fixed.run(opts);
      await vi.runAllTimersAsync();
      await p;

      const snapshots = chunks.filter((c) => c.type === "text_snapshot");
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].content).toBe("hi there");
    });

    it("does NOT call onStream when not provided", async () => {
      const opts: EngineRunOpts = { prompt: "q", cwd: "/tmp" };
      const p = engine.run(opts);
      await vi.runAllTimersAsync();
      // Simply verify no error is thrown — there is nothing to assert beyond a valid result
      const result = await p;
      expect(result.result).toBeTruthy();
    });

    it("first word chunk has no leading space, subsequent chunks have a space prefix", async () => {
      const chunks: StreamDelta[] = [];
      const onStream = vi.fn((delta: StreamDelta) => chunks.push(delta));

      const fixed = new MockEngine({ fixedResponse: "one two three" });
      const opts: EngineRunOpts = { prompt: "q", cwd: "/tmp", onStream };

      const p = fixed.run(opts);
      await vi.runAllTimersAsync();
      await p;

      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks[0].content).toBe("one");
      expect(textChunks[1].content).toBe(" two");
      expect(textChunks[2].content).toBe(" three");
    });
  });
});
