import type { Dirent } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TranscriptReader } from "../session-runner.js";
import { loadRawTranscript, loadTranscriptMessages } from "../session-runner.js";

const makeDir = (name: string, isDir = true): Dirent =>
  ({ name, isDirectory: () => isDir }) as unknown as Dirent;

const makeReader = (files: Record<string, string>, dirs: string[] = ["proj1"]): TranscriptReader => ({
  existsSync: (p: string) => {
    if (p.endsWith("projects")) return true;
    return Object.keys(files).some((k) => p.endsWith(k));
  },
  readdirSync: (_p: string, _opts: { withFileTypes: true }) => dirs.map((d) => makeDir(d)),
  readFileSync: (p: string, _enc: "utf-8") => {
    const key = Object.keys(files).find((k) => p.endsWith(k));
    return key ? files[key] : "";
  },
});

const makeLine = (type: "user" | "assistant", content: string) =>
  JSON.stringify({ type, message: { content } });

// ── loadRawTranscript ─────────────────────────────────────────────────────────

describe("loadRawTranscript", () => {
  it("should return entries from a valid JSONL file", () => {
    const reader = makeReader(
      { "sess1.jsonl": [makeLine("user", "hello"), makeLine("assistant", "hi")].join("\n") },
      ["proj1"],
    );
    const result = loadRawTranscript("sess1", reader);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  it("should return [] when projects directory does not exist", () => {
    const reader: TranscriptReader = {
      existsSync: () => false,
      readdirSync: () => [],
      readFileSync: () => "",
    };
    expect(loadRawTranscript("sess1", reader)).toEqual([]);
  });

  it("should return [] when the target JSONL file does not exist", () => {
    const reader: TranscriptReader = {
      existsSync: (p) => p.endsWith("projects"),
      readdirSync: () => [makeDir("proj1")],
      readFileSync: () => "",
    };
    expect(loadRawTranscript("sess1", reader)).toEqual([]);
  });

  it("should skip invalid JSON lines and returns remaining entries", () => {
    const lines = ["INVALID_JSON", makeLine("user", "valid")].join("\n");
    const reader = makeReader({ "sess1.jsonl": lines });
    const result = loadRawTranscript("sess1", reader);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });

  it("should skip non-user/assistant entries (e.g. system)", () => {
    const lines = [
      JSON.stringify({ type: "system", message: { content: "ignored" } }),
      makeLine("user", "kept"),
    ].join("\n");
    const reader = makeReader({ "sess1.jsonl": lines });
    expect(loadRawTranscript("sess1", reader)).toHaveLength(1);
  });

  it("should parse array content with multiple block types", () => {
    const content = [
      { type: "text", text: "hello" },
      { type: "tool_use", name: "bash", input: { cmd: "ls" } },
      { type: "tool_result", content: "file.txt" },
      { type: "thinking", thinking: "thinking..." },
    ];
    const line = JSON.stringify({ type: "assistant", message: { content } });
    const reader = makeReader({ "sess1.jsonl": line });
    const result = loadRawTranscript("sess1", reader);
    expect(result[0].content).toHaveLength(4);
    expect(result[0].content[0]).toMatchObject({ type: "text", text: "hello" });
    expect(result[0].content[1]).toMatchObject({ type: "tool_use", name: "bash" });
    expect(result[0].content[2]).toMatchObject({ type: "tool_result" });
    expect(result[0].content[3]).toMatchObject({ type: "thinking" });
  });

  it("should handle tool_result with array content", () => {
    const content = [{ type: "tool_result", content: [{ type: "text", text: "out" }] }];
    const line = JSON.stringify({ type: "assistant", message: { content } });
    const reader = makeReader({ "sess1.jsonl": line });
    const result = loadRawTranscript("sess1", reader);
    expect(result[0].content[0]).toMatchObject({ type: "tool_result", text: "out" });
  });

  it("should skip entries with no parseable content blocks", () => {
    const line = JSON.stringify({ type: "user", message: { content: [] } });
    const reader = makeReader({ "sess1.jsonl": line });
    expect(loadRawTranscript("sess1", reader)).toHaveLength(0);
  });
});

// ── loadTranscriptMessages ────────────────────────────────────────────────────

describe("loadTranscriptMessages", () => {
  it("should convert text content to string messages", () => {
    const reader = makeReader({
      "sess1.jsonl": [makeLine("user", "hello"), makeLine("assistant", "hi")].join("\n"),
    });
    const result = loadTranscriptMessages("sess1", reader);
    expect(result).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
  });

  it("should return [] when projects directory does not exist", () => {
    const reader: TranscriptReader = {
      existsSync: () => false,
      readdirSync: () => [],
      readFileSync: () => "",
    };
    expect(loadTranscriptMessages("sess1", reader)).toEqual([]);
  });

  it("should return [] when JSONL file does not exist", () => {
    const reader: TranscriptReader = {
      existsSync: (p) => p.endsWith("projects"),
      readdirSync: () => [makeDir("proj1")],
      readFileSync: () => "",
    };
    expect(loadTranscriptMessages("sess1", reader)).toEqual([]);
  });

  it("should join array content text blocks into a single string", () => {
    const content = [
      { type: "text", text: "part1 " },
      { type: "tool_use", name: "bash" },
      { type: "text", text: "part2" },
    ];
    const line = JSON.stringify({ type: "user", message: { content } });
    const reader = makeReader({ "sess1.jsonl": line });
    const result = loadTranscriptMessages("sess1", reader);
    expect(result[0].content).toBe("part1 part2");
  });

  it("should skip entries with empty content after join", () => {
    const content = [{ type: "tool_use", name: "bash" }];
    const line = JSON.stringify({ type: "user", message: { content } });
    const reader = makeReader({ "sess1.jsonl": line });
    expect(loadTranscriptMessages("sess1", reader)).toHaveLength(0);
  });

  it("should skip invalid JSON lines without throwing", () => {
    const lines = ["BAD_JSON", makeLine("assistant", "good")].join("\n");
    const reader = makeReader({ "sess1.jsonl": lines });
    const result = loadTranscriptMessages("sess1", reader);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("good");
  });
});
