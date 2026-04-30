import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRequest, sendResponse, TOOLS } from "../gateway-server.js";

describe("gateway-server: MCP プロトコルハンドリング", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-E027-01: initialize
  it("should return MCP initialize response with correct protocolVersion, capabilities, and serverInfo", async () => {
    await handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });

    expect(writeSpy).toHaveBeenCalledOnce();
    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result.protocolVersion).toBe("2024-11-05");
    expect(response.result.capabilities).toEqual({ tools: {} });
    expect(response.result.serverInfo.name).toBe("jinn-gateway");
  });

  // AC-E027-02: tools/list
  it("should return 12 tool definitions with name, description, and inputSchema on tools/list", async () => {
    await handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });

    expect(writeSpy).toHaveBeenCalledOnce();
    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.result.tools).toHaveLength(12);
    for (const tool of response.result.tools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
    }
    expect(response.result.tools.map((t: { name: string }) => t.name)).toEqual(TOOLS.map((t) => t.name));
  });

  // AC-E027-03: tools/call
  it("should return text content response when tools/call succeeds", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "list_employees", arguments: {} },
    });

    expect(writeSpy).toHaveBeenCalledOnce();
    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.result.content[0].type).toBe("text");
    expect(response.result.content).toHaveLength(1);
  });

  // AC-E027-04: notifications/initialized — no response
  it("should not call sendResponse for notifications/initialized", async () => {
    const sendSpy = vi.spyOn({ sendResponse }, "sendResponse");
    await handleRequest({ jsonrpc: "2.0", id: 4, method: "notifications/initialized" });
    expect(writeSpy).not.toHaveBeenCalled();
    sendSpy.mockRestore();
  });

  // AC-E027-05: unknown method → -32601
  it("should return error code -32601 for unknown method", async () => {
    await handleRequest({ jsonrpc: "2.0", id: 5, method: "unknown/method" });

    expect(writeSpy).toHaveBeenCalledOnce();
    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.error.code).toBe(-32601);
  });
});
