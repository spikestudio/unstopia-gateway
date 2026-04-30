# Task: [ES-026] Story 6/7 — session-runner.ts の切り替え + sessions.ts リファクタリング

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #167 |
| Epic 仕様書 | ES-026 |
| Story | 6, 7 |
| Complexity | M |
| PR | #TBD |

## 責務

分割済みの各モジュール（session-rate-limit.ts / session-fallback.ts / session-message.ts / session-queue-handlers.ts / session-crud.ts）を実際に呼び出すよう `session-runner.ts` と `sessions.ts` の routing を切り替え、ファイルサイズを 500 行以下に削減する。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/session-runner.ts`（**既存・大幅削減**: レートリミット・フォールバック処理を抽出後のコアに縮小）
- `packages/jimmy/src/gateway/api/sessions.ts`（**既存・大幅削減**: 各ハンドラーを新規モジュールに委譲する routing のみに縮小）

対象外（隣接 Task との境界）:

- 各新規モジュールのロジック実装（TASK-051〜056 が担当）
- 新規テストの追加（TASK-058 が担当、本 Task は既存テストの PASS 維持のみ）

## Epic から委ねられた詳細

**session-runner.ts の変更:**

- `runWebSession` のレートリミット検出ブロック（370〜508行）を `handleRateLimit`/`switchToFallback` 呼び出しに置き換える
- `runWebSession` のリトライループ（511〜693行）を `retryUntilDeadline` 呼び出しに置き換える
- 結果として `session-runner.ts` は ~300〜400 行に削減される見込み（API spec Section 5 参照）

**sessions.ts の変更:**

- `POST /api/sessions/:id/message` ブロック（526〜627行）を `handlePostMessage` 呼び出しに置き換える
- キュー操作エンドポイント群（421〜496行）を `session-queue-handlers.ts` の各関数呼び出しに置き換える
- CRUD エンドポイント（219〜418行の一部）を `session-crud.ts` の各関数呼び出しに置き換える
- 結果として `sessions.ts` は ~150〜200 行に削減される見込み（API spec Section 5 参照）

**全ファイルが 500 行以下であること（AC-E026-19）を `wc -l` で確認すること。**

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E026-19**: 変更後の全ファイル（`session-runner.ts`・`sessions.ts` を含む）が 500 行以下（`wc -l` で確認）
- [ ] **AC-E026-22**: `pnpm test --coverage` で `gateway/api/` 以下の branch カバレッジが向上していること（100% は TASK-058 で達成、本 Task は既存テスト PASS のみ）
- [ ] **AC-E026-23**: 既存テストが全 PASS する（`pnpm test` で確認）
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E026-19 の達成確認）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している（既存テストの PASS 維持）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（`pnpm lint`・`pnpm typecheck` エラーなし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | 既存テスト（PASS 維持） | 新規テストは追加しない（TASK-058 が担当） |
| ドメインロジックテスト | 該当なし | — |
| 統合テスト | 該当なし | — |
| E2E テスト | 該当なし — 理由: routing 切り替えのみ。E2E は TASK-059 で実施 | — |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（支援ドメイン） |
| サブドメイン種別 | 支援: 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-026 Story 6（AC-E026-19〜20）, Story 7（AC-E026-22〜23）
- 参照設計: `docs/design/session-runner-sessions-refactor-api-spec.md` §Section 5（ファイル構成と行数見積もり）
- 参照コード: `packages/jimmy/src/gateway/api/session-runner.ts`（切り替え元）
- 参照コード: `packages/jimmy/src/gateway/api/sessions.ts`（切り替え元）
- 参照コード: `packages/jimmy/src/gateway/api/session-rate-limit.ts`（TASK-051 成果物）
- 参照コード: `packages/jimmy/src/gateway/api/session-fallback.ts`（TASK-052 成果物）
- 参照コード: `packages/jimmy/src/gateway/api/session-message.ts`（TASK-054 成果物）
- 参照コード: `packages/jimmy/src/gateway/api/session-queue-handlers.ts`（TASK-055 成果物）
- 参照コード: `packages/jimmy/src/gateway/api/session-crud.ts`（TASK-056 成果物）

## 依存

- 先行 Task: TASK-051, TASK-052, TASK-053, TASK-054, TASK-055, TASK-056（全モジュール実装完了後）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E026-19〜20, 22〜23）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task（TASK-051〜056 全て）が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
