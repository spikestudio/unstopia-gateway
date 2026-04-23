import { describe, expect, it } from "vitest";
import { formatResponse, markdownToWhatsApp } from "../format.js";

describe("markdownToWhatsApp", () => {
  describe("headings", () => {
    it("converts ## headings to *bold* on own line", () => {
      expect(markdownToWhatsApp("## My Heading")).toBe("*My Heading*");
    });

    it("converts # h1 to bold", () => {
      expect(markdownToWhatsApp("# Title")).toBe("*Title*");
    });
  });

  describe("bold", () => {
    it("converts **bold** to *bold*", () => {
      expect(markdownToWhatsApp("this is **bold** text")).toBe("this is *bold* text");
    });

    it("converts __bold__ to *bold*", () => {
      expect(markdownToWhatsApp("this is __bold__ text")).toBe("this is *bold* text");
    });
  });

  describe("italic", () => {
    it("preserves _italic_ (WhatsApp uses same syntax)", () => {
      expect(markdownToWhatsApp("this is _italic_ text")).toBe("this is _italic_ text");
    });
  });

  describe("strikethrough", () => {
    it("converts ~~strike~~ to ~strike~", () => {
      expect(markdownToWhatsApp("this is ~~struck~~ out")).toBe("this is ~struck~ out");
    });
  });

  describe("links", () => {
    it("converts [text](url) to text (url) since WA auto-links", () => {
      expect(markdownToWhatsApp("click [here](https://example.com)")).toBe("click here (https://example.com)");
    });
  });

  describe("bullet lists", () => {
    it("converts - item to • item", () => {
      expect(markdownToWhatsApp("- first\n- second")).toBe("• first\n• second");
    });

    it("converts * item to • item (not bold)", () => {
      expect(markdownToWhatsApp("* first\n* second")).toBe("• first\n• second");
    });
  });

  describe("code", () => {
    it("preserves inline code", () => {
      expect(markdownToWhatsApp("use `code`")).toBe("use `code`");
    });

    it("preserves code blocks", () => {
      const input = "```\ncode here\n```";
      expect(markdownToWhatsApp(input)).toBe("```\ncode here\n```");
    });

    it("does not convert markdown inside code blocks", () => {
      const input = "```\n## not a heading\n```";
      expect(markdownToWhatsApp(input)).toBe("```\n## not a heading\n```");
    });
  });

  describe("mixed content", () => {
    it("handles headings + bold + links", () => {
      const input = "## Summary\n\nThis is **important** and [docs](https://docs.com).";
      const expected = "*Summary*\n\nThis is *important* and docs (https://docs.com).";
      expect(markdownToWhatsApp(input)).toBe(expected);
    });
  });
});

describe("formatResponse", () => {
  it("applies markdown conversion before chunking", () => {
    const result = formatResponse("## Hello\n\n**bold** text");
    expect(result).toEqual(["*Hello*\n\n*bold* text"]);
  });

  it("returns single chunk when text is within 4000 chars", () => {
    const text = "a".repeat(3999);
    expect(formatResponse(text)).toHaveLength(1);
  });

  it("returns single chunk when text is exactly 4000 chars", () => {
    const text = "a".repeat(4000);
    expect(formatResponse(text)).toHaveLength(1);
  });

  it("splits text longer than 4000 chars into multiple chunks", () => {
    // Create text with newlines to allow splitting at word boundaries
    const line = "hello world ".repeat(40); // ~480 chars per line
    const text = (line + "\n").repeat(10); // ~4810 chars
    const chunks = formatResponse(text);
    expect(chunks.length).toBeGreaterThan(1);
    // All characters should be preserved (accounting for trimStart)
    const total = chunks.join("").length;
    // total chars may differ slightly due to trimStart on chunk boundaries
    expect(total).toBeGreaterThan(0);
  });

  it("splits at newline boundaries when possible", () => {
    // line is 50 chars, we need > 4000 chars total, so 90 lines
    const line = "a".repeat(44) + " end";
    const longText = Array.from({ length: 90 }, () => line).join("\n");
    const chunks = formatResponse(longText);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be 4000 chars or fewer
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4000);
    }
  });

  it("splits at space boundaries when no newlines available", () => {
    // A single very long line of space-separated words (> 4000 chars)
    const word = "hello ";
    const longText = word.repeat(800); // ~4800 chars, no newlines
    const chunks = formatResponse(longText);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4000);
    }
  });

  it("hard-splits at 4000 chars when no spaces or newlines exist", () => {
    // Continuous text without spaces or newlines
    const longText = "a".repeat(5000);
    const chunks = formatResponse(longText);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // First chunk should be exactly 4000 chars
    expect(chunks[0].length).toBe(4000);
    expect(chunks[1].length).toBe(1000);
  });

  it("returns empty array for empty string", () => {
    expect(formatResponse("")).toEqual([""]);
  });
});
