# Task: [ES-030] Story 2 — CodexEngine branch カバレッジ向上テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #214 |
| Epic 仕様書 | ES-030 |
| Story | 2 |
| Complexity | S |
| PR | <!-- PR 作成後に記入 --> |

## 責務

`codex.ts` の `processJsonlLine` close 時残処理分岐（text・usage・error・turn_failed）をテストし、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `src/engines/__tests__/codex.test.ts`（既存ファイルにテストケースを追加）

対象外（隣接 Task との境界）:

- TASK-089: claude.ts のテスト追加は対象外
- TASK-091: gemini.ts のテスト追加は対象外

## Epic から委ねられた詳細

- close イベント時の `lineBuf` 残処理（`codex.ts` L141-162）は、stdout の最終チャンクに改行がない場合にトリガーされる。テストでは `proc.stdout.emit("data", Buffer.from(JSON.stringify({...})))` の後（改行なし）でそのまま `proc.emit("close", 0)` する手法で再現する
- `text`・`usage`・`error`・`turn_failed` の 4 分岐を個別のテストケースで網羅する
- `processJsonlLine` が返す `null` の場合（`lineBuf` が unparseable）も close 時に通過するが、既存の `lineBuf.trim()` チェックで null の場合は switch には入らないため、この分岐は既存テストで間接的にカバーされている可能性が高い

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E030-08**: `codex.ts` の branch カバレッジが 90% 以上に到達すること
- [ ] **AC-E030-09**: `processJsonlLine` の全イベントタイプ（`thread.started`・`item.started` の command_execution/file_edit/file_read・`item.completed` の全種別・`turn.completed`・`turn.failed`・`error`）がテストされていること
- [ ] **AC-E030-10**: `item.started` イベントで `item` が undefined の場合、null を返すことがテストされていること
- [ ] **AC-E030-11**: `item.completed` の `agent_message` タイプで text が空の場合の分岐がテストされていること
- [ ] **AC-E030-12**: `item.completed` の `error` タイプで "Under-development features" を含む場合に null を返すことがテストされていること
- [ ] **AC-E030-13**: `buildResumeArgs` で `resumeSessionId` が未指定の場合に throw することがテストされていること
- [ ] **AC-E030-14**: 残余 lineBuf のフラッシュ処理（`close` イベント時の text/usage/error/turn_failed 各分岐）がテストされていること
- [ ] **AC-E030-15**: `terminationReason` が設定されている状態でプロセスが終了した場合、中断エラーとして返されることがテストされていること
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E030-08〜15）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン
- [ ] `codex.ts` の branch カバレッジが 90% 以上に到達している

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | close 時の `lineBuf` 残処理分岐（text/usage/error/turn_failed） | `proc.stdout.emit` で改行なしデータを送信し close を発火させる |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: モック spawn ベースの単体テストのみで完結できる | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/エンジン層） |
| サブドメイン種別 | 汎用 |

- 参照 Epic 仕様書: ES-030 Story 2（AC-E030-05〜08）
- 参照コード: `src/engines/codex.ts §proc.on("close")` L134-193（特に L141-162 の lineBuf 残処理）
- 参照コード: `src/engines/__tests__/codex.test.ts §run() — error scenarios §processes remaining lineBuf on close`（既存の lineBuf テストパターン参照）
- 参照 ADR: 該当なし

### 実装のヒント

**close 時の lineBuf 残処理テストパターン（改行なしデータを送信）:**
```typescript
it("processes lineBuf text on close", async () => {
  const proc = createMockProcess();
  mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

  const p = engine.run({ prompt: "q", cwd: "/tmp", sessionId: "cx-buf-text" });

  // 改行なし → lineBuf に残る
  proc.stdout.emit("data", Buffer.from(
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "buffered text" } })
  ));
  proc.exitCode = 0;
  proc.emit("close", 0);

  const result = await p;
  expect(result.result).toContain("buffered text");
});
```

**usage 型（turn.completed）の残処理:**
```typescript
proc.stdout.emit("data", Buffer.from(
  JSON.stringify({ type: "turn.completed" })  // 改行なし
));
// → lineBuf に "turn.completed" が残り、close 時に numTurns++ が実行される
proc.exitCode = 0;
proc.emit("close", 0);
const result = await p;
expect(result.numTurns).toBe(1);
```

**error / turn_failed の残処理:**
```typescript
// error
proc.stdout.emit("data", Buffer.from(
  JSON.stringify({ type: "error", message: "buffered error" })
));
proc.exitCode = 1;
proc.emit("close", 1);
const result = await p;
expect(result.error).toContain("buffered error");
```

## 依存

- 先行 Task: なし（--）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E030-05〜08）が完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベル S（~200 行）の目安に収まっている
- [ ] Epic から委ねられた詳細が転記されている
