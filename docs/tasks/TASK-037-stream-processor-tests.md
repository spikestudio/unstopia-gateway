# Task: [ES-019] Story 19.2 — ストリーミングイベント単体テスト追加

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #125 |
| Epic 仕様書 | ES-019 |
| Story | 19.2 |
| Complexity | M |
| PR | #TBD |

## 責務

TASK-036 で抽出した `ClaudeStreamProcessor`（または相当モジュール）に対して、状態機械の各遷移パスをカバーする単体テストを追加する。外部プロセス（spawn）なしにテスト可能な構造を活かし、イベントタイプごとの戻り値・状態遷移を網羅する。

## スコープ

対象ファイル:

- `packages/jimmy/src/engines/__tests__/claude.test.ts`（既存テストファイルへの追記）

対象外（隣接 Task との境界）:

- TASK-036: `ClaudeStreamProcessor` クラス実装本体（この Task では実装変更なし）
- TASK-038: E2E 全 PASS 確認（TASK-037 完了後）
- 既存63テストの修正禁止（テストが失敗する場合は実装を修正すること）

## Epic から委ねられた詳細

- **既存63テストは PASS のまま維持する**（既存テストを「通るように修正」してはならない）
- **`ClaudeStreamProcessor` の公開インターフェースを使ってテストを書く**（spawn・外部プロセス不要）
- **biome-ignore コメントは追加しない**（TASK-036 で適切な型付けが完了しているはず）
- テスト対象の具体的なイベント形式は Epic 仕様書 §バリデーションルール・§エラーケース・状態遷移図を参照

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E019-05: `result` イベントを処理するテストを実行すると、`__result` 型の戻り値が返される
- [ ] AC-E019-06: `stream_event` + `content_block_start` + `tool_use` block のイベントを処理するテストを実行すると、`__tool_start` 型の戻り値が返される
- [ ] AC-E019-07: `stream_event` + `content_block_delta` + `text_delta`（inTool=false）のイベントを処理するテストを実行すると、`delta.type = "text"` の戻り値が返される
- [ ] AC-E019-08: `stream_event` + `content_block_stop`（inTool=true）のイベントを処理するテストを実行すると、`__tool_end` 型の戻り値が返される
- [ ] AC-E019-09: 空行・不正 JSON を含む入力のテストを実行すると、`null` が返され例外が発生しない
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E019-05〜09）

### 品質面

- [ ] 既存63テストが全 PASS のまま維持されている
- [ ] 追加テストが全 PASS している
- [ ] `pnpm build` PASS
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS（biome-ignore コメント追加なし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `ClaudeStreamProcessor`（または相当モジュール）の各イベントハンドラ | 外部プロセスなしで直接インスタンス化してテスト |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: TASK-038 で全体確認 | |

**追加すべきテストケース:**

| ケース | AC | 入力（概要） | 期待する戻り値 |
|--------|-----|------------|-------------|
| result イベント | AC-E019-05 | `msgType: "result"` のストリーム行 | `__result` 型 |
| tool_use 開始 | AC-E019-06 | `stream_event` + `content_block_start` + `type: "tool_use"` | `__tool_start` 型 |
| テキストデルタ（Idle/InText 状態） | AC-E019-07 | `stream_event` + `content_block_delta` + `text_delta`、`inTool=false` | `delta.type = "text"` |
| ツール終了 | AC-E019-08 | `stream_event` + `content_block_stop`、`inTool=true` | `__tool_end` 型 |
| 空行 | AC-E019-09 | 空文字列 | `null`（例外なし） |
| 不正 JSON | AC-E019-09 | `"not-json"` | `null`（例外なし） |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | — （テスト追加のみ）|
| サブドメイン種別 | 支援（エンジン処理は支援サブドメイン）|

- 参照 Epic 仕様書: ES-019 §Story 19.2, §バリデーションルール, §エラーケース, §ステータス遷移（ストリーミング状態機械）
- 参照コード:
  - `packages/jimmy/src/engines/__tests__/claude.test.ts`（既存63テスト — 追記先・変更禁止）
  - `packages/jimmy/src/engines/claude.ts` または `packages/jimmy/src/engines/claude-stream-processor.ts`（TASK-036 成果物 — テスト対象）
- 参照 ADR: —

## 依存

- 先行 Task: TASK-036（`ClaudeStreamProcessor` 抽出完了・コミット済み）

## 引き渡し前チェック

- [x] 完了条件が全て検証可能な形で記述されている
- [x] 対応する Epic AC（AC-E019-05〜09）が特定され完了条件と対応づけられている
- [x] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [x] コンテキスト量が複雑度 M の目安に収まっている
- [x] Epic から委ねられた詳細（biome-ignore 禁止・既存テスト修正禁止）が転記されている
