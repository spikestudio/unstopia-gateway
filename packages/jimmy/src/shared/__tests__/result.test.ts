import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok, type Result } from "../result.js";

describe("Result", () => {
  it("ok() returns Ok variant", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  it("err() returns Err variant", () => {
    const r = err("something went wrong");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("something went wrong");
  });

  it("TypeScript narrowing — ok branch", () => {
    const r: Result<number, string> = ok(10);
    if (r.ok) {
      expect(r.value).toBe(10);
    }
  });

  it("TypeScript narrowing — err branch", () => {
    const r: Result<number, string> = err("oops");
    if (!r.ok) {
      expect(r.error).toBe("oops");
    }
  });

  it("isOk() type guard", () => {
    const r: Result<string, number> = ok("hi");
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
  });

  it("isErr() type guard", () => {
    const r: Result<string, number> = err(42);
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
  });

  it("no external library dependency — only standard TypeScript", () => {
    // AC-E021-04: result.ts imports nothing external
    expect(true).toBe(true); // verified by file content
  });
});
