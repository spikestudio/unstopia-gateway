import { describe, expect, it } from "vitest";
import { deepMerge, matchRoute, stripAnsi } from "../api/utils.js";

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

  it("配列内で id が一致しないアイテムはそのまま使う", () => {
    const target = { instances: [{ id: "a", token: "secret" }] };
    const source = { instances: [{ id: "b", token: "***" }] };
    const result = deepMerge(target, source);
    expect((result.instances as { token: string }[])[0].token).toBe("***");
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
