import { EventEmitter } from "node:events";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import { vi } from "vitest";
import type { ApiContext } from "../types.js";

/** Build a minimal HttpRequest mock that emits a body via EventEmitter. */
export function makeReq(body = ""): HttpRequest {
  const emitter = new EventEmitter() as HttpRequest;
  setImmediate(() => {
    emitter.emit("data", Buffer.from(body));
    emitter.emit("end");
  });
  return emitter;
}

/** Build a minimal ServerResponse mock that captures status and JSON body. */
export function makeRes(): { res: ServerResponse; written: () => { status: number; body: unknown } } {
  let status = 200;
  let rawBody = "";
  const res = {
    writeHead: vi.fn((s: number) => { status = s; }),
    end: vi.fn((b: string) => { rawBody = b; }),
  } as unknown as ServerResponse;
  return { res, written: () => ({ status, body: JSON.parse(rawBody || "null") }) };
}

/** Build a minimal ApiContext mock. */
export function makeContext(overrides: Partial<ApiContext> = {}): ApiContext {
  return {
    config: {} as never,
    sessionManager: {} as never,
    startTime: Date.now(),
    getConfig: vi.fn().mockReturnValue({}),
    emit: vi.fn(),
    connectors: new Map(),
    ...overrides,
  };
}
