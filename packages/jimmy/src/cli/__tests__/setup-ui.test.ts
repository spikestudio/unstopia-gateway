import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock readline before importing the module under test
vi.mock("node:readline", () => ({
  default: {
    createInterface: vi.fn(),
  },
}));

import readline from "node:readline";
import { fail, info, ok, prompt, warn } from "../setup-ui.js";

const mockCreateInterface = vi.mocked(readline.createInterface);

describe("ok", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log a message with [ok] prefix in green", () => {
    ok("everything is fine");

    expect(console.log).toHaveBeenCalledOnce();
    const message = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(message).toContain("[ok]");
    expect(message).toContain("everything is fine");
  });
});

describe("warn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log a message with [warn] prefix in yellow", () => {
    warn("something is off");

    expect(console.log).toHaveBeenCalledOnce();
    const message = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(message).toContain("[warn]");
    expect(message).toContain("something is off");
  });
});

describe("fail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log a message with [missing] prefix in red", () => {
    fail("required binary missing");

    expect(console.log).toHaveBeenCalledOnce();
    const message = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(message).toContain("[missing]");
    expect(message).toContain("required binary missing");
  });
});

describe("info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log a dimmed message", () => {
    info("additional context");

    expect(console.log).toHaveBeenCalledOnce();
    const message = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(message).toContain("additional context");
  });
});

describe("prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve with the user input when an answer is provided", async () => {
    const mockRl = {
      question: vi.fn((_q: string, cb: (a: string) => void) => cb("user answer")),
      close: vi.fn(),
    };
    mockCreateInterface.mockReturnValue(mockRl as unknown as ReturnType<typeof readline.createInterface>);

    const result = await prompt("What is your name?");

    expect(result).toBe("user answer");
    expect(mockRl.close).toHaveBeenCalled();
  });

  it("should resolve with defaultValue when the answer is empty and defaultValue is provided", async () => {
    const mockRl = {
      question: vi.fn((_q: string, cb: (a: string) => void) => cb("")),
      close: vi.fn(),
    };
    mockCreateInterface.mockReturnValue(mockRl as unknown as ReturnType<typeof readline.createInterface>);

    const result = await prompt("What is your name?", "default-name");

    expect(result).toBe("default-name");
  });

  it("should resolve with empty string when the answer is empty and no defaultValue is provided", async () => {
    const mockRl = {
      question: vi.fn((_q: string, cb: (a: string) => void) => cb("")),
      close: vi.fn(),
    };
    mockCreateInterface.mockReturnValue(mockRl as unknown as ReturnType<typeof readline.createInterface>);

    const result = await prompt("What is your name?");

    expect(result).toBe("");
  });

  it("should include default value hint in the question when defaultValue is provided", async () => {
    const mockRl = {
      question: vi.fn((_q: string, cb: (a: string) => void) => cb("input")),
      close: vi.fn(),
    };
    mockCreateInterface.mockReturnValue(mockRl as unknown as ReturnType<typeof readline.createInterface>);

    await prompt("Enter name", "mydefault");

    const questionArg = mockRl.question.mock.calls[0][0] as string;
    expect(questionArg).toContain("mydefault");
  });
});
