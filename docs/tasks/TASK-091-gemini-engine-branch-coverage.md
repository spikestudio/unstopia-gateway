# Task: [ES-030] Story 3 — GeminiEngine branch カバレッジ向上テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #215 |
| Epic 仕様書 | ES-030 |
| Story | 3 |
| Complexity | S |
| PR | <!-- PR 作成後に記入 --> |

## 責務

`gemini.ts` の `processStreamLine` null 返却パス・`parseJsonOutput` のフィールドマッピング・close 時 lineBuf 残処理分岐をテストし、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `src/engines/__tests__/gemini.test.ts`（既存ファイルにテストケースを追加）

対象外（隣接 Task との境界）:

- TASK-089: claude.ts のテスト追加は対象外
- TASK-090: codex.ts のテスト追加は対象外

## Epic から委ねられた詳細

- `processStreamLine` の `session.start` / `session.started` イベントで `session_id` と `sessionId` がどちらも空文字の場合（L258-259）は `null` を返す
- `processStreamLine` の `result` イベントで `result` / `text` / `content` がすべて空の場合（L297-299）は `null` を返す
- `parseJsonOutput` の Array 分岐で `resultEvent` が見つかった場合（L317-324）、`cost`・`duration_ms`・`num_turns` フィールドが number 型であれば各プロパティにマッピングされ、そうでなければ `undefined` になる。このフィールドマッピング分岐が未テスト
- close 時の streaming lineBuf 残処理（`gemini.ts` L142-157）で `session_id` と `turn_complete` 分岐が未カバー

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E030-16**: `gemini.ts` の branch カバレッジが 90% 以上に到達すること
- [ ] **AC-E030-17**: `processStreamLine` の全イベントタイプ（`session.start`/`session.started`・`text`/`content.text`/`text_delta`・`tool.start`/`tool_use`/`function_call`・`tool.end`/`tool_result`/`function_response`・`turn.complete`/`turn.completed`・`error`・`result`・未知タイプ）がテストされていること
- [ ] **AC-E030-18**: `processStreamLine` で `session_id` が空の場合に null を返すことがテストされていること
- [ ] **AC-E030-19**: `processStreamLine` で `text` イベントの text が空の場合に null を返すことがテストされていること
- [ ] **AC-E030-20**: `parseJsonOutput` が配列形式（result イベントあり・なし）およびオブジェクト形式および文字列形式を正しく解析することがテストされていること
- [ ] **AC-E030-21**: 非 streaming モードで JSON パースに失敗した場合、error 付きの結果が返されることがテストされていること
- [ ] **AC-E030-22**: streaming モードで `terminationReason` が設定された状態でプロセス終了した場合、中断エラーとして返されることがテストされていること
- [ ] **AC-E030-23**: streaming モードで close 時に lineBuf に残余データがある場合にフラッシュされることがテストされていること
- [ ] **AC-E030-24**: `proc.on("error")` イベント（spawn 失敗）が reject を引き起こすことがテストされていること
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E030-16〜24）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン
- [ ] `gemini.ts` の branch カバレッジが 90% 以上に到達している

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `processStreamLine` null パス・`parseJsonOutput` フィールドマッピング・close 時 lineBuf 残処理 | `processStreamLine` は public メソッドなので直接呼び出せる |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: モック spawn ベースの単体テストのみで完結できる | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/エンジン層） |
| サブドメイン種別 | 汎用 |

- 参照 Epic 仕様書: ES-030 Story 3（AC-E030-09〜13）
- 参照コード: `src/engines/gemini.ts §processStreamLine` L232-304（特に L256-259, L297-299）
- 参照コード: `src/engines/gemini.ts §parseJsonOutput` L306-356（特に L317-324）
- 参照コード: `src/engines/gemini.ts §proc.on("close")` L134-207（特に L142-157 の streaming lineBuf 残処理）
- 参照コード: `src/engines/__tests__/gemini.test.ts §processStreamLine`（既存テストパターン参照）
- 参照 ADR: 該当なし

### 実装のヒント

**AC-E030-09（session.start で session_id が空）:**
```typescript
it("returns null when session.start has empty session_id and sessionId", () => {
  const line = JSON.stringify({ type: "session.start", session_id: "", sessionId: "" });
  expect(engine.processStreamLine(line)).toBeNull();
});
it("returns null when session.started has no session fields", () => {
  const line = JSON.stringify({ type: "session.started" });
  expect(engine.processStreamLine(line)).toBeNull();
});
```

**AC-E030-10（result イベントで全フィールド空）:**
```typescript
it("returns null when result event has empty result/text/content", () => {
  const line = JSON.stringify({ type: "result", result: "", text: "", content: "" });
  expect(engine.processStreamLine(line)).toBeNull();
});
```

**AC-E030-11（parseJsonOutput の cost/durationMs/numTurns マッピング）:**
```typescript
it("maps cost/durationMs/numTurns from resultEvent in parseJsonOutput", async () => {
  const proc = createMockProcess();
  mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
  const resultPromise = engine.run({ prompt: "q", cwd: "/tmp" });
  const output = JSON.stringify([{
    type: "result",
    session_id: "gem-cost",
    result: "answer",
    cost: 0.42,
    duration_ms: 1500,
    num_turns: 3,
  }]);
  proc.stdout.emit("data", Buffer.from(output));
  proc.exitCode = 0;
  proc.emit("close", 0);
  const result = await resultPromise;
  expect(result.cost).toBe(0.42);
  expect(result.durationMs).toBe(1500);
  expect(result.numTurns).toBe(3);
});
```

**AC-E030-12・13（close 時 lineBuf 残処理）:**
```typescript
// streaming モードで改行なしデータ送信後、close を発火させる
it("processes lineBuf session_id on streaming close", async () => {
  const proc = createMockProcess();
  mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
  const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "gem-buf-sid", onStream: vi.fn() });
  proc.stdout.emit("data", Buffer.from(
    JSON.stringify({ type: "session.start", session_id: "buffered-sid" })  // 改行なし
  ));
  proc.exitCode = 0;
  proc.emit("close", 0);
  const result = await p;
  expect(result.sessionId).toBe("buffered-sid");
});
```

## 依存

- 先行 Task: なし（--）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E030-09〜13）が完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベル S（~200 行）の目安に収まっている
- [ ] Epic から委ねられた詳細が転記されている
