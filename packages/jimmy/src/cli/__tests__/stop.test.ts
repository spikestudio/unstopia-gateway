import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../gateway/lifecycle.js", () => ({
  stop: vi.fn(() => true),
}));

import { stop } from "../../gateway/lifecycle.js";
import { runStop } from "../stop.js";

const mockStop = vi.mocked(stop);

describe("runStop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should log 'Gateway stopped.' when stop() returns true (AC-56)", async () => {
    mockStop.mockReturnValue(true);
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStop();

    expect(mockConsoleLog).toHaveBeenCalledWith("Gateway stopped.");

    mockConsoleLog.mockRestore();
  });

  it("should log 'Gateway is not running.' when stop() returns false (AC-57)", async () => {
    mockStop.mockReturnValue(false);
    const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    await runStop();

    expect(mockConsoleLog).toHaveBeenCalledWith("Gateway is not running.");

    mockConsoleLog.mockRestore();
  });
});
