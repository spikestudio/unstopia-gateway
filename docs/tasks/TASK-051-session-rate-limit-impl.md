# Task: [ES-026] Story 1 — session-rate-limit.ts 実装 + UT

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #161 |
| Epic 仕様書 | ES-026 |
| Story | 1 |
| Complexity | M |
| PR | #TBD |

## 責務

`runWebSession` に埋め込まれたレートリミット待機・リトライループを `session-rate-limit.ts` に抽出し、依存注入可能なシグネチャで実装してユニットテストでカバーする。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/session-rate-limit.ts`（**新規作成**）
- `packages/jimmy/src/gateway/api/__tests__/session-rate-limit.test.ts`（**新規作成**）

対象外（隣接 Task との境界）:

- TASK-052: `session-fallback.ts` の実装（フォールバック切り替えロジック）
- TASK-057: `session-runner.ts` から `handleRateLimit`/`retryUntilDeadline` を実際に呼び出すよう切り替える（本 Task では新規ファイルの実装のみ）

## Epic から委ねられた詳細

- `handleRateLimit` と `retryUntilDeadline` を同一ファイルの独立した公開関数として定義する（API spec Section 2-1 参照）
- `RateLimitDeps` インターフェースで全外部依存を注入可能にする（`detectRateLimit`, `computeNextRetryDelayMs`, `computeRateLimitDeadlineMs`, `notifyRateLimited`, `notifyRateLimitResumed`, `notifyDiscordChannel`, `updateSession`, `insertMessage`）
- デフォルト実装（既存の直接インポート）は `session-runner.ts` の呼び出し元（TASK-057）で切り替える。本 Task では関数シグネチャとロジックの実装のみ
- `engine.run()` の呼び出し（リトライループ内）はどう引数として渡すか: `retryUntilDeadline` の引数として `engine: Engine` を受け取る（API spec Section 2-1 の関数シグネチャ参照）

<!-- 設計判断確定: category=algorithm
     選択: exact-copy-and-parameterize（推奨）
     根拠: ループ構造は既存コードを忠実に再現することで動作保証の信頼性を維持する。engine.run は RateLimitDeps に追加せず retryUntilDeadline の引数として受け取る（API spec Section 2-1 参照）。vi.useFakeTimers() で setTimeout をモックすることでタイムアウトテストが可能。
     対案: redesign-for-testability — sleep 関数を deps に注入する設計。オーバーエンジニアリングになる可能性があり、既存ロジックからの乖離でバグ混入リスクが高い
     トレードオフ: exact-copy は heartbeat（setInterval）も含む複雑なロジックを再現するが、vi.useFakeTimers() で同期的にテスト可能。ただし engine.run のモックが必要なため deps に engine の run 関数型を追加する必要がある -->

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E026-01**: `session-rate-limit.ts` が `gateway/api/` 以下に存在し、レートリミット検出・待機・リトライの処理が同ファイルに集約されている
- [ ] **AC-E026-02**: 抽出した関数が `RateLimitDeps` インターフェース経由で全外部依存を注入可能（`vi.mock` または依存注入でテスト可能）
- [ ] **AC-E026-03**: レートリミット状態に入ったセッションが `status: "waiting"` に更新され、`notifyRateLimited` が呼び出されることをモックで検証するユニットテストが通過する
- [ ] **AC-E026-04**: レートリミットが解除されてリトライが成功した場合に `notifyRateLimitResumed` が呼び出されることを検証するユニットテストが通過する
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E026-01〜04）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（`pnpm lint`・`pnpm typecheck` エラーなし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `handleRateLimit`, `retryUntilDeadline` 関数 | `vi.mock` で `RateLimitDeps` の全依存をモック。`vi.useFakeTimers()` でタイムアウトテスト |
| ドメインロジックテスト | 該当なし | — |
| 統合テスト | 該当なし | — |
| E2E テスト | 該当なし — 理由: 内部モジュール抽出のみ。E2E は TASK-059 で実施 | — |

**テストケース（最低限）:**

1. `handleRateLimit`: `updateSession` が `status: "waiting"` で呼ばれること
2. `handleRateLimit`: `notifyRateLimited` が呼ばれること
3. `retryUntilDeadline`: リトライ成功時に `notifyRateLimitResumed` が呼ばれること
4. `retryUntilDeadline`: deadlineMs を過ぎた場合に `status: "error"` で更新されること
5. `retryUntilDeadline`: 再度レートリミットが発生した場合にループが継続すること

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（支援ドメイン） |
| サブドメイン種別 | 支援: 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-026 Story 1（AC-E026-01〜04）
- 参照設計: `docs/design/session-runner-sessions-refactor-api-spec.md` §Section 2-1（session-rate-limit.ts の公開インターフェース骨格）
- 参照設計: `docs/domain/session-runner-sessions-refactor-domain-model.md` §SessionRateLimitService
- 参照コード: `packages/jimmy/src/gateway/api/session-runner.ts`（既存の `runWebSession` の 370〜693行あたりのレートリミット・リトライ処理が移植元）
- 参照コード: `packages/jimmy/src/shared/rateLimit.ts`（`detectRateLimit`, `computeNextRetryDelayMs`, `computeRateLimitDeadlineMs`）
- 参照コード: `packages/jimmy/src/sessions/callbacks.ts`（`notifyRateLimited`, `notifyRateLimitResumed`, `notifyDiscordChannel`）
- 参照規約: `docs/conventions/testing.md`

## 依存

- 先行 Task: なし（--）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E026-01〜04）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（本 Task は先行なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
