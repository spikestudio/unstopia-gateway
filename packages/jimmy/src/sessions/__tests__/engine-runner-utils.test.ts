import { describe, expect, it } from "vitest";
import { mergeTransportMeta } from "../engine-runner.js";

describe("mergeTransportMeta", () => {
  it("両方 null/undefined の場合は空オブジェクトを返す", () => {
    expect(mergeTransportMeta(null, undefined)).toEqual({});
  });

  it("existing が null の場合は incoming を返す", () => {
    const result = mergeTransportMeta(null, { channel: "ch" });
    expect(result).toEqual({ channel: "ch" });
  });

  it("incoming が undefined の場合は existing を返す", () => {
    const result = mergeTransportMeta({ channel: "ch" }, undefined);
    expect(result).toEqual({ channel: "ch" });
  });

  it("incoming が existing を上書きする", () => {
    const result = mergeTransportMeta({ a: "old", b: "keep" }, { a: "new" });
    expect(result).toEqual({ a: "new", b: "keep" });
  });

  it("engineOverride は incoming に含まれても existing の値を保持する", () => {
    const existing = { engineOverride: { originalEngine: "claude" }, other: "x" };
    const incoming = { engineOverride: { originalEngine: "codex" }, other: "y" };
    const result = mergeTransportMeta(existing, incoming) as Record<string, unknown>;
    expect((result.engineOverride as Record<string, unknown>).originalEngine).toBe("claude");
    expect(result.other).toBe("y");
  });

  it("engineSessions は existing の値を保持する", () => {
    const existing = { engineSessions: { claude: "sess-1" } };
    const incoming = { engineSessions: { claude: "sess-2" } };
    const result = mergeTransportMeta(existing, incoming) as Record<string, unknown>;
    expect((result.engineSessions as Record<string, unknown>).claude).toBe("sess-1");
  });

  it("claudeSyncSince は existing の値を保持する", () => {
    const existing = { claudeSyncSince: "2024-01-01T00:00:00Z" };
    const incoming = { claudeSyncSince: "2024-02-01T00:00:00Z" };
    const result = mergeTransportMeta(existing, incoming) as Record<string, unknown>;
    expect(result.claudeSyncSince).toBe("2024-01-01T00:00:00Z");
  });

  it("existing に内部キーがない場合は incoming の値が使われる", () => {
    const result = mergeTransportMeta({ a: 1 }, { engineOverride: { x: 1 } }) as Record<string, unknown>;
    expect(result.engineOverride).toEqual({ x: 1 });
  });

  it("配列の existing / incoming は空オブジェクトとして扱う", () => {
    const result = mergeTransportMeta([] as never, { foo: "bar" });
    expect(result).toEqual({ foo: "bar" });
  });
});
