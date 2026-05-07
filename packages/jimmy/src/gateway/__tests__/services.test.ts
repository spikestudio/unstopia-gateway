import { describe, expect, it } from "vitest";
import type { Employee } from "../../shared/types.js";
import { resolveOrgHierarchy } from "../org-hierarchy.js";
import { buildRoutePath, buildServiceRegistry, findCommonAncestor, resolveManagerChain } from "../services.js";

function emp(name: string, opts: Partial<Employee> = {}): Employee {
  return {
    name,
    displayName: opts.displayName ?? name,
    department: opts.department ?? "default",
    rank: opts.rank ?? "employee",
    engine: opts.engine ?? "claude",
    model: opts.model ?? "opus",
    persona: opts.persona ?? `persona for ${name}`,
    reportsTo: opts.reportsTo,
    provides: opts.provides,
  };
}

function registry(...employees: Employee[]): Map<string, Employee> {
  const map = new Map<string, Employee>();
  for (const e of employees) map.set(e.name, e);
  return map;
}

// ═══════════════════════════════════════════════════════════════
// buildServiceRegistry
// ═══════════════════════════════════════════════════════════════

describe("buildServiceRegistry", () => {
  it("returns empty registry when no employees have provides", () => {
    const reg = registry(emp("a"), emp("b"));
    const services = buildServiceRegistry(reg);
    expect(services.size).toBe(0);
  });

  it("registers services from employees", () => {
    const reg = registry(emp("dev", { provides: [{ name: "code-review", description: "Review PRs" }] }));
    const services = buildServiceRegistry(reg);
    expect(services.size).toBe(1);
    expect(services.get("code-review")?.provider.name).toBe("dev");
    expect(services.get("code-review")?.declaration.description).toBe("Review PRs");
  });

  it("registers multiple services from one employee", () => {
    const reg = registry(
      emp("dev", {
        provides: [
          { name: "code-review", description: "Review PRs" },
          { name: "web-dev", description: "Build web features" },
        ],
      }),
    );
    const services = buildServiceRegistry(reg);
    expect(services.size).toBe(2);
    expect(services.get("code-review")?.provider.name).toBe("dev");
    expect(services.get("web-dev")?.provider.name).toBe("dev");
  });

  it("higher-ranked employee wins on collision", () => {
    const reg = registry(
      emp("junior", { rank: "employee", provides: [{ name: "review", description: "Junior review" }] }),
      emp("senior", { rank: "senior", provides: [{ name: "review", description: "Senior review" }] }),
    );
    const services = buildServiceRegistry(reg);
    expect(services.get("review")?.provider.name).toBe("senior");
    expect(services.get("review")?.declaration.description).toBe("Senior review");
  });

  it("alphabetical wins on same-rank collision", () => {
    const reg = registry(
      emp("bob", { rank: "senior", provides: [{ name: "design", description: "Bob design" }] }),
      emp("alice", { rank: "senior", provides: [{ name: "design", description: "Alice design" }] }),
    );
    const services = buildServiceRegistry(reg);
    expect(services.get("design")?.provider.name).toBe("alice");
  });

  it("existing provider is retained when challenger has higher alphabetical name on same rank (line 37 branch)", () => {
    // alice is first → registered. Then bob challenges → bob > alice → alice retained (line 37 else branch)
    const reg = registry(
      emp("alice", { rank: "senior", provides: [{ name: "design", description: "Alice design" }] }),
      emp("bob", { rank: "senior", provides: [{ name: "design", description: "Bob design" }] }),
    );
    const services = buildServiceRegistry(reg);
    // alice should be retained since alice < bob alphabetically
    expect(services.get("design")?.provider.name).toBe("alice");
  });

  it("existing provider is retained when challenger has lower rank (line 37 branch)", () => {
    // senior is already registered. employee challenges → lower rank → senior retained
    const reg = registry(
      emp("senior-dev", { rank: "senior", provides: [{ name: "audit", description: "Senior audit" }] }),
      emp("junior-dev", { rank: "employee", provides: [{ name: "audit", description: "Junior audit" }] }),
    );
    const services = buildServiceRegistry(reg);
    expect(services.get("audit")?.provider.name).toBe("senior-dev");
  });
});

// ═══════════════════════════════════════════════════════════════
// buildRoutePath — uncovered branch coverage
// ═══════════════════════════════════════════════════════════════

describe("buildRoutePath — additional branch coverage", () => {
  it("returns path including ancestor when ancestor is found (line 94 if-truthy branch)", () => {
    const reg = registry(
      emp("coo", { rank: "executive" }),
      emp("mgr-a", { rank: "manager", reportsTo: "coo" }),
      emp("dev-a", { rank: "employee", reportsTo: "mgr-a" }),
      emp("mgr-b", { rank: "manager", reportsTo: "coo" }),
      emp("dev-b", { rank: "employee", reportsTo: "mgr-b" }),
    );
    const h = resolveOrgHierarchy(reg);
    const route = buildRoutePath("dev-a", "dev-b", h);
    // Route should include the common ancestor (coo)
    expect(route).toContain("coo");
  });

  it("handles route when ancestor is null/falsy (line 94 else branch)", () => {
    // If from and to have no common ancestor (isolated nodes)
    const reg = registry(emp("alice"), emp("bob"));
    const h = resolveOrgHierarchy(reg);
    // No common ancestor — ancestor will be null → if(ancestor) is false
    const route = buildRoutePath("alice", "bob", h);
    // Should still return a route without crashing
    expect(Array.isArray(route)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// resolveManagerChain — uncovered branch coverage
// ═══════════════════════════════════════════════════════════════

describe("resolveManagerChain — additional branch coverage", () => {
  it("skips node names that are not in hierarchy.nodes (line 118 continue branch)", () => {
    const reg = registry(emp("alice", { rank: "manager" }));
    const h = resolveOrgHierarchy(reg);
    // Pass a route that includes a non-existent name
    const chain = resolveManagerChain(["alice", "nonexistent-node"], h);
    // "nonexistent-node" → node is undefined → continue → not in chain
    expect(chain.every((n) => n.employee.name !== "nonexistent-node")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// findCommonAncestor
// ═══════════════════════════════════════════════════════════════

describe("findCommonAncestor", () => {
  it("returns null for unknown employees", () => {
    const reg = registry(emp("a"));
    const hierarchy = resolveOrgHierarchy(reg);
    expect(findCommonAncestor("x", "y", hierarchy)).toBeNull();
  });

  it("returns the employee itself when both are the same", () => {
    const reg = registry(emp("coo", { rank: "executive" }));
    const hierarchy = resolveOrgHierarchy(reg);
    expect(findCommonAncestor("coo", "coo", hierarchy)).toBe("coo");
  });

  it("finds root as common ancestor for two siblings", () => {
    const reg = registry(
      emp("coo", { rank: "executive" }),
      emp("a", { reportsTo: "coo" }),
      emp("b", { reportsTo: "coo" }),
    );
    const hierarchy = resolveOrgHierarchy(reg);
    expect(findCommonAncestor("a", "b", hierarchy)).toBe("coo");
  });

  it("finds ancestor when one is deeper", () => {
    const reg = registry(
      emp("coo", { rank: "executive" }),
      emp("mgr", { rank: "manager", reportsTo: "coo" }),
      emp("dev", { reportsTo: "mgr" }),
      emp("other", { reportsTo: "coo" }),
    );
    const hierarchy = resolveOrgHierarchy(reg);
    expect(findCommonAncestor("dev", "other", hierarchy)).toBe("coo");
  });

  it("returns parent when one reports to the other", () => {
    const reg = registry(
      emp("coo", { rank: "executive" }),
      emp("mgr", { rank: "manager", reportsTo: "coo" }),
      emp("dev", { reportsTo: "mgr" }),
    );
    const hierarchy = resolveOrgHierarchy(reg);
    expect(findCommonAncestor("dev", "mgr", hierarchy)).toBe("mgr");
  });

  it("returns null when both are root-level with no common ancestor", () => {
    // No executive — both become root nodes
    const reg = registry(emp("a", { department: "eng" }), emp("b", { department: "mkt" }));
    const hierarchy = resolveOrgHierarchy(reg);
    expect(findCommonAncestor("a", "b", hierarchy)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// buildRoutePath
// ═══════════════════════════════════════════════════════════════

describe("buildRoutePath", () => {
  it("returns single-element for same employee", () => {
    const reg = registry(emp("a"));
    const hierarchy = resolveOrgHierarchy(reg);
    expect(buildRoutePath("a", "a", hierarchy)).toEqual(["a"]);
  });

  it("builds path through common ancestor", () => {
    const reg = registry(
      emp("coo", { rank: "executive" }),
      emp("a", { reportsTo: "coo" }),
      emp("b", { reportsTo: "coo" }),
    );
    const hierarchy = resolveOrgHierarchy(reg);
    expect(buildRoutePath("a", "b", hierarchy)).toEqual(["a", "coo", "b"]);
  });

  it("builds path through deeper tree", () => {
    const reg = registry(
      emp("coo", { rank: "executive" }),
      emp("eng-lead", { rank: "manager", department: "eng", reportsTo: "coo" }),
      emp("dev", { department: "eng", reportsTo: "eng-lead" }),
      emp("mkt-lead", { rank: "manager", department: "mkt", reportsTo: "coo" }),
      emp("writer", { department: "mkt", reportsTo: "mkt-lead" }),
    );
    const hierarchy = resolveOrgHierarchy(reg);
    expect(buildRoutePath("dev", "writer", hierarchy)).toEqual(["dev", "eng-lead", "coo", "mkt-lead", "writer"]);
  });

  it("builds direct path when one reports to the other", () => {
    const reg = registry(emp("mgr", { rank: "manager" }), emp("dev", { reportsTo: "mgr" }));
    const hierarchy = resolveOrgHierarchy(reg);
    expect(buildRoutePath("dev", "mgr", hierarchy)).toEqual(["dev", "mgr"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// resolveManagerChain
// ═══════════════════════════════════════════════════════════════

describe("resolveManagerChain", () => {
  it("returns empty for single employee", () => {
    const reg = registry(emp("a"));
    const hierarchy = resolveOrgHierarchy(reg);
    const chain = resolveManagerChain(["a"], hierarchy);
    expect(chain).toEqual([]);
  });

  it("returns managers (employees with direct reports) along the route", () => {
    const reg = registry(
      emp("coo", { rank: "executive" }),
      emp("eng-lead", { rank: "manager", department: "eng", reportsTo: "coo" }),
      emp("dev", { department: "eng", reportsTo: "eng-lead" }),
      emp("mkt-lead", { rank: "manager", department: "mkt", reportsTo: "coo" }),
      emp("writer", { department: "mkt", reportsTo: "mkt-lead" }),
    );
    const hierarchy = resolveOrgHierarchy(reg);
    const route = buildRoutePath("dev", "writer", hierarchy);
    const chain = resolveManagerChain(route, hierarchy);
    const names = chain.map((n) => n.employee.name);
    expect(names).toEqual(["eng-lead", "coo", "mkt-lead"]);
  });

  it("deduplicates managers", () => {
    const reg = registry(emp("coo", { rank: "executive" }), emp("a", { reportsTo: "coo" }));
    const hierarchy = resolveOrgHierarchy(reg);
    // Route goes through coo twice conceptually
    const chain = resolveManagerChain(["a", "coo", "coo", "a"], hierarchy);
    const names = chain.map((n) => n.employee.name);
    expect(names).toEqual(["coo"]);
  });
});
