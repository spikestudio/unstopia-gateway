# Task: [ES-026] Story 7 — branch カバレッジ 100% 達成確認・補完

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #168 |
| Epic 仕様書 | ES-026 |
| Story | 7 |
| Complexity | S |
| PR | #TBD |

## 責務

`pnpm test --coverage` を実行してカバレッジレポートを確認し、`gateway/api/` 以下の全新規ファイルで branch カバレッジ 100% を達成する。未カバーのブランチがある場合はテストを追加して 100% を達成する。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/session-rate-limit.test.ts`（補完が必要な場合）
- `packages/jimmy/src/gateway/api/__tests__/session-fallback.test.ts`（補完が必要な場合）
- `packages/jimmy/src/gateway/api/__tests__/session-runner.test.ts`（補完が必要な場合）
- `packages/jimmy/src/gateway/api/__tests__/session-message.test.ts`（補完が必要な場合）
- `packages/jimmy/src/gateway/api/__tests__/session-queue-handlers.test.ts`（補完が必要な場合）
- `packages/jimmy/src/gateway/api/__tests__/session-crud.test.ts`（補完が必要な場合）

対象外（隣接 Task との境界）:

- TASK-051〜056: 各モジュールのメインのテスト実装
- TASK-059: E2E 検証（ビルド + テスト全件 PASS の最終確認）

## Epic から委ねられた詳細

- カバレッジ対象: `gateway/api/` 以下の**新規ファイル**（`session-rate-limit.ts`, `session-fallback.ts`, `session-message.ts`, `session-queue-handlers.ts`, `session-crud.ts`, 変更後の `session-runner.ts`）
- `vi.mock` または依存注入でテストを記述する（実際のデータベース・ファイルシステムに依存しない）
- 各テストファイルが `vi.mock` または依存注入で全外部依存を完全にモックしていること（AC-E026-23）
- カバレッジが 100% に達していないブランチを vitest の coverage レポートから特定し、テストケースを追加する
- vitest の coverage 設定で `gateway/api/` を対象に含めること（設定が必要な場合は `packages/jimmy/vitest.config.ts` を確認）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E026-22**: `pnpm test --coverage` のレポートで `gateway/api/` 以下の新規ファイルの branch カバレッジが 100% を達成している
- [ ] **AC-E026-23**: 各テストファイルが外部依存（`registry.js`・`logger.js`・`engine`）を完全にモックしており、データベース・ファイルシステムに依存しない純粋なユニットテストになっている
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E026-22〜23）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（`pnpm lint`・`pnpm typecheck` エラーなし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | カバレッジレポートで未カバーのブランチ | `vi.mock` または依存注入。実際の DB・fs に依存しない |
| ドメインロジックテスト | 該当なし | — |
| 統合テスト | 該当なし | — |
| E2E テスト | 該当なし — 理由: ユニットテスト補完のみ。E2E は TASK-059 で実施 | — |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（支援ドメイン） |
| サブドメイン種別 | 支援: 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-026 Story 7（AC-E026-22〜23）
- 参照設計: `docs/design/session-runner-sessions-refactor-api-spec.md` §Section 4 問2（ビジネスルール一覧 — 未カバーのブランチを特定する際の参考）
- 参照コード: `packages/jimmy/src/gateway/api/__tests__/`（既存テストファイル群）
- 参照規約: `docs/conventions/testing.md`

**実行手順:**

1. `pnpm test --coverage --reporter=verbose 2>&1 | head -100` でカバレッジレポートを確認
2. `gateway/api/` 以下の新規ファイルで branch カバレッジが 100% でないファイルを特定
3. 未カバーブランチを特定し、テストケースを追加
4. 再度 `pnpm test --coverage` を実行して 100% を確認

## 依存

- 先行 Task: TASK-057（全モジュールの routing 切り替え完了後）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E026-22〜23）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task（TASK-057）が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
