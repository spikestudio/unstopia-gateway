import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createGoal, deleteGoal, getGoal, getGoalTree, listGoals, updateGoal } from "../goals.js";

/** Create an in-memory SQLite DB with the goals schema for isolated tests. */
function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      level TEXT NOT NULL DEFAULT 'company',
      parent_id TEXT,
      department TEXT,
      owner TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES goals(id)
    )
  `);
  return db;
}

describe("AC-E003-04: listGoals", () => {
  it("returns empty array when no goals exist", () => {
    const db = makeDb();
    expect(listGoals(db)).toEqual([]);
  });

  it("returns all goals ordered by created_at DESC", () => {
    const db = makeDb();
    createGoal(db, { title: "Goal A" });
    createGoal(db, { title: "Goal B" });
    const goals = listGoals(db);
    expect(goals.length).toBe(2);
    // All returned goals should have required fields
    for (const g of goals) {
      expect(g.id).toBeTruthy();
      expect(g.title).toBeTruthy();
    }
  });
});

describe("AC-E003-04: getGoal", () => {
  it("returns null for non-existent id", () => {
    const db = makeDb();
    expect(getGoal(db, "nonexistent")).toBeNull();
  });

  it("returns the goal when it exists", () => {
    const db = makeDb();
    const created = createGoal(db, { title: "Test Goal", description: "desc", status: "in_progress" });
    const found = getGoal(db, created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.title).toBe("Test Goal");
    expect(found?.description).toBe("desc");
    expect(found?.status).toBe("in_progress");
  });
});

describe("AC-E003-04: createGoal", () => {
  it("creates a goal with default values when minimal data provided", () => {
    const db = makeDb();
    const goal = createGoal(db, { title: "Minimal Goal" });
    expect(goal.id).toBeTruthy();
    expect(goal.title).toBe("Minimal Goal");
    expect(goal.status).toBe("not_started");
    expect(goal.level).toBe("company");
    expect(goal.progress).toBe(0);
    expect(goal.description).toBeNull();
    expect(goal.parentId).toBeNull();
    expect(goal.department).toBeNull();
    expect(goal.owner).toBeNull();
  });

  it("creates a goal with explicit values", () => {
    const db = makeDb();
    const goal = createGoal(db, {
      title: "Explicit Goal",
      description: "A description",
      status: "in_progress",
      level: "department",
      department: "Engineering",
      owner: "alice",
      progress: 42,
    });
    expect(goal.title).toBe("Explicit Goal");
    expect(goal.description).toBe("A description");
    expect(goal.status).toBe("in_progress");
    expect(goal.level).toBe("department");
    expect(goal.department).toBe("Engineering");
    expect(goal.owner).toBe("alice");
    expect(goal.progress).toBe(42);
  });

  it("falls back to 'Untitled' when title is not provided", () => {
    const db = makeDb();
    const goal = createGoal(db, {});
    expect(goal.title).toBe("Untitled");
  });

  it("creates a child goal with parentId", () => {
    const db = makeDb();
    const parent = createGoal(db, { title: "Parent" });
    const child = createGoal(db, { title: "Child", parentId: parent.id });
    expect(child.parentId).toBe(parent.id);
  });
});

describe("AC-E003-04: updateGoal", () => {
  it("returns null when goal does not exist", () => {
    const db = makeDb();
    const result = updateGoal(db, "nonexistent", { title: "New Title" });
    expect(result).toBeNull();
  });

  it("updates specific fields and leaves others unchanged", () => {
    const db = makeDb();
    const goal = createGoal(db, { title: "Original", status: "not_started", progress: 0 });
    const updated = updateGoal(db, goal.id, { title: "Updated", progress: 75 });
    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Updated");
    expect(updated?.progress).toBe(75);
    expect(updated?.status).toBe("not_started"); // unchanged
  });

  it("updates status to in_progress", () => {
    const db = makeDb();
    const goal = createGoal(db, { title: "Task", status: "not_started" });
    const updated = updateGoal(db, goal.id, { status: "in_progress" });
    expect(updated?.status).toBe("in_progress");
  });

  it("updates status to completed", () => {
    const db = makeDb();
    const goal = createGoal(db, { title: "Done", status: "in_progress" });
    const updated = updateGoal(db, goal.id, { status: "completed" });
    expect(updated?.status).toBe("completed");
  });

  it("updates status to at_risk", () => {
    const db = makeDb();
    const goal = createGoal(db, { title: "Risky", status: "in_progress" });
    const updated = updateGoal(db, goal.id, { status: "at_risk" });
    expect(updated?.status).toBe("at_risk");
  });
});

describe("AC-E003-04: deleteGoal", () => {
  it("deletes a goal with no children", () => {
    const db = makeDb();
    const goal = createGoal(db, { title: "To Delete" });
    deleteGoal(db, goal.id);
    expect(getGoal(db, goal.id)).toBeNull();
  });

  it("deletes a goal and its children recursively", () => {
    const db = makeDb();
    const parent = createGoal(db, { title: "Parent" });
    const child1 = createGoal(db, { title: "Child 1", parentId: parent.id });
    const child2 = createGoal(db, { title: "Child 2", parentId: parent.id });
    const grandchild = createGoal(db, { title: "Grandchild", parentId: child1.id });

    deleteGoal(db, parent.id);

    expect(getGoal(db, parent.id)).toBeNull();
    expect(getGoal(db, child1.id)).toBeNull();
    expect(getGoal(db, child2.id)).toBeNull();
    expect(getGoal(db, grandchild.id)).toBeNull();
  });

  it("does nothing when goal does not exist", () => {
    const db = makeDb();
    // Should not throw
    expect(() => deleteGoal(db, "nonexistent")).not.toThrow();
  });
});

describe("AC-E003-04: getGoalTree", () => {
  it("returns empty array when no goals exist", () => {
    const db = makeDb();
    expect(getGoalTree(db)).toEqual([]);
  });

  it("returns root goals with no parentId as roots", () => {
    const db = makeDb();
    createGoal(db, { title: "Root A" });
    createGoal(db, { title: "Root B" });
    const tree = getGoalTree(db);
    expect(tree.length).toBe(2);
    for (const node of tree) {
      expect(node.children).toBeDefined();
      expect(Array.isArray(node.children)).toBe(true);
    }
  });

  it("attaches children to parent in tree structure", () => {
    const db = makeDb();
    const parent = createGoal(db, { title: "Parent" });
    createGoal(db, { title: "Child A", parentId: parent.id });
    createGoal(db, { title: "Child B", parentId: parent.id });

    const tree = getGoalTree(db);
    const root = tree.find((n) => n.id === parent.id);
    expect(root).toBeDefined();
    expect(root?.children.length).toBe(2);
    const childTitles = root?.children.map((c) => c.title) ?? [];
    expect(childTitles).toContain("Child A");
    expect(childTitles).toContain("Child B");
  });

  it("returns goals with children array on each node", () => {
    const db = makeDb();
    const root = createGoal(db, { title: "Root" });
    createGoal(db, { title: "Child", parentId: root.id });
    const tree = getGoalTree(db);
    for (const node of tree) {
      expect(Array.isArray(node.children)).toBe(true);
    }
  });
});
