# Task: [ES-019] Story 19.1+19.3 — ClaudeStreamProcessor クラス抽出と状態機械実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #124 |
| Epic 仕様書 | ES-019 |
| Story | 19.1, 19.3 |
| Complexity | M |
| PR | #TBD |

## 責務

`packages/jimmy/src/engines/claude.ts` の `processStreamLine` メソッドを `ClaudeStreamProcessor` クラス（または相当モジュール）として抽出し、`Idle` / `InText` / `InTool` の3状態を型で明示した状態機械に整理する。

## スコープ

対象ファイル:

- `packages/jimmy/src/engines/claude.ts`（622行 — メインリファクタリング対象）
- `packages/jimmy/src/engines/claude-stream-processor.ts`（新規作成の場合 — 実装時に判断）

対象外（隣接 Task との境界）:

- TASK-037: 状態機械の単体テスト追加（この Task ではテスト追加不要、既存テストが PASS すれば十分）
- TASK-038: E2E 全 PASS 確認（TASK-036・037 の完了後）
- 外部 API（`run`, `kill`, `killAll`, `isAlive`）の変更禁止

## Epic から委ねられた詳細

- **同一ファイル内クラス vs 独立ファイル分割**: 622行のファイルが大きいため独立ファイル（`engines/claude-stream-processor.ts`）への分割を推奨するが、実装時に凝集度を判断して決定してよい
- **`StreamState` 型の名前と定義範囲**: `type StreamState = "Idle" | "InText" | "InTool"` が基本案。discriminated union による状態オブジェクトへの拡張は実装時に判断
- **`inTool: boolean`（現 `runOnce()` 内 L164 ローカル変数）を `ClaudeStreamProcessor` のインスタンス状態へ昇格させる**
- **`msgType` ごとの分岐を独立したハンドラメソッド/関数に分離し、ネスト3段以下にする**
- **既存の `biome-ignore lint/suspicious/noExplicitAny` コメントを、`ClaudeStreamProcessor` を適切に型付けすることで除去する**（suppress 指示での回避禁止）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E019-01: 開発者が `ClaudeStreamProcessor`（または相当するクラス/モジュール）の状態一覧を確認すると、`Idle` / `InText` / `InTool` の3状態とそれぞれのトランジション条件がコードから読み取れる
- [ ] AC-E019-02: 開発者が既存の `processStreamLine` と同等の動作をするリファクタリング後の実装を確認すると、ネストが3段以下で、msgType ごとの分岐が独立したハンドラメソッド/関数に分かれている
- [ ] AC-E019-03: 開発者がリファクタリング後のストリーミングイベント処理に単体テストを追加しようとすると、`processStreamLine` 相当の処理が純粋関数またはモック可能なクラスとして分離されており、外部プロセス（spawn）なしにテストを書ける
- [ ] AC-E019-10: 開発者がリファクタリング後のコードを確認すると、StreamState 型（または同等のコメント）が定義されており、各イベントタイプがどの状態から遷移するかが読み取れる
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E019-01〜03, AC-E019-10）

### 品質面

- [ ] 既存の63テストが全 PASS している（`pnpm test` でリグレッションなし）
- [ ] `pnpm build` PASS
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS（biome 警告・エラーゼロ、biome-ignore コメント除去済み）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | 該当なし — 理由: テスト追加は TASK-037 の責務 | |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 既存テスト（63件）の PASS 維持 | リグレッション確認のみ |
| E2E テスト | 該当なし — 理由: TASK-038 で確認 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | — （既存コードの構造整理のみ）|
| サブドメイン種別 | 支援（エンジン処理は支援サブドメイン）|

- 参照 Epic 仕様書: ES-019 §Story 19.1, §Story 19.3, §ステータス遷移（ストリーミング状態機械）, §バリデーションルール, §エラーケース
- 参照コード:
  - `packages/jimmy/src/engines/claude.ts`（メインリファクタリング対象）
    - `processStreamLine` メソッド（多段ネスト条件分岐）
    - `runOnce()` 内の `inTool: boolean` ローカル変数（L164 付近）
    - 外部 API: `run`, `kill`, `killAll`, `isAlive`（変更禁止）
    - 既存の `biome-ignore lint/suspicious/noExplicitAny` コメント（除去対象）
  - `packages/jimmy/src/engines/__tests__/claude.test.ts`（既存63テスト — リグレッション基準）
- 参照 ADR: —
- 状態遷移図（Epic 仕様書 §ステータス遷移 参照）:
  - `Idle → InTool`: `content_block_start` (tool_use)
  - `Idle → InText`: `content_block_delta` (text_delta)
  - `InText → Idle`: `content_block_stop`
  - `InTool → Idle`: `content_block_stop`
  - `InText → InText`: `content_block_delta` (text_delta)
  - `InTool → InTool`: `content_block_delta` (ignored)

## 依存

- 先行 Task: なし（ES-019 の起点 Task）

## 引き渡し前チェック

- [x] 完了条件が全て検証可能な形で記述されている
- [x] 対応する Epic AC（AC-E019-01〜03, AC-E019-10）が特定され完了条件と対応づけられている
- [x] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [x] コンテキスト量が複雑度 M の目安に収まっている
- [x] Epic から委ねられた詳細（ファイル分割判断・型設計・biome-ignore 除去）が転記されている
