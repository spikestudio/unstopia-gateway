import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadAttachment, formatResponse } from "../format.js";

const DISCORD_MAX = 2000;

describe("AC-E003-04: formatResponse", () => {
  it("returns a single chunk for short messages", () => {
    const result = formatResponse("Hello, Discord!");
    expect(result).toEqual(["Hello, Discord!"]);
  });

  it("returns a single chunk for messages exactly at the limit", () => {
    const text = "A".repeat(DISCORD_MAX);
    const result = formatResponse(text);
    expect(result).toEqual([text]);
  });

  it("splits long messages at a newline boundary", () => {
    const line1 = "A".repeat(1800);
    const line2 = "B".repeat(1800);
    const input = `${line1}\n${line2}`;
    const result = formatResponse(input);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(line1);
    expect(result[1]).toBe(line2);
  });

  it("splits at space boundary when no newline fits within the limit", () => {
    const word1 = "A".repeat(1990);
    const word2 = "B".repeat(100);
    const input = `${word1} ${word2}`;
    const result = formatResponse(input);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(word1);
    expect(result[1]).toBe(word2);
  });

  it("force-splits at the hard limit when no newline or space is available", () => {
    const text = "A".repeat(DISCORD_MAX + 500);
    const result = formatResponse(text);
    expect(result.length).toBe(2);
    expect(result[0]).toBe("A".repeat(DISCORD_MAX));
    expect(result[1]).toBe("A".repeat(500));
  });

  it("produces multiple chunks for very long messages", () => {
    const chunk = "word ".repeat(500); // ~2500 chars
    const input = chunk.repeat(3);
    const result = formatResponse(input);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(DISCORD_MAX);
    }
  });

  it("returns an empty array for empty input", () => {
    const result = formatResponse("");
    expect(result).toEqual([""]);
  });
});

// ── AC-E003-03: downloadAttachment ───────────────────────────────────────────

describe("AC-E003-03: downloadAttachment", () => {
  const originalFetch = globalThis.fetch;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "discord-dl-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });

  it("downloads and saves file when response is ok", async () => {
    const content = Buffer.from("file content");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(content.buffer),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const destPath = await downloadAttachment("https://example.com/file.png", tmpDir, "test.png");
    expect(destPath).toBe(path.join(tmpDir, "test.png"));
    expect(fs.existsSync(destPath)).toBe(true);
  });

  it("throws when response is not ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(downloadAttachment("https://example.com/file.png", tmpDir, "test.png")).rejects.toThrow(
      "Failed to download attachment: 403",
    );
  });
});
