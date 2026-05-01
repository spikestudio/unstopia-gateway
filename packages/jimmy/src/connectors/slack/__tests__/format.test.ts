import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockMkdirSync, mockWriteFileSync } = vi.hoisted(() => ({
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: { mkdirSync: mockMkdirSync, writeFileSync: mockWriteFileSync },
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
}));

import { downloadAttachment, formatResponse, markdownToSlackMrkdwn } from "../format.js";

describe("markdownToSlackMrkdwn", () => {
  describe("headings", () => {
    it("converts ## headings to bold on own line", () => {
      expect(markdownToSlackMrkdwn("## My Heading")).toBe("*My Heading*");
    });

    it("converts ### headings to bold", () => {
      expect(markdownToSlackMrkdwn("### Sub Heading")).toBe("*Sub Heading*");
    });

    it("converts # h1 to bold", () => {
      expect(markdownToSlackMrkdwn("# Title")).toBe("*Title*");
    });

    it("converts headings with up to 6 levels", () => {
      expect(markdownToSlackMrkdwn("###### Deep")).toBe("*Deep*");
    });

    it("only converts headings at start of line", () => {
      expect(markdownToSlackMrkdwn("not a ## heading")).toBe("not a ## heading");
    });
  });

  describe("bold", () => {
    it("converts **bold** to *bold*", () => {
      expect(markdownToSlackMrkdwn("this is **bold** text")).toBe("this is *bold* text");
    });

    it("converts __bold__ to *bold*", () => {
      expect(markdownToSlackMrkdwn("this is __bold__ text")).toBe("this is *bold* text");
    });

    it("handles multiple bold segments", () => {
      expect(markdownToSlackMrkdwn("**a** and **b**")).toBe("*a* and *b*");
    });
  });

  describe("italic", () => {
    it("converts _italic_ to _italic_ (passthrough)", () => {
      expect(markdownToSlackMrkdwn("this is _italic_ text")).toBe("this is _italic_ text");
    });
  });

  describe("strikethrough", () => {
    it("converts ~~strike~~ to ~strike~", () => {
      expect(markdownToSlackMrkdwn("this is ~~struck~~ out")).toBe("this is ~struck~ out");
    });
  });

  describe("links", () => {
    it("converts [text](url) to <url|text>", () => {
      expect(markdownToSlackMrkdwn("click [here](https://example.com) now")).toBe(
        "click <https://example.com|here> now",
      );
    });

    it("converts multiple links", () => {
      expect(markdownToSlackMrkdwn("[a](http://a.com) and [b](http://b.com)")).toBe(
        "<http://a.com|a> and <http://b.com|b>",
      );
    });

    it("handles bare URLs (no conversion needed)", () => {
      expect(markdownToSlackMrkdwn("visit https://example.com")).toBe("visit https://example.com");
    });
  });

  describe("bullet lists", () => {
    it("converts - item to • item", () => {
      expect(markdownToSlackMrkdwn("- first\n- second")).toBe("• first\n• second");
    });

    it("converts * item to • item", () => {
      expect(markdownToSlackMrkdwn("* first\n* second")).toBe("• first\n• second");
    });

    it("preserves indented sub-items", () => {
      expect(markdownToSlackMrkdwn("- top\n  - nested")).toBe("• top\n  • nested");
    });
  });

  describe("code (preserved)", () => {
    it("preserves inline code", () => {
      expect(markdownToSlackMrkdwn("use `console.log`")).toBe("use `console.log`");
    });

    it("preserves code blocks", () => {
      const input = "```\nconst x = 1;\n```";
      expect(markdownToSlackMrkdwn(input)).toBe("```\nconst x = 1;\n```");
    });

    it("does not convert markdown inside code blocks", () => {
      const input = "```\n## not a heading\n**not bold**\n```";
      expect(markdownToSlackMrkdwn(input)).toBe("```\n## not a heading\n**not bold**\n```");
    });

    it("does not convert markdown inside inline code", () => {
      expect(markdownToSlackMrkdwn("use `**not bold**`")).toBe("use `**not bold**`");
    });
  });

  describe("blockquotes", () => {
    it("preserves > blockquotes (Slack supports them)", () => {
      expect(markdownToSlackMrkdwn("> quoted text")).toBe("> quoted text");
    });
  });

  describe("numbered lists", () => {
    it("preserves numbered lists as-is", () => {
      expect(markdownToSlackMrkdwn("1. first\n2. second")).toBe("1. first\n2. second");
    });
  });

  describe("complex mixed content", () => {
    it("handles headings + bold + links together", () => {
      const input = "## Summary\n\nThis is **important** and [see docs](https://docs.com).";
      const expected = "*Summary*\n\nThis is *important* and <https://docs.com|see docs>.";
      expect(markdownToSlackMrkdwn(input)).toBe(expected);
    });

    it("handles text between code blocks", () => {
      const input = "Before\n```\ncode\n```\n**after**";
      const expected = "Before\n```\ncode\n```\n*after*";
      expect(markdownToSlackMrkdwn(input)).toBe(expected);
    });
  });
});

describe("formatResponse", () => {
  it("applies markdown conversion before chunking", () => {
    const result = formatResponse("## Hello\n\nThis is **bold**.");
    expect(result).toEqual(["*Hello*\n\nThis is *bold*."]);
  });

  it("still chunks long messages after conversion", () => {
    const longText = `## Title\n\n${"word ".repeat(1000)}`;
    const result = formatResponse(longText);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].startsWith("*Title*")).toBe(true);
  });

  it("AC-E003-03: force-splits at hard limit when no newline or space found", () => {
    // splitIndex <= 0 の 2 回分岐 → cutAt = SLACK_MAX_LENGTH (line 67)
    const SLACK_MAX = 3000;
    const text = "A".repeat(SLACK_MAX + 100);
    const result = formatResponse(text);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].length).toBe(SLACK_MAX);
  });
});

// ── downloadAttachment ─────────────────────────────────────────────────────

describe("downloadAttachment", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMkdirSync.mockReset();
    mockWriteFileSync.mockReset();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads attachment successfully and returns local path", async () => {
    const fakeBuffer = Buffer.from("fake-file-content");
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(fakeBuffer.buffer),
    });

    const localPath = await downloadAttachment("https://example.com/files/test.png", "xoxb-token", "/tmp/slack");

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/files/test.png", {
      headers: { Authorization: "Bearer xoxb-token" },
    });
    expect(mockMkdirSync).toHaveBeenCalledWith("/tmp/slack", { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(localPath).toMatch(/^\/tmp\/slack\/.+\.png$/);
  });

  it("throws when response is not ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    await expect(downloadAttachment("https://example.com/private", "xoxb-token", "/tmp")).rejects.toThrow(
      "Failed to download attachment: 403 Forbidden",
    );
  });

  it("uses empty extension when URL has no extension", async () => {
    const fakeBuffer = Buffer.from("data");
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(fakeBuffer.buffer),
    });

    const localPath = await downloadAttachment("https://example.com/files/noext", "xoxb-token", "/tmp/slack");

    // Should not have a trailing dot or extension
    expect(localPath).not.toMatch(/\.\w+$/);
  });
});
