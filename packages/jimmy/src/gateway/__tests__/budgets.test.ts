import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Point initDb to a temp directory so tests don't touch the real database
const tmpHome = path.join(os.tmpdir(), `jinn-budgets-test-${process.pid}-${Date.now()}`);
mkdirSync(path.join(tmpHome, "sessions"), { recursive: true });
process.env.JINN_HOME = tmpHome;

import { initDb } from "../../sessions/registry.js";
import { checkBudget, getBudgetEvents, getBudgetStatus, overrideBudget, recordBudgetEvent } from "../budgets.js";

// ── DB helper to insert fake sessions with spend ──────────────────────────────

function insertFakeSession(employee: string, totalCost: number): void {
  const db = initDb();
  const id = `fake-session-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sessions (id, engine, source, source_ref, employee, total_cost, created_at, last_activity, status)
    VALUES (?, 'claude', 'test', 'test-ref', ?, ?, ?, ?, 'idle')
  `).run(id, employee, totalCost, now, now);
}

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

// ── Branch coverage: warning and paused status ────────────────────────────────

describe("AC-E003-04: getBudgetStatus — warning and paused branches", () => {
  it("returns status warning when percent is between 80 and 99 (inclusive)", () => {
    // Insert a session with spend that puts the employee at ~85% of their limit
    const employee = `warning-employee-${Date.now()}`;
    const limit = 100;
    insertFakeSession(employee, 85); // 85% of 100

    const result = getBudgetStatus(employee, { [employee]: limit });
    expect(result.status).toBe("warning");
    expect(result.percent).toBeGreaterThanOrEqual(80);
    expect(result.percent).toBeLessThan(100);
  });

  it("returns status paused when percent is 100 or more", () => {
    // Insert sessions totaling >= limit
    const employee = `paused-employee-${Date.now()}`;
    const limit = 50;
    insertFakeSession(employee, 50); // exactly 100%

    const result = getBudgetStatus(employee, { [employee]: limit });
    expect(result.status).toBe("paused");
    expect(result.percent).toBeGreaterThanOrEqual(100);
  });

  it("checkBudget returns warning when spend is between 80-99%", () => {
    const employee = `checkwarn-${Date.now()}`;
    insertFakeSession(employee, 90); // 90% of 100
    const status = checkBudget(employee, { [employee]: 100 });
    expect(status).toBe("warning");
  });

  it("checkBudget returns paused when spend exceeds limit", () => {
    const employee = `checkpaused-${Date.now()}`;
    insertFakeSession(employee, 200); // 200% of 100
    const status = checkBudget(employee, { [employee]: 100 });
    expect(status).toBe("paused");
  });
});
