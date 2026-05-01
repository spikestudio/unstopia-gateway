import type { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../sessions/registry.js", () => ({
  getFile: vi.fn(),
}));
vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../shared/paths.js", () => ({
  FILES_DIR: "/fake/files",
}));
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
  },
}));
vi.mock("node:http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:http")>();
  return {
    ...actual,
    default: {
      ...actual,
      request: vi.fn(),
    },
  };
});

import {
  checkInstanceHealth,
  deepMerge,
  matchRoute,
  readBody,
  readBodyRaw,
  resolveAttachmentPaths,
  serverError,
  stripAnsi,
} from "../api/utils.js";

describe("matchRoute", () => {
  it("完全一致パスにマッチし空オブジェクトを返す", () => {
    expect(matchRoute("/api/status", "/api/status")).toEqual({});
  });

  it("パラメータを抽出する", () => {
    expect(matchRoute("/api/sessions/:id", "/api/sessions/abc-123")).toEqual({ id: "abc-123" });
  });

  it("複数パラメータを抽出する", () => {
    expect(matchRoute("/api/sessions/:id/queue/:itemId", "/api/sessions/s1/queue/q2")).toEqual({
      id: "s1",
      itemId: "q2",
    });
  });

  it("セグメント数が異なる場合は null を返す", () => {
    expect(matchRoute("/api/sessions/:id", "/api/sessions/abc/extra")).toBeNull();
  });

  it("リテラルが一致しない場合は null を返す", () => {
    expect(matchRoute("/api/sessions/:id", "/api/cron/abc")).toBeNull();
  });

  it("URL エンコードされたパラメータをデコードする", () => {
    expect(matchRoute("/api/org/employees/:name", "/api/org/employees/alice%20smith")).toEqual({
      name: "alice smith",
    });
  });
});

describe("deepMerge", () => {
  it("シンプルな値をマージする", () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("ネストされたオブジェクトを再帰マージする", () => {
    expect(deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 99, z: 3 } })).toEqual({ a: { x: 1, y: 99, z: 3 } });
  });

  it("ソース値が *** のシークレットキーは target の値を保持する", () => {
    const target = { botToken: "real-token", name: "bot" };
    const source = { botToken: "***", name: "updated" };
    expect(deepMerge(target, source)).toEqual({ botToken: "real-token", name: "updated" });
  });

  it("sanitized keys: token, botToken, signingSecret, appToken 全てを保持する", () => {
    const target = { token: "t", botToken: "bt", signingSecret: "ss", appToken: "at" };
    const source = { token: "***", botToken: "***", signingSecret: "***", appToken: "***" };
    expect(deepMerge(target, source)).toEqual(target);
  });

  it("シークレットキーでも *** 以外の値は上書きする", () => {
    expect(deepMerge({ botToken: "old" }, { botToken: "new-token" })).toEqual({ botToken: "new-token" });
  });

  it("配列を上書きする", () => {
    expect(deepMerge({ arr: [1, 2] }, { arr: [3, 4] })).toEqual({ arr: [3, 4] });
  });

  it("配列内のオブジェクトを id でマッチして deepMerge する", () => {
    const target = { instances: [{ id: "a", botToken: "secret", name: "old" }] };
    const source = { instances: [{ id: "a", botToken: "***", name: "new" }] };
    const result = deepMerge(target, source);
    expect((result.instances as { botToken: string; name: string }[])[0].botToken).toBe("secret");
    expect((result.instances as { botToken: string; name: string }[])[0].name).toBe("new");
  });

  it("配列内で id が一致しないアイテムはソース側をそのまま使い、target の元アイテムは除去される", () => {
    const target = { instances: [{ id: "a", token: "secret" }] };
    const source = { instances: [{ id: "b", token: "***" }] };
    const result = deepMerge(target, source);
    const instances = result.instances as { id: string; token: string }[];
    // ソース配列でそのまま置き換えられるため要素は 1 件
    expect(instances).toHaveLength(1);
    // id が "b" のソースアイテムが使われる（target の "a" は除去）
    expect(instances[0].id).toBe("b");
    // id 不一致のためシークレット保護が発動せず "***" がそのまま入る
    expect(instances[0].token).toBe("***");
  });
});

describe("stripAnsi", () => {
  it("ANSI エスケープコードを除去する", () => {
    expect(stripAnsi("\u001b[32mgreen\u001b[0m")).toBe("green");
  });

  it("複数の ANSI シーケンスを除去する", () => {
    expect(stripAnsi("\u001b[1m\u001b[31mred bold\u001b[0m")).toBe("red bold");
  });

  it("ANSI コードのない文字列はそのまま返す", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });

  it("空文字列を返す", () => {
    expect(stripAnsi("")).toBe("");
  });
});

// ── resolveAttachmentPaths ─────────────────────────────────────────────────

describe("resolveAttachmentPaths", () => {
  it("returns empty array for non-array input", async () => {
    expect(resolveAttachmentPaths(null)).toEqual([]);
    expect(resolveAttachmentPaths("string")).toEqual([]);
    expect(resolveAttachmentPaths(42)).toEqual([]);
  });

  it("skips empty or non-string items", async () => {
    const result = resolveAttachmentPaths(["", "  ", 123, null]);
    expect(result).toEqual([]);
  });

  it("warns when file not found in registry", async () => {
    const { getFile } = await import("../../sessions/registry.js");
    const { logger } = await import("../../shared/logger.js");
    vi.mocked(getFile).mockReturnValue(undefined);
    resolveAttachmentPaths(["file-id-1"]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("file-id-1"));
  });

  it("returns file path when exists on disk", async () => {
    const { getFile } = await import("../../sessions/registry.js");
    const fs = await import("node:fs");
    vi.mocked(getFile).mockReturnValue({ id: "f1", filename: "photo.jpg", path: "/alt/path" } as never);
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    const result = resolveAttachmentPaths(["file-id-1"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("photo.jpg");
  });

  it("falls back to meta.path when primary path does not exist", async () => {
    const { getFile } = await import("../../sessions/registry.js");
    const fs = await import("node:fs");
    vi.mocked(getFile).mockReturnValue({ id: "f1", filename: "photo.jpg", path: "/alt/path/photo.jpg" } as never);
    vi.mocked(fs.default.existsSync)
      .mockReturnValueOnce(false) // primary path does not exist
      .mockReturnValueOnce(true); // meta.path exists
    const result = resolveAttachmentPaths(["file-id-1"]);
    expect(result).toEqual(["/alt/path/photo.jpg"]);
  });

  it("warns when file missing on disk and no meta.path", async () => {
    const { getFile } = await import("../../sessions/registry.js");
    const { logger } = await import("../../shared/logger.js");
    const fs = await import("node:fs");
    vi.mocked(getFile).mockReturnValue({ id: "f1", filename: "photo.jpg", path: undefined } as never);
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    resolveAttachmentPaths(["file-id-1"]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("missing on disk"));
  });
});

// ── serverError ────────────────────────────────────────────────────────────

describe("serverError", () => {
  it("writes 500 with error message", () => {
    const writeHead = vi.fn();
    const end = vi.fn();
    const res = { writeHead, end } as unknown as import("node:http").ServerResponse;
    serverError(res, "Internal server error");
    expect(writeHead).toHaveBeenCalledWith(500, expect.anything());
    const body = JSON.parse(end.mock.calls[0][0]);
    expect(body.error).toBe("Internal server error");
  });
});

// ── readBody / readBodyRaw ─────────────────────────────────────────────────

describe("readBody", () => {
  it("reads body as string", async () => {
    const chunks = [Buffer.from("hello "), Buffer.from("world")];
    let dataCallback: ((chunk: Buffer) => void) | null = null;
    let endCallback: (() => void) | null = null;
    const req = {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        if (event === "data") dataCallback = cb as (chunk: Buffer) => void;
        if (event === "end") endCallback = cb as () => void;
      },
    } as never;
    const promise = readBody(req);
    for (const chunk of chunks) (dataCallback as unknown as (c: Buffer) => void)(chunk);
    (endCallback as unknown as () => void)();
    const result = await promise;
    expect(result).toBe("hello world");
  });
});

describe("readBodyRaw", () => {
  it("reads body as Buffer", async () => {
    const chunks = [Buffer.from("raw "), Buffer.from("data")];
    let dataCallback: ((chunk: Buffer) => void) | null = null;
    let endCallback: (() => void) | null = null;
    let errorCallback: ((err: Error) => void) | null = null;
    const req = {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        if (event === "data") dataCallback = cb as (chunk: Buffer) => void;
        if (event === "end") endCallback = cb as () => void;
        if (event === "error") errorCallback = cb as (err: Error) => void;
      },
    } as never;
    const promise = readBodyRaw(req);
    for (const chunk of chunks) (dataCallback as unknown as (c: Buffer) => void)(chunk);
    (endCallback as unknown as () => void)();
    const result = await promise;
    expect(result).toEqual(Buffer.from("raw data"));
    expect(errorCallback).toBeDefined();
  });

  it("rejects on error", async () => {
    let errorCallback: ((err: Error) => void) | null = null;
    const req = {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        if (event === "error") errorCallback = cb as (err: Error) => void;
      },
    } as never;
    const promise = readBodyRaw(req);
    (errorCallback as unknown as (e: Error) => void)(new Error("stream error"));
    await expect(promise).rejects.toThrow("stream error");
  });
});

// ── checkInstanceHealth ────────────────────────────────────────────────────

describe("checkInstanceHealth", () => {
  const makeHttpReq = () => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const httpReq: EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> } = {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(cb);
        return httpReq;
      },
      emit: (event: string, ...args: unknown[]) => {
        for (const cb of listeners[event] ?? []) cb(...args);
        return true;
      },
      end: vi.fn(),
      destroy: vi.fn(),
    } as never;
    return { httpReq, listeners };
  };

  it("returns true when status 200", async () => {
    const http = await import("node:http");
    const { httpReq } = makeHttpReq();
    vi.mocked(http.default.request).mockImplementation(((_opts: unknown, callback: unknown) => {
      if (typeof callback === "function") callback({ statusCode: 200, resume: vi.fn() } as never);
      return httpReq as never;
    }) as never);
    const result = await checkInstanceHealth(7777);
    expect(result).toBe(true);
  });

  it("returns false when status is not 200", async () => {
    const http = await import("node:http");
    const { httpReq } = makeHttpReq();
    vi.mocked(http.default.request).mockImplementation(((_opts: unknown, callback: unknown) => {
      if (typeof callback === "function") callback({ statusCode: 404, resume: vi.fn() } as never);
      return httpReq as never;
    }) as never);
    const result = await checkInstanceHealth(7777);
    expect(result).toBe(false);
  });

  it("returns false on error", async () => {
    const http = await import("node:http");
    const { httpReq } = makeHttpReq();
    vi.mocked(http.default.request).mockImplementation((() => {
      return httpReq as never;
    }) as never);
    const promise = checkInstanceHealth(7777);
    httpReq.emit("error", new Error("connection refused"));
    const result = await promise;
    expect(result).toBe(false);
  });

  it("returns false on timeout", async () => {
    const http = await import("node:http");
    const { httpReq } = makeHttpReq();
    vi.mocked(http.default.request).mockImplementation((() => {
      return httpReq as never;
    }) as never);
    const promise = checkInstanceHealth(7777);
    httpReq.emit("timeout");
    expect(httpReq.destroy).toHaveBeenCalled();
    const result = await promise;
    expect(result).toBe(false);
  });
});
