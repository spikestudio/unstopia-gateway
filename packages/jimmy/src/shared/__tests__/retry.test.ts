import { describe, expect, it, vi } from "vitest";
import { exponentialBackoffMs, withRetry } from "../retry.js";

describe("exponentialBackoffMs", () => {
  it("attempt=0 returns baseMs", () => {
    expect(exponentialBackoffMs(0, 5000, 60000)).toBe(5000);
  });

  it("attempt=1 returns baseMs * 2", () => {
    expect(exponentialBackoffMs(1, 5000, 60000)).toBe(10000);
  });

  it("large attempt is capped at maxMs", () => {
    expect(exponentialBackoffMs(10, 5000, 60000)).toBe(60000);
  });

  it("attempt=2 returns baseMs * 4", () => {
    expect(exponentialBackoffMs(2, 5000, 60000)).toBe(20000);
  });
});

describe("withRetry", () => {
  it("returns result on first success without retry", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, baseMs: 0, maxMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("success");
    const result = await withRetry(fn, { maxAttempts: 3, baseMs: 0, maxMs: 0 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after maxAttempts are exhausted", async () => {
    const error = new Error("always fails");
    const fn = vi.fn().mockRejectedValue(error);
    await expect(withRetry(fn, { maxAttempts: 3, baseMs: 0, maxMs: 0 })).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry with correct attempt number", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("e1"))
      .mockRejectedValueOnce(new Error("e2"))
      .mockResolvedValue("done");
    const onRetry = vi.fn();
    await withRetry(fn, { maxAttempts: 3, baseMs: 0, maxMs: 0, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 0, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 1, expect.any(Error));
  });

  it("does not call onRetry on the final failing attempt", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const onRetry = vi.fn();
    await expect(withRetry(fn, { maxAttempts: 2, baseMs: 0, maxMs: 0, onRetry })).rejects.toThrow();
    // called for attempt 0 (i=0 < maxAttempts-1=1), NOT for attempt 1 (i=1 is the last)
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
