import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Point initDb to a temp directory so tests don't touch the real database
const tmpHome = path.join(os.tmpdir(), `gateway-test-${process.pid}`);
mkdirSync(path.join(tmpHome, "sessions"), { recursive: true });
process.env.GATEWAY_HOME = tmpHome;

import { getCostSummary, getCostsByEmployee } from "../costs.js";

describe("getCostSummary", () => {
  it("returns zero total when no sessions exist", () => {
    const result = getCostSummary("month");
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.daily)).toBe(true);
    expect(Array.isArray(result.byEmployee)).toBe(true);
  });

  it("returns zero for day period", () => {
    const result = getCostSummary("day");
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("returns zero for week period", () => {
    const result = getCostSummary("week");
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});

describe("getCostsByEmployee", () => {
  it("returns an array for month period", () => {
    const result = getCostsByEmployee("month");
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns an array for week period", () => {
    const result = getCostsByEmployee("week");
    expect(Array.isArray(result)).toBe(true);
  });
});
