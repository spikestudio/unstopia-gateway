import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Point initDb to a temp directory so tests don't touch the real database
const tmpHome = path.join(os.tmpdir(), `jinn-budgets-test-${process.pid}-${Date.now()}`);
mkdirSync(path.join(tmpHome, "sessions"), { recursive: true });
process.env.JINN_HOME = tmpHome;

import { checkBudget, getBudgetEvents, getBudgetStatus, overrideBudget, recordBudgetEvent } from "../budgets.js";

interface BudgetEvent {
  id: string;
  employee: string;
  event_type: string;
  amount: number;
  limit_amount: number;
  created_at: string;
}

function allBudgetEvents(): BudgetEvent[] {
  return getBudgetEvents(10_000) as BudgetEvent[];
}

describe("AC-E003-04: getBudgetStatus", () => {
  it("returns ok with zero spend when employee has no budget config", () => {
    const result = getBudgetStatus("unknown-employee", {});
    expect(result.status).toBe("ok");
    expect(result.spend).toBe(0);
    expect(result.limit).toBe(0);
    expect(result.percent).toBe(0);
  });

  it("returns ok with zero spend when no sessions exist for employee", () => {
    const result = getBudgetStatus("alice", { alice: 100 });
    expect(result.status).toBe("ok");
    expect(result.spend).toBeGreaterThanOrEqual(0);
    expect(result.limit).toBe(100);
    expect(result.percent).toBeGreaterThanOrEqual(0);
  });

  it("returns status ok when percent is below 80", () => {
    // No sessions inserted → spend=0, percent=0 → status="ok"
    const result = getBudgetStatus("bob", { bob: 200 });
    expect(result.status).toBe("ok");
    expect(result.percent).toBeLessThan(80);
  });

  it("returns correct limit from budgetConfig", () => {
    const result = getBudgetStatus("charlie", { charlie: 50 });
    expect(result.limit).toBe(50);
  });

  it("returns percent as integer (Math.round)", () => {
    // spend=0, limit=100 → percent = round(0/100 * 100) = 0
    const result = getBudgetStatus("dave", { dave: 100 });
    expect(Number.isInteger(result.percent)).toBe(true);
  });

  it("returns percent 0 when limit is 0", () => {
    // limit=0 branch: percent should be 0 (not divide by zero)
    const result = getBudgetStatus("eve", { eve: 0 });
    // When limit is 0 (falsy), the function returns early with ok/0/0/0
    expect(result.percent).toBe(0);
  });
});

describe("AC-E003-04: checkBudget", () => {
  it("returns ok when employee has no budget config", () => {
    const status = checkBudget("nobody", {});
    expect(status).toBe("ok");
  });

  it("returns ok when spend is below warning threshold", () => {
    const status = checkBudget("frank", { frank: 1000 });
    expect(status).toBe("ok");
  });

  it("returns a valid BudgetStatus string", () => {
    const status = checkBudget("grace", { grace: 100 });
    expect(["ok", "warning", "exceeded", "paused"]).toContain(status);
  });
});

describe("AC-E003-04: recordBudgetEvent and getBudgetEvents", () => {
  it("getBudgetEvents returns an array", () => {
    const events = getBudgetEvents();
    expect(Array.isArray(events)).toBe(true);
  });

  it("getBudgetEvents respects the limit parameter", () => {
    // Record a few events first
    recordBudgetEvent("henry", "test", 10, 100);
    recordBudgetEvent("henry", "test", 20, 100);
    recordBudgetEvent("henry", "test", 30, 100);

    const eventsLimit1 = getBudgetEvents(1);
    expect(eventsLimit1.length).toBeLessThanOrEqual(1);
  });

  it("recordBudgetEvent inserts an event retrievable by getBudgetEvents", () => {
    const beforeIds = new Set(allBudgetEvents().map((e) => e.id));
    recordBudgetEvent("ivy", "alert", 50, 100);
    const newEvent = allBudgetEvents().find((e) => !beforeIds.has(e.id));
    expect(newEvent).toBeDefined();
    expect(newEvent?.employee).toBe("ivy");
    expect(newEvent?.event_type).toBe("alert");
    expect(newEvent?.amount).toBe(50);
  });

  it("getBudgetEvents uses default limit of 50", () => {
    const events = getBudgetEvents();
    expect(events.length).toBeLessThanOrEqual(50);
  });
});

describe("AC-E003-04: overrideBudget", () => {
  it("returns status ok and a message", () => {
    const result = overrideBudget("jack", { jack: 100 });
    expect(result.status).toBe("ok");
    expect(result.message).toContain("jack");
  });

  it("records an override event in budget_events", () => {
    const beforeIds = new Set(allBudgetEvents().map((e) => e.id));
    overrideBudget("kate", { kate: 200 });
    const newEvent = allBudgetEvents().find((e) => !beforeIds.has(e.id));
    expect(newEvent).toBeDefined();
    expect(newEvent?.employee).toBe("kate");
    expect(newEvent?.event_type).toBe("override");
  });

  it("uses limit 0 when employee not in budgetConfig", () => {
    // overrideBudget falls back to 0 when employee not in config
    const result = overrideBudget("leo", {});
    expect(result.status).toBe("ok");
    expect(result.message).toContain("leo");
  });
});
