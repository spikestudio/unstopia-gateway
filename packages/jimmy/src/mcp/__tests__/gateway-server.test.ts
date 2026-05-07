import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRequest, handleTool, TOOLS } from "../gateway-server.js";

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
    expect(response.result.serverInfo.name).toBe("unstopia-gateway");
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
    await handleRequest({ jsonrpc: "2.0", id: 4, method: "notifications/initialized" });
    expect(writeSpy).not.toHaveBeenCalled();
  });

  // AC-E027-05: unknown method → -32601
  it("should return error code -32601 for unknown method", async () => {
    await handleRequest({ jsonrpc: "2.0", id: 5, method: "unknown/method" });

    expect(writeSpy).toHaveBeenCalledOnce();
    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.error.code).toBe(-32601);
  });
});

// ── TASK-061: 全12ツールハンドラーテスト ──────────────────────────────────────

describe("gateway-server: ツールハンドラー（全12ツール）", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: "ok" }),
      text: async () => "ok",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-E027-06: send_message
  it("should call POST /api/connectors/{connector}/send for send_message", async () => {
    await handleTool("send_message", { connector: "slack", channel: "#general", text: "hello" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/connectors/slack/send"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  // AC-E027-07: list_sessions (status filter)
  it("should filter sessions by status when status argument is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "s1",
          employee: "alice",
          status: "running",
          engine: "claude",
          source: "slack",
          title: null,
          lastActivity: null,
          lastError: null,
        },
        {
          id: "s2",
          employee: "bob",
          status: "idle",
          engine: "claude",
          source: "slack",
          title: null,
          lastActivity: null,
          lastError: null,
        },
      ],
    });
    const result = await handleTool("list_sessions", { status: "running" });
    const sessions = JSON.parse(result) as Array<{ id: string; status: string }>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("s1");
    expect(sessions[0].status).toBe("running");
  });

  it("should call GET /api/sessions without filter for list_sessions", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await handleTool("list_sessions", {});
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/sessions"));
  });

  // AC-E027-08: get_session
  it("should call GET /api/sessions/{sessionId} for get_session", async () => {
    await handleTool("get_session", { sessionId: "s1" });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/sessions/s1"));
  });

  // AC-E027-09: create_child_session
  it("should call POST /api/sessions for create_child_session", async () => {
    await handleTool("create_child_session", { employee: "alice", prompt: "do something" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sessions"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  // AC-E027-10: send_to_session
  it("should call POST /api/sessions/{sessionId}/message for send_to_session", async () => {
    await handleTool("send_to_session", { sessionId: "s1", message: "hi" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sessions/s1/message"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  // AC-E027-11: list_employees
  it("should call GET /api/org for list_employees", async () => {
    await handleTool("list_employees", {});
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/org"));
  });

  // AC-E027-12: get_employee
  it("should call GET /api/org/employees/{name} for get_employee", async () => {
    await handleTool("get_employee", { name: "alice" });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/org/employees/alice"));
  });

  // AC-E027-13: update_board
  it("should call PUT /api/org/departments/{department}/board for update_board", async () => {
    await handleTool("update_board", { department: "eng", board: [] });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/org/departments/eng/board"),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  // AC-E027-14: get_board
  it("should call GET /api/org/departments/{department}/board for get_board", async () => {
    await handleTool("get_board", { department: "eng" });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/org/departments/eng/board"));
  });

  // AC-E027-15: list_cron_jobs
  it("should call GET /api/cron for list_cron_jobs", async () => {
    await handleTool("list_cron_jobs", {});
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/cron"));
  });

  // AC-E027-16: trigger_cron_job
  it("should return triggered: true for trigger_cron_job when job is found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: "job-1", name: "my-job" }],
      text: async () => "ok",
    });
    const result = await handleTool("trigger_cron_job", { jobId: "job-1" });
    expect(JSON.parse(result)).toMatchObject({ triggered: true });
  });

  // AC-E027-17: update_cron_job
  it("should call PUT /api/cron/{jobId} for update_cron_job", async () => {
    await handleTool("update_cron_job", { jobId: "job-1", enabled: true });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/cron/job-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

// ── TASK-062: エラーハンドリングテスト ───────────────────────────────────────

describe("gateway-server: エラーハンドリング", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-E027-34: 未知ツール名 → isError: true
  it("should return isError: true for unknown tool name", async () => {
    await handleRequest({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "nonexistent_tool", arguments: {} },
    });

    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Error:");
  });

  // AC-E027-35: ハンドラーが例外スロー → isError: true + メッセージ
  it("should return isError: true when tool handler throws an exception", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));

    await handleRequest({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "list_employees", arguments: {} },
    });

    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("network error");
  });

  // AC-E027-36: API 非 2xx → isError: true
  it("should return isError: true when API returns non-2xx status", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "server error",
    });

    await handleRequest({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: { name: "list_employees", arguments: {} },
    });

    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].type).toBe("text");
  });

  // AC-E027-37: trigger_cron_job でジョブが見つからない → error メッセージ
  it("should return error message when trigger_cron_job job not found", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await handleRequest({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: { name: "trigger_cron_job", arguments: { jobId: "nonexistent" } },
    });

    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    const text = response.result.content[0].text as string;
    expect(text).toContain("not found");
  });

  // Branch coverage: handleRequest throws non-Error object → String(err) path
  it("should return error with String(err) when thrown value is not an Error instance", async () => {
    // handleTool is called internally — mock fetch to throw a non-Error string
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue("string-rejection");

    await handleRequest({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: { name: "list_employees", arguments: {} },
    });

    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    // isError: true and content contains the stringified error
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("string-rejection");
  });

  // Branch coverage: unknown method → default case returns -32601 error
  it("should return method not found error for unknown method", async () => {
    await handleRequest({
      jsonrpc: "2.0",
      id: 100,
      method: "unknown/method",
      params: {},
    });

    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(-32601);
  });

  // Branch: handleTool for apiPut (err.ok branch) via update_budget
  it("should return ok response when update_budget succeeds", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await handleRequest({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: { name: "update_budget", arguments: { employee: "alice", monthlyLimit: 100 } },
    });

    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.result.content[0].type).toBe("text");
  });

  // Branch: apiPut with !res.ok → throws error
  it("should return isError when update_budget fetch returns not-ok", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "internal error",
    });

    await handleRequest({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: { name: "update_budget", arguments: { employee: "alice", monthlyLimit: 100 } },
    });

    const response = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(response.result.isError).toBe(true);
  });
});
