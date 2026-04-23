import { describe, expect, it } from "vitest";
import {
  computeNextRetryDelayMs,
  computeRateLimitDeadlineMs,
  detectRateLimit,
  isDeadSessionError,
} from "../rateLimit.js";
import type { EngineResult } from "../types.js";

function makeResult(overrides: Partial<EngineResult> = {}): EngineResult {
  return {
    sessionId: "test-session",
    result: "",
    ...overrides,
  };
}

describe("isDeadSessionError", () => {
  it("returns true for error with zero cost and no rate limit", () => {
    const result = makeResult({
      error: "Claude exited with code 1 (no stderr output)",
      cost: 0,
      numTurns: 0,
    });
    expect(isDeadSessionError(result)).toBe(true);
  });

  it("returns true for error with undefined cost/turns (no work done)", () => {
    const result = makeResult({
      error: "Claude exited with code 1",
    });
    expect(isDeadSessionError(result)).toBe(true);
  });

  it("returns false when rate limit status is present", () => {
    const result = makeResult({
      error: "Claude usage limit reached",
      cost: 0,
      rateLimit: { status: "rejected" },
    });
    expect(isDeadSessionError(result)).toBe(false);
  });

  it("returns false when cost > 0 (work was done)", () => {
    const result = makeResult({
      error: "Some error after work",
      cost: 0.05,
      numTurns: 3,
    });
    expect(isDeadSessionError(result)).toBe(false);
  });

  it("returns false when numTurns > 0 (work was done)", () => {
    const result = makeResult({
      error: "Some error after work",
      cost: 0,
      numTurns: 1,
    });
    expect(isDeadSessionError(result)).toBe(false);
  });

  it("returns false when there is no error", () => {
    const result = makeResult({ result: "success" });
    expect(isDeadSessionError(result)).toBe(false);
  });

  // Secondary pattern matching — requires zero cost as conjunction
  it("returns true for 'error_during_execution' with zero cost", () => {
    const result = makeResult({
      error: "error_during_execution",
      cost: 0,
      numTurns: 0,
    });
    expect(isDeadSessionError(result)).toBe(true);
  });

  it("returns false for 'error_during_execution' when cost > 0 (real work done)", () => {
    const result = makeResult({
      error: "error_during_execution",
      cost: 0.05,
      numTurns: 1,
    });
    expect(isDeadSessionError(result)).toBe(false);
  });

  it("returns true for 'session not found' in error text", () => {
    const result = makeResult({
      error: "Session not found or expired",
      cost: 0,
    });
    expect(isDeadSessionError(result)).toBe(true);
  });

  it("returns true for 'invalid session' in error text", () => {
    const result = makeResult({
      error: "Invalid session ID provided",
      cost: 0,
    });
    expect(isDeadSessionError(result)).toBe(true);
  });

  it("returns true for 'session expired' in error text", () => {
    const result = makeResult({
      error: "The session has expired",
      cost: 0,
    });
    expect(isDeadSessionError(result)).toBe(true);
  });

  it("does not false-positive on rate limit errors with no cost", () => {
    const result = makeResult({
      error: "rate limit exceeded",
      cost: 0,
      rateLimit: { status: "rejected", resetsAt: 1234567890 },
    });
    expect(isDeadSessionError(result)).toBe(false);
  });

  it("does not interfere with detectRateLimit", () => {
    const rateLimited = makeResult({
      error: "Claude usage limit reached",
      rateLimit: { status: "rejected", resetsAt: 9999999999 },
    });
    expect(detectRateLimit(rateLimited).limited).toBe(true);
    expect(isDeadSessionError(rateLimited)).toBe(false);
  });
});

describe("detectRateLimit", () => {
  it("detects rate limit from rateLimit.status=rejected", () => {
    const result = makeResult({ rateLimit: { status: "rejected", resetsAt: 9999999999 } });
    const detection = detectRateLimit(result);
    expect(detection.limited).toBe(true);
    expect(detection.resetsAt).toBe(9999999999);
  });

  it("detects rate limit from error text matching regex", () => {
    const result = makeResult({ error: "too many requests" });
    expect(detectRateLimit(result).limited).toBe(true);
  });

  it("detects 'rate limit' in error text", () => {
    const result = makeResult({ error: "rate limit exceeded" });
    expect(detectRateLimit(result).limited).toBe(true);
  });

  it("detects '429' in error text", () => {
    const result = makeResult({ error: "HTTP 429 error" });
    expect(detectRateLimit(result).limited).toBe(true);
  });

  it("detects 'usage limit' in error text", () => {
    const result = makeResult({ error: "Claude usage limit reached" });
    expect(detectRateLimit(result).limited).toBe(true);
  });

  it("returns limited=false when no rate limit signals", () => {
    const result = makeResult({ result: "success" });
    expect(detectRateLimit(result).limited).toBe(false);
    expect(detectRateLimit(result).resetsAt).toBeUndefined();
  });

  it("returns resetsAt from rateLimit when available", () => {
    const result = makeResult({ rateLimit: { status: "rejected", resetsAt: 1234567890 } });
    expect(detectRateLimit(result).resetsAt).toBe(1234567890);
  });

  it("returns resetsAt=undefined when rateLimit.resetsAt is not a number", () => {
    const result = makeResult({ rateLimit: { status: "rejected" } });
    expect(detectRateLimit(result).resetsAt).toBeUndefined();
  });
});

describe("computeRateLimitDeadlineMs", () => {
  it("returns resetsAt * 1000 + extraMs when resetsAt is finite", () => {
    const resetsAt = 1000; // seconds
    const extraMs = 30 * 60_000;
    expect(computeRateLimitDeadlineMs(resetsAt, extraMs)).toBe(resetsAt * 1000 + extraMs);
  });

  it("uses default extraMs of 30 minutes when not specified", () => {
    const resetsAt = 1000;
    const result = computeRateLimitDeadlineMs(resetsAt);
    expect(result).toBe(resetsAt * 1000 + 30 * 60_000);
  });

  it("returns Date.now() + extraMs when resetsAt is undefined", () => {
    const before = Date.now();
    const extraMs = 5000;
    const result = computeRateLimitDeadlineMs(undefined, extraMs);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before + extraMs);
    expect(result).toBeLessThanOrEqual(after + extraMs);
  });

  it("returns Date.now() + extraMs when resetsAt is Infinity", () => {
    const before = Date.now();
    const extraMs = 5000;
    const result = computeRateLimitDeadlineMs(Number.POSITIVE_INFINITY, extraMs);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before + extraMs);
    expect(result).toBeLessThanOrEqual(after + extraMs);
  });
});

describe("computeNextRetryDelayMs", () => {
  it("returns default 60s delay when resetsAt is undefined", () => {
    const result = computeNextRetryDelayMs();
    expect(result.delayMs).toBe(60_000);
    expect(result.resumeAt).toBeUndefined();
  });

  it("returns computed delay based on resetsAt timestamp", () => {
    const futureSeconds = (Date.now() + 5 * 60_000) / 1000; // 5 min from now
    const result = computeNextRetryDelayMs(futureSeconds);
    expect(result.resumeAt).toBeInstanceOf(Date);
    // delay should be at least 10s (buffer minimum)
    expect(result.delayMs).toBeGreaterThanOrEqual(10_000);
  });

  it("returns minimum 10s delay even when resetsAt is in the past", () => {
    const pastSeconds = (Date.now() - 60_000) / 1000; // 1 min ago
    const result = computeNextRetryDelayMs(pastSeconds);
    expect(result.delayMs).toBe(10_000);
    expect(result.resumeAt).toBeInstanceOf(Date);
  });

  it("returns resumeAt as a Date object", () => {
    const futureSeconds = (Date.now() + 2 * 60_000) / 1000;
    const result = computeNextRetryDelayMs(futureSeconds);
    expect(result.resumeAt).toBeInstanceOf(Date);
  });
});
