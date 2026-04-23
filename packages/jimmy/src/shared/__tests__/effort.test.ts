import { describe, expect, it, vi } from "vitest";
import { resolveEffort } from "../effort.js";

// Mock logger to suppress warnings during tests
vi.mock("../logger.js", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const nonChildSession = { parentSessionId: null, effortLevel: null };
const childSession = (effortLevel: string | null = null) => ({
  parentSessionId: "parent-session-id",
  effortLevel,
});

describe("AC-E003-03: resolveEffort", () => {
  describe("non-child session (COO session)", () => {
    it("returns engine effortLevel for a non-child session", () => {
      expect(resolveEffort({ effortLevel: "high" }, nonChildSession)).toBe("high");
    });

    it("returns 'medium' when no effortLevel is configured", () => {
      expect(resolveEffort({}, nonChildSession)).toBe("medium");
    });

    it("returns 'medium' and warns for invalid engine effortLevel", () => {
      expect(resolveEffort({ effortLevel: "turbo" }, nonChildSession)).toBe("medium");
    });

    it("accepts all valid effort levels for non-child sessions", () => {
      expect(resolveEffort({ effortLevel: "low" }, nonChildSession)).toBe("low");
      expect(resolveEffort({ effortLevel: "medium" }, nonChildSession)).toBe("medium");
      expect(resolveEffort({ effortLevel: "high" }, nonChildSession)).toBe("high");
    });
  });

  describe("child session — resolution chain", () => {
    it("prefers childEffortOverride over everything else", () => {
      const result = resolveEffort({ effortLevel: "high", childEffortOverride: "low" }, childSession("medium"), {
        effortLevel: "high",
      });
      expect(result).toBe("low");
    });

    it("ignores invalid childEffortOverride and falls back to session.effortLevel", () => {
      const result = resolveEffort({ childEffortOverride: "turbo" }, childSession("medium"));
      expect(result).toBe("medium");
    });

    it("uses session.effortLevel when no childEffortOverride", () => {
      const result = resolveEffort({ effortLevel: "high" }, childSession("low"), { effortLevel: "medium" });
      expect(result).toBe("low");
    });

    it("ignores invalid session.effortLevel and falls through to employee default", () => {
      const result = resolveEffort({}, childSession("turbo"), { effortLevel: "low" });
      expect(result).toBe("low");
    });

    it("uses employee.effortLevel when session has no valid effortLevel", () => {
      const result = resolveEffort({ effortLevel: "high" }, childSession(null), { effortLevel: "low" });
      expect(result).toBe("low");
    });

    it("ignores invalid employee.effortLevel and falls through to engine default", () => {
      const result = resolveEffort({ effortLevel: "medium" }, childSession(null), { effortLevel: "super" });
      expect(result).toBe("medium");
    });

    it("falls through all layers and returns engine effortLevel for child sessions", () => {
      const result = resolveEffort({ effortLevel: "low" }, childSession(null), null);
      expect(result).toBe("low");
    });

    it("returns 'medium' when all child session layers have no valid effort", () => {
      const result = resolveEffort({}, childSession(null), null);
      expect(result).toBe("medium");
    });

    it("handles undefined employee (no third arg)", () => {
      const result = resolveEffort({ effortLevel: "high" }, childSession(null));
      expect(result).toBe("high");
    });
  });
});
