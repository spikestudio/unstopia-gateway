import { describe, expect, it } from "vitest";
import { appError, repositoryError } from "../errors.js";

describe("appError", () => {
  it("creates error without cause when cause is undefined", () => {
    const err = appError("ERR_001", "something went wrong");
    expect(err.code).toBe("ERR_001");
    expect(err.message).toBe("something went wrong");
    expect("cause" in err).toBe(false);
  });

  it("creates error with cause when cause is provided", () => {
    const original = new Error("root cause");
    const err = appError("ERR_002", "wrapped error", original);
    expect(err.code).toBe("ERR_002");
    expect(err.message).toBe("wrapped error");
    expect(err.cause).toBe(original);
  });

  it("includes cause when cause is null (null is not undefined)", () => {
    const err = appError("ERR_003", "null cause", null);
    expect(err.cause).toBeNull();
  });

  it("includes cause when cause is 0 (0 is not undefined)", () => {
    const err = appError("ERR_004", "zero cause", 0);
    expect(err.cause).toBe(0);
  });
});

describe("repositoryError", () => {
  it("creates NOT_FOUND error without cause", () => {
    const err = repositoryError("NOT_FOUND", "record not found");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("record not found");
    expect("cause" in err).toBe(false);
  });

  it("creates CONSTRAINT_VIOLATION error with cause", () => {
    const original = new Error("unique constraint");
    const err = repositoryError("CONSTRAINT_VIOLATION", "duplicate entry", original);
    expect(err.code).toBe("CONSTRAINT_VIOLATION");
    expect(err.cause).toBe(original);
  });

  it("creates UNKNOWN error", () => {
    const err = repositoryError("UNKNOWN", "unexpected error");
    expect(err.code).toBe("UNKNOWN");
  });
});
