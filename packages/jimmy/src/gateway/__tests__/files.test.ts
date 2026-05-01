import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeContext, makeReq, makeRes } from "./http-test-helpers.js";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { fsMock, mockSpawn, mockInsertFile, mockGetFile, mockListFiles, mockDeleteFile, mockBusboy, mockBusboyInstance } = vi.hoisted(() => {
  const { EventEmitter } = require("node:events");

  const fsMock = {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmSync: vi.fn(),
    createReadStream: vi.fn(),
  };
  const mockSpawn = vi.fn().mockReturnValue({ unref: vi.fn() });
  const mockInsertFile = vi.fn();
  const mockGetFile = vi.fn();
  const mockListFiles = vi.fn();
  const mockDeleteFile = vi.fn();

  // Shared busboy instance that tests can interact with
  const mockBusboyInstance = new EventEmitter();
  (mockBusboyInstance as EventEmitter & { pipe?: ReturnType<typeof vi.fn> }).pipe = vi.fn();

  const mockBusboy = vi.fn(() => mockBusboyInstance);

  return { fsMock, mockSpawn, mockInsertFile, mockGetFile, mockListFiles, mockDeleteFile, mockBusboy, mockBusboyInstance };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  FILES_DIR: "/fake/files",
}));

vi.mock("../../sessions/registry.js", () => ({
  insertFile: mockInsertFile,
  getFile: mockGetFile,
  listFiles: mockListFiles,
  deleteFile: mockDeleteFile,
}));

vi.mock("node:fs", () => ({
  default: fsMock,
}));

vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
  execSync: vi.fn(),
  fork: vi.fn(),
}));

vi.mock("busboy", () => ({
  default: mockBusboy,
}));

import { handleFilesRequest } from "../files.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const sampleMeta = {
  id: "file-id-1",
  filename: "test.txt",
  size: 100,
  mimetype: "text/plain",
  path: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/files ────────────────────────────────────────────────────────────

describe("GET /api/files", () => {
  it("should return list of files", async () => {
    mockListFiles.mockReturnValue([sampleMeta]);
    const { res, written } = makeRes();
    const req = makeReq();

    const handled = await handleFilesRequest(req, res, "/api/files", "GET", makeContext());

    expect(handled).toBe(true);
    const { status, body } = written();
    expect(status).toBe(200);
    expect(body).toEqual([sampleMeta]);
  });
});

// ── GET /api/files/:id/meta ───────────────────────────────────────────────────

describe("GET /api/files/:id/meta", () => {
  it("should return file metadata when file exists", async () => {
    mockGetFile.mockReturnValue(sampleMeta);
    const { res, written } = makeRes();
    const req = makeReq();

    const handled = await handleFilesRequest(req, res, "/api/files/file-id-1/meta", "GET", makeContext());

    expect(handled).toBe(true);
    const { status, body } = written();
    expect(status).toBe(200);
    expect(body).toEqual(sampleMeta);
  });

  it("should return 404 when file metadata not found", async () => {
    mockGetFile.mockReturnValue(null);
    const { res, written } = makeRes();
    const req = makeReq();

    const handled = await handleFilesRequest(req, res, "/api/files/unknown/meta", "GET", makeContext());

    expect(handled).toBe(true);
    expect(written().status).toBe(404);
  });
});

// ── GET /api/files/:id (download) ─────────────────────────────────────────────

describe("GET /api/files/:id (download)", () => {
  it("should return 404 when file not in DB", async () => {
    mockGetFile.mockReturnValue(null);
    const { res, written } = makeRes();
    const req = makeReq();

    const handled = await handleFilesRequest(req, res, "/api/files/unknown-id", "GET", makeContext());

    expect(handled).toBe(true);
    expect(written().status).toBe(404);
  });

  it("should return 404 when file is in DB but not on disk", async () => {
    mockGetFile.mockReturnValue(sampleMeta);
    fsMock.existsSync.mockReturnValue(false);
    const { res, written } = makeRes();
    const req = makeReq();

    const handled = await handleFilesRequest(req, res, "/api/files/file-id-1", "GET", makeContext());

    expect(handled).toBe(true);
    expect(written().status).toBe(404);
  });

  it("should stream file when file exists on disk", async () => {
    mockGetFile.mockReturnValue(sampleMeta);
    fsMock.existsSync.mockReturnValue(true);
    fsMock.statSync.mockReturnValue({ size: 100 });

    const fakeStream = new EventEmitter() as EventEmitter & { pipe: ReturnType<typeof vi.fn> };
    fakeStream.pipe = vi.fn();
    fsMock.createReadStream.mockReturnValue(fakeStream);

    const resMock = {
      writeHead: vi.fn(),
      end: vi.fn(),
      pipe: vi.fn(),
    };

    const req = makeReq();

    const handled = await handleFilesRequest(
      req,
      resMock as never,
      "/api/files/file-id-1",
      "GET",
      makeContext(),
    );

    expect(handled).toBe(true);
    expect(resMock.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ "Content-Type": "text/plain" }),
    );
    expect(fakeStream.pipe).toHaveBeenCalledWith(resMock);
  });
});

// ── DELETE /api/files/:id ─────────────────────────────────────────────────────

describe("DELETE /api/files/:id", () => {
  it("should return 404 when file not found", async () => {
    mockGetFile.mockReturnValue(null);
    const { res, written } = makeRes();
    const req = makeReq();

    const handled = await handleFilesRequest(req, res, "/api/files/unknown-id", "DELETE", makeContext());

    expect(handled).toBe(true);
    expect(written().status).toBe(404);
  });

  it("should delete file from disk and DB and return status:deleted", async () => {
    mockGetFile.mockReturnValue(sampleMeta);
    fsMock.existsSync.mockReturnValue(true);
    mockDeleteFile.mockReturnValue(undefined);
    const { res, written } = makeRes();
    const req = makeReq();
    const ctx = makeContext();

    const handled = await handleFilesRequest(req, res, "/api/files/file-id-1", "DELETE", ctx);

    expect(handled).toBe(true);
    expect(fsMock.rmSync).toHaveBeenCalled();
    expect(mockDeleteFile).toHaveBeenCalledWith("file-id-1");
    const { status, body } = written();
    expect(status).toBe(200);
    expect((body as Record<string, string>).status).toBe("deleted");
  });

  it("should skip rmSync when file directory does not exist", async () => {
    mockGetFile.mockReturnValue(sampleMeta);
    fsMock.existsSync.mockReturnValue(false);
    mockDeleteFile.mockReturnValue(undefined);
    const { res } = makeRes();
    const req = makeReq();

    await handleFilesRequest(req, res, "/api/files/file-id-1", "DELETE", makeContext());

    expect(fsMock.rmSync).not.toHaveBeenCalled();
  });
});

// ── POST /api/files (JSON upload) ─────────────────────────────────────────────

describe("POST /api/files (JSON upload)", () => {
  beforeEach(() => {
    mockInsertFile.mockReturnValue(sampleMeta);
    fsMock.mkdirSync.mockReturnValue(undefined);
    fsMock.writeFileSync.mockReturnValue(undefined);
  });

  function makeJsonReq(body: string) {
    const req = makeReq(body);
    Object.defineProperty(req, "headers", {
      value: { "content-type": "application/json" },
      writable: true,
      configurable: true,
    });
    return req;
  }

  it("should return 400 for invalid JSON body", async () => {
    const req = makeJsonReq("not-json");
    const { res, written } = makeRes();

    const handled = await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(handled).toBe(true);
    expect(written().status).toBe(400);
  });

  it("should return 400 when filename is missing", async () => {
    const req = makeJsonReq(JSON.stringify({ content: "aGVsbG8=" }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(400);
  });

  it("should return 400 when both content and url are provided", async () => {
    const req = makeJsonReq(JSON.stringify({ filename: "test.txt", content: "aGVsbG8=", url: "http://example.com/f" }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(400);
  });

  it("should return 400 when neither content nor url are provided", async () => {
    const req = makeJsonReq(JSON.stringify({ filename: "test.txt" }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(400);
  });

  it("should upload file from base64 content and return 201", async () => {
    const req = makeJsonReq(
      JSON.stringify({ filename: "hello.txt", content: Buffer.from("hello").toString("base64") }),
    );
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(201);
  });

  it("should write to custom path when path field is provided", async () => {
    const req = makeJsonReq(
      JSON.stringify({
        filename: "hello.txt",
        content: Buffer.from("hello").toString("base64"),
        path: "/tmp/custom/hello.txt",
      }),
    );
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(201);
    // Two writeFileSync calls: managed storage + custom path
    expect(fsMock.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it("should spawn 'open' when open flag is true", async () => {
    const req = makeJsonReq(
      JSON.stringify({
        filename: "hello.txt",
        content: Buffer.from("hello").toString("base64"),
        open: true,
      }),
    );
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(201);
    expect(mockSpawn).toHaveBeenCalledWith("open", expect.any(Array), expect.any(Object));
  });

  it("should return 500 when saveFile throws", async () => {
    fsMock.mkdirSync.mockImplementation(() => {
      throw new Error("disk full");
    });
    const req = makeJsonReq(
      JSON.stringify({ filename: "hello.txt", content: Buffer.from("hello").toString("base64") }),
    );
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(500);
  });

  it("should return 500 when URL fetch fails (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    const req = makeJsonReq(JSON.stringify({ filename: "remote.txt", url: "http://example.com/file.txt" }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(500);
  });

  it("should return 500 when URL fetch returns non-ok status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const req = makeJsonReq(JSON.stringify({ filename: "remote.txt", url: "http://example.com/file.txt" }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(500);
  });

  it("should upload file from URL when fetch succeeds", async () => {
    const arrayBuf = new TextEncoder().encode("fetched content").buffer;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(arrayBuf),
    });

    const req = makeJsonReq(JSON.stringify({ filename: "remote.txt", url: "http://example.com/file.txt" }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    expect(written().status).toBe(201);
  });
});

// ── POST /api/files/transfer ──────────────────────────────────────────────────

describe("POST /api/files/transfer", () => {
  function makeTransferReq(body: string) {
    const req = makeReq(body);
    Object.defineProperty(req, "headers", {
      value: { "content-type": "application/json" },
      writable: true,
      configurable: true,
    });
    return req;
  }

  it("should return 400 for invalid JSON body", async () => {
    const req = makeTransferReq("not-json");
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", makeContext());

    expect(written().status).toBe(400);
  });

  it("should return 400 when destination is missing", async () => {
    const req = makeTransferReq(JSON.stringify({ file: "/tmp/test.txt" }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", makeContext());

    expect(written().status).toBe(400);
  });

  it("should return 400 when file and files are both missing", async () => {
    const req = makeTransferReq(JSON.stringify({ destination: "http://remote:7777" }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", makeContext());

    expect(written().status).toBe(400);
  });

  it("should return 400 when files array is empty", async () => {
    const req = makeTransferReq(JSON.stringify({ destination: "http://remote:7777", files: [] }));
    const { res, written } = makeRes();

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", makeContext());

    expect(written().status).toBe(400);
  });

  it("should return 400 for unknown remote name", async () => {
    const req = makeTransferReq(JSON.stringify({ destination: "unknown-remote", file: "/tmp/test.txt" }));
    const { res, written } = makeRes();
    const ctx = makeContext({ getConfig: vi.fn().mockReturnValue({ remotes: {} }) });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    expect(written().status).toBe(400);
  });

  it("should return 403 when destination URL is not in remotes whitelist", async () => {
    const req = makeTransferReq(JSON.stringify({ destination: "http://not-allowed:7777", file: "/tmp/test.txt" }));
    const { res, written } = makeRes();
    const ctx = makeContext({ getConfig: vi.fn().mockReturnValue({}) });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    expect(written().status).toBe(403);
  });

  it("should transfer file and return results when destination is in whitelist", async () => {
    const remoteUrl = "http://remote:7777";
    fsMock.existsSync.mockReturnValue(true);
    fsMock.statSync.mockReturnValue({ size: 10 });
    fsMock.readFileSync.mockReturnValue(Buffer.from("content"));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "remote-file-id" }),
    });

    const req = makeTransferReq(JSON.stringify({ destination: remoteUrl, file: "/tmp/test.txt" }));
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { myremote: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { ok: number } }).summary.ok).toBe(1);
  });

  it("should handle transfer error when remote file fetch fails (HTTP error)", async () => {
    const remoteUrl = "http://remote:7777";
    fsMock.existsSync.mockReturnValue(true);
    fsMock.statSync.mockReturnValue({ size: 10 });
    fsMock.readFileSync.mockReturnValue(Buffer.from("content"));

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Server error"),
    });

    const req = makeTransferReq(JSON.stringify({ destination: remoteUrl, file: "/tmp/test.txt" }));
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { myremote: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { failed: number } }).summary.failed).toBe(1);
  });

  it("should handle transfer error when resolveFileSpec throws (file not found)", async () => {
    const remoteUrl = "http://remote:7777";
    fsMock.existsSync.mockReturnValue(false);
    mockGetFile.mockReturnValue(null);

    const req = makeTransferReq(JSON.stringify({ destination: remoteUrl, file: "/nonexistent/path.txt" }));
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { myremote: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { failed: number } }).summary.failed).toBe(1);
  });

  it("should use files array when provided", async () => {
    const remoteUrl = "http://remote:7777";
    fsMock.existsSync.mockReturnValue(true);
    fsMock.statSync.mockReturnValue({ size: 10 });
    fsMock.readFileSync.mockReturnValue(Buffer.from("content"));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "remote-id" }),
    });

    const req = makeTransferReq(
      JSON.stringify({
        destination: remoteUrl,
        files: [{ file: "/tmp/a.txt" }, { file: "/tmp/b.txt" }],
      }),
    );
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { myremote: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { total: number } }).summary.total).toBe(2);
  });

  it("should handle file exceeding transfer size limit", async () => {
    const remoteUrl = "http://remote:7777";
    fsMock.existsSync.mockReturnValue(true);
    fsMock.statSync.mockReturnValue({ size: 51 * 1024 * 1024 }); // 51 MB

    const req = makeTransferReq(JSON.stringify({ destination: remoteUrl, file: "/tmp/bigfile.bin" }));
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { myremote: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { failed: number } }).summary.failed).toBe(1);
  });
});

// ── Unhandled routes ──────────────────────────────────────────────────────────

describe("unhandled routes", () => {
  it("should return false for unknown method/path combinations", async () => {
    const req = makeReq();
    const { res } = makeRes();

    const handled = await handleFilesRequest(req, res, "/api/other", "GET", makeContext());

    expect(handled).toBe(false);
  });

  it("should return false for PATCH /api/files", async () => {
    const req = makeReq();
    const { res } = makeRes();

    const handled = await handleFilesRequest(req, res, "/api/files", "PATCH", makeContext());

    expect(handled).toBe(false);
  });
});

// ── resolveDestination — remote name lookup branch (line 338) ─────────────────

describe("POST /api/files/transfer — resolveDestination remote name lookup", () => {
  it("should resolve a named remote from config and transfer successfully", async () => {
    const remoteUrl = "http://named-remote:7777";
    fsMock.existsSync.mockReturnValue(true);
    fsMock.statSync.mockReturnValue({ size: 10 });
    fsMock.readFileSync.mockReturnValue(Buffer.from("content"));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "remote-id" }),
    });

    // Use remote name (not URL) as destination
    const req = makeReq(JSON.stringify({ destination: "myremote", file: "/tmp/test.txt" }));
    Object.defineProperty(req, "headers", {
      value: { "content-type": "application/json" },
      writable: true,
      configurable: true,
    });
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({
        remotes: { myremote: { url: remoteUrl } },
      }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { ok: number } }).summary.ok).toBe(1);
  });

  it("should resolve HTTPS URL directly without config lookup", async () => {
    const remoteUrl = "https://secure-remote:7777/";
    fsMock.existsSync.mockReturnValue(true);
    fsMock.statSync.mockReturnValue({ size: 5 });
    fsMock.readFileSync.mockReturnValue(Buffer.from("data"));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "secure-id" }),
    });

    const req = makeReq(JSON.stringify({ destination: remoteUrl, file: "/tmp/test.txt" }));
    Object.defineProperty(req, "headers", {
      value: { "content-type": "application/json" },
      writable: true,
      configurable: true,
    });
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({
        remotes: { myremote: { url: "https://secure-remote:7777" } },
      }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { ok: number } }).summary.ok).toBe(1);
  });
});

// ── resolveFileSpec — managed file ID branch (lines 307-321) ─────────────────

describe("POST /api/files/transfer — resolveFileSpec managed file ID", () => {
  it("should resolve file by managed file ID when path does not exist", async () => {
    const remoteUrl = "http://remote:7777";
    const managedMeta = { id: "managed-id-1", filename: "managed.txt", mimetype: "text/plain", path: null };

    // First existsSync: path expansion fails, so treat as file ID
    fsMock.existsSync
      .mockReturnValueOnce(false)  // spec.file path doesn't exist
      .mockReturnValueOnce(true)   // managed filePath on disk exists
    ;
    fsMock.statSync.mockReturnValue({ size: 20 });
    fsMock.readFileSync.mockReturnValue(Buffer.from("managed content"));
    mockGetFile.mockReturnValue(managedMeta);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "remote-managed-id" }),
    });

    const req = makeReq(JSON.stringify({ destination: remoteUrl, file: "managed-id-1" }));
    Object.defineProperty(req, "headers", {
      value: { "content-type": "application/json" },
      writable: true,
      configurable: true,
    });
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { r: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { ok: number } }).summary.ok).toBe(1);
  });

  it("should error when managed file is in DB but not on disk", async () => {
    const remoteUrl = "http://remote:7777";
    const managedMeta = { id: "managed-id-2", filename: "missing.txt", mimetype: "text/plain", path: null };

    fsMock.existsSync
      .mockReturnValueOnce(false)  // spec.file path doesn't exist
      .mockReturnValueOnce(false)  // managed filePath also doesn't exist on disk
    ;
    mockGetFile.mockReturnValue(managedMeta);

    const req = makeReq(JSON.stringify({ destination: remoteUrl, file: "managed-id-2" }));
    Object.defineProperty(req, "headers", {
      value: { "content-type": "application/json" },
      writable: true,
      configurable: true,
    });
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { r: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { failed: number } }).summary.failed).toBe(1);
  });

  it("should error when managed file exceeds 50 MB limit", async () => {
    const remoteUrl = "http://remote:7777";
    const managedMeta = { id: "managed-id-3", filename: "huge.bin", mimetype: "application/octet-stream", path: null };

    fsMock.existsSync
      .mockReturnValueOnce(false)  // spec.file path doesn't exist
      .mockReturnValueOnce(true)   // managed filePath exists
    ;
    fsMock.statSync.mockReturnValue({ size: 52 * 1024 * 1024 }); // 52 MB
    mockGetFile.mockReturnValue(managedMeta);

    const req = makeReq(JSON.stringify({ destination: remoteUrl, file: "managed-id-3" }));
    Object.defineProperty(req, "headers", {
      value: { "content-type": "application/json" },
      writable: true,
      configurable: true,
    });
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { r: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { failed: number } }).summary.failed).toBe(1);
  });
});

// ── expandPath — home directory expansion ─────────────────────────────────────

describe("POST /api/files/transfer — expandPath tilde expansion", () => {
  it("should expand ~/path when file spec starts with ~/", async () => {
    const remoteUrl = "http://remote:7777";

    // The expanded path (after ~ replacement) should be found
    fsMock.existsSync.mockReturnValue(true);
    fsMock.statSync.mockReturnValue({ size: 5 });
    fsMock.readFileSync.mockReturnValue(Buffer.from("home content"));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "tilde-id" }),
    });

    const req = makeReq(JSON.stringify({ destination: remoteUrl, file: "~/Documents/test.txt" }));
    Object.defineProperty(req, "headers", {
      value: { "content-type": "application/json" },
      writable: true,
      configurable: true,
    });
    const { res, written } = makeRes();
    const ctx = makeContext({
      getConfig: vi.fn().mockReturnValue({ remotes: { r: { url: remoteUrl } } }),
    });

    await handleFilesRequest(req, res, "/api/files/transfer", "POST", ctx);

    const { body } = written();
    expect((body as { summary: { ok: number } }).summary.ok).toBe(1);
  });
});

// ── POST /api/files (multipart upload) ───────────────────────────────────────

describe("POST /api/files (multipart upload)", () => {
  beforeEach(() => {
    mockInsertFile.mockReturnValue(sampleMeta);
    fsMock.mkdirSync.mockReturnValue(undefined);
    fsMock.writeFileSync.mockReturnValue(undefined);
    vi.clearAllMocks();
    mockInsertFile.mockReturnValue(sampleMeta);
  });

  function makeMultipartReq() {
    const req = makeReq();
    Object.defineProperty(req, "headers", {
      value: { "content-type": "multipart/form-data; boundary=----boundary" },
      writable: true,
      configurable: true,
    });
    // Override pipe to a no-op so busboy events are controlled manually in tests
    Object.defineProperty(req, "pipe", {
      value: vi.fn((dest: EventEmitter) => dest),
      writable: true,
      configurable: true,
    });
    return req;
  }

  it("should return 201 when a valid file is uploaded via multipart", async () => {
    mockInsertFile.mockReturnValue(sampleMeta);

    const req = makeMultipartReq();
    const { res, written } = makeRes();
    const ctx = makeContext();

    const promise = handleFilesRequest(req, res, "/api/files", "POST", ctx);

    // Simulate busboy events
    const fileEmitter = new EventEmitter();
    mockBusboyInstance.emit("file", "file", fileEmitter, { filename: "upload.txt" });
    fileEmitter.emit("data", Buffer.from("hello"));
    fileEmitter.emit("end");
    mockBusboyInstance.emit("finish");

    await promise;

    expect(written().status).toBe(201);
  });

  it("should return 400 when no file is provided", async () => {
    const req = makeMultipartReq();
    const { res, written } = makeRes();

    const promise = handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    // No file event — just finish
    mockBusboyInstance.emit("finish");

    await promise;

    expect(written().status).toBe(400);
  });

  it("should return 400 when file is truncated (exceeds size limit)", async () => {
    const req = makeMultipartReq();
    const { res, written } = makeRes();

    const promise = handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    // Simulate file event with limit triggered
    const fileEmitter = new EventEmitter();
    mockBusboyInstance.emit("file", "file", fileEmitter, { filename: "huge.bin" });
    fileEmitter.emit("limit");
    fileEmitter.emit("end");
    mockBusboyInstance.emit("finish");

    await promise;

    expect(written().status).toBe(400);
  });

  it("should handle busboy error event", async () => {
    const req = makeMultipartReq();
    const { res, written } = makeRes();

    const promise = handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    mockBusboyInstance.emit("error", new Error("busboy parse error"));

    await promise;

    expect(written().status).toBe(500);
  });

  it("should process path and open fields from multipart", async () => {
    mockInsertFile.mockReturnValue(sampleMeta);

    const req = makeMultipartReq();
    const { res, written } = makeRes();
    const ctx = makeContext();

    const promise = handleFilesRequest(req, res, "/api/files", "POST", ctx);

    const fileEmitter = new EventEmitter();
    mockBusboyInstance.emit("file", "file", fileEmitter, { filename: "doc.txt" });
    fileEmitter.emit("data", Buffer.from("content"));
    fileEmitter.emit("end");
    mockBusboyInstance.emit("field", "path", "/tmp/custom/doc.txt");
    mockBusboyInstance.emit("field", "open", "true");
    mockBusboyInstance.emit("finish");

    await promise;

    expect(written().status).toBe(201);
  });

  it("should return 500 when saveFile throws during multipart upload", async () => {
    fsMock.mkdirSync.mockImplementation(() => {
      throw new Error("disk full");
    });

    const req = makeMultipartReq();
    const { res, written } = makeRes();

    const promise = handleFilesRequest(req, res, "/api/files", "POST", makeContext());

    const fileEmitter = new EventEmitter();
    mockBusboyInstance.emit("file", "file", fileEmitter, { filename: "fail.txt" });
    fileEmitter.emit("data", Buffer.from("data"));
    fileEmitter.emit("end");
    mockBusboyInstance.emit("finish");

    await promise;

    expect(written().status).toBe(500);
  });
});
