import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factory is hoisted — cannot reference local variables.
// Use a fixed path that the mock can resolve at hoist time.
vi.mock("../paths.js", () => ({
  JINN_HOME: path.join(import.meta.dirname || __dirname, ".tmp-usage-test"),
}));

import {
  getClaudeExpectedResetAt,
  isLikelyNearClaudeUsageLimit,
  readClaudeUsageState,
  recordClaudeRateLimit,
} from "../usageAwareness.js";

const TEMP_DIR = path.join(import.meta.dirname || __dirname, ".tmp-usage-test");
const STATE_PATH = path.join(TEMP_DIR, "tmp", "claude-usage.json");

beforeEach(() => {
  fs.mkdirSync(path.join(TEMP_DIR, "tmp"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

describe("isLikelyNearClaudeUsageLimit", () => {
  it("returns false when no state file exists", () => {
    expect(isLikelyNearClaudeUsageLimit()).toBe(false);
  });

  it("returns true when rate limit was hit recently (within 6h)", () => {
    const recentHit = new Date(Date.now() - 30 * 60_000).toISOString(); // 30 min ago
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastRateLimitAt: recentHit }));
    expect(isLikelyNearClaudeUsageLimit()).toBe(true);
  });

  it("returns false when rate limit was hit more than 6h ago", () => {
    const oldHit = new Date(Date.now() - 7 * 60 * 60_000).toISOString(); // 7h ago
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastRateLimitAt: oldHit }));
    expect(isLikelyNearClaudeUsageLimit()).toBe(false);
  });

  it("returns false when lastResetsAt has passed, even if lastRateLimitAt is recent", () => {
    const recentHit = new Date(Date.now() - 30 * 60_000).toISOString(); // 30 min ago
    const pastReset = new Date(Date.now() - 10 * 60_000).toISOString(); // 10 min ago
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastRateLimitAt: recentHit, lastResetsAt: pastReset }));
    expect(isLikelyNearClaudeUsageLimit()).toBe(false);
  });

  it("returns true when lastResetsAt is in the future", () => {
    const recentHit = new Date(Date.now() - 30 * 60_000).toISOString(); // 30 min ago
    const futureReset = new Date(Date.now() + 60 * 60_000).toISOString(); // 1h from now
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastRateLimitAt: recentHit, lastResetsAt: futureReset }));
    expect(isLikelyNearClaudeUsageLimit()).toBe(true);
  });

  it("ignores invalid lastResetsAt and falls back to 6h heuristic", () => {
    const recentHit = new Date(Date.now() - 30 * 60_000).toISOString();
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastRateLimitAt: recentHit, lastResetsAt: "not-a-date" }));
    expect(isLikelyNearClaudeUsageLimit()).toBe(true);
  });

  it("works end-to-end with recordClaudeRateLimit", () => {
    const futureResetSeconds = (Date.now() + 2 * 60 * 60_000) / 1000; // 2h from now
    recordClaudeRateLimit(futureResetSeconds);
    expect(isLikelyNearClaudeUsageLimit()).toBe(true);

    // Simulate time passing beyond the reset
    const pastResetTime = new Date(futureResetSeconds * 1000 + 1000);
    expect(isLikelyNearClaudeUsageLimit(pastResetTime)).toBe(false);
  });
});

describe("readClaudeUsageState", () => {
  it("invalid JSON ファイルがある場合は空オブジェクトを返す（catch ブランチ）", () => {
    fs.writeFileSync(STATE_PATH, "{ invalid json !!!");
    const state = readClaudeUsageState();
    expect(state).toEqual({});
  });

  it("JSON が null の場合は空オブジェクトを返す", () => {
    fs.writeFileSync(STATE_PATH, "null");
    const state = readClaudeUsageState();
    expect(state).toEqual({});
  });

  it("非オブジェクト（文字列）の場合は空オブジェクトを返す", () => {
    fs.writeFileSync(STATE_PATH, '"just a string"');
    const state = readClaudeUsageState();
    expect(state).toEqual({});
  });
});

describe("getClaudeExpectedResetAt", () => {
  it("lastResetsAt がない場合は undefined を返す", () => {
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastRateLimitAt: new Date().toISOString() }));
    expect(getClaudeExpectedResetAt()).toBeUndefined();
  });

  it("lastResetsAt が無効な日付の場合は undefined を返す", () => {
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastResetsAt: "not-a-date" }));
    expect(getClaudeExpectedResetAt()).toBeUndefined();
  });

  it("lastResetsAt が過去の場合は undefined を返す", () => {
    const pastReset = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastResetsAt: pastReset }));
    expect(getClaudeExpectedResetAt()).toBeUndefined();
  });

  it("lastResetsAt が未来の場合は Date オブジェクトを返す", () => {
    const futureReset = new Date(Date.now() + 60 * 60_000).toISOString(); // 1h from now
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastResetsAt: futureReset }));
    const result = getClaudeExpectedResetAt();
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe(futureReset);
  });

  it("now パラメータを使って比較できる", () => {
    const futureReset = new Date(Date.now() + 60 * 60_000).toISOString();
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastResetsAt: futureReset }));

    // now を futureReset よりも先にすると undefined が返る
    const afterReset = new Date(new Date(futureReset).getTime() + 1000);
    expect(getClaudeExpectedResetAt(afterReset)).toBeUndefined();
  });

  it("lastResetsAt が ちょうど now と同じ時刻の場合は undefined を返す（境界値）", () => {
    const now = new Date();
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastResetsAt: now.toISOString() }));
    expect(getClaudeExpectedResetAt(now)).toBeUndefined();
  });
});

describe("recordClaudeRateLimit", () => {
  it("resetsAtSeconds が undefined の場合は lastResetsAt を記録しない", () => {
    recordClaudeRateLimit(undefined);
    const state = readClaudeUsageState();
    expect(state.lastRateLimitAt).toBeDefined();
    expect(state.lastResetsAt).toBeUndefined();
  });

  it("resetsAtSeconds が NaN の場合は lastResetsAt を記録しない", () => {
    recordClaudeRateLimit(Number.NaN);
    const state = readClaudeUsageState();
    expect(state.lastRateLimitAt).toBeDefined();
    expect(state.lastResetsAt).toBeUndefined();
  });

  it("resetsAtSeconds が Infinity の場合は lastResetsAt を記録しない", () => {
    recordClaudeRateLimit(Infinity);
    const state = readClaudeUsageState();
    expect(state.lastRateLimitAt).toBeDefined();
    expect(state.lastResetsAt).toBeUndefined();
  });

  it("既存の state があっても正しく上書きする", () => {
    const firstReset = (Date.now() + 60_000) / 1000;
    recordClaudeRateLimit(firstReset);

    const secondReset = (Date.now() + 120_000) / 1000;
    recordClaudeRateLimit(secondReset);

    const state = readClaudeUsageState();
    expect(new Date(state.lastResetsAt!).getTime()).toBeCloseTo(secondReset * 1000, -3);
  });
});
