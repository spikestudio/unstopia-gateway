# Task: [ES-021] Story 21.3 — error-handling.md 規約整備 + engine-runner runSession Result 試験適用

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #137 |
| Epic 仕様書 | ES-021 |
| Story | 21.3 |
| Complexity | M |
| PR | #xxx |

## 責務

`docs/conventions/error-handling.md` に Result パターンの使用指針を記述し、`engine-runner.ts` の `runSession` 関数（またはその内部の runEngine 相当ロジック）にエンジン実行エラー（rate limit / dead session）を `Err<EngineError>` で返す Result 試験適用を行う。

## スコープ

対象ファイル:

- `docs/conventions/error-handling.md`（更新）
- `packages/jimmy/src/sessions/engine-runner.ts`（更新）

対象外（隣接 Task との境界）:

- TASK-043: result.ts の型定義は行わない
- TASK-044: ISessionRepository の変更は行わない
- engine-runner.ts の全体 Result 化はスコープ外（AC-E021-10, AC-E021-11 の対象範囲のみ）

## Epic から委ねられた詳細

- `docs/conventions/error-handling.md` に追記する内容:
  - 「いつ Result を使うか」: 公開 API 境界・Repository 境界（例: ISessionRepository）・外部サービス呼び出し境界（例: engine-runner）
  - 「いつ throw を使うか」: プログラムバグ（不変条件違反）・致命的エラー（プロセス継続不可能な場合）
  - Result パターンの使用例コードスニペット（簡潔に）
- `engine-runner.ts` の対象: `runSession` 関数内の engine 実行ループ。rate limit（`detectRateLimit` が `limited: true`）と dead session（`isDeadSessionError` が true）を `Err<EngineError>` として返す
  - `EngineError` 型は `engine-runner.ts` 内か `shared/` に定義する（実装者が判断）
  - `EngineError` の kind: `"rate_limit"` / `"dead_session"`
  - 既存の `detectRateLimit` / `isDeadSessionError` ロジックを Result で包む形で実装
- 「runEngine」は現在 engine-runner.ts に存在しない（`runSession` が相当）。AC-E021-10 の「runEngine」はエンジン実行コアロジックを指す。実装者は `runSession` 内から抽出するか、内部関数として定義して Result を返す形で対応すること（未決定事項 #3）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E021-09**: 開発者が `docs/conventions/error-handling.md` を読むと、「いつ Result を使うか（公開 API 境界・Repository 境界）」と「いつ throw を使うか（プログラムバグ・致命的エラー）」の基準が明示されている
- [ ] **AC-E021-10**: 開発者が `engine-runner.ts` の `runEngine`（または相当する関数）を呼ぶと、エンジン実行エラー（rate limit / dead session 等）が `Err<EngineError>` として返り、正常完了が `Ok<EngineResult>` として返る
- [ ] **AC-E021-11**: 既存の呼び出し元（`SessionManager` 相当のコード）が Result を受け取る形に更新され、`pnpm build && pnpm test` が PASS する
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `runEngine`（または抽出した関数）の rate_limit / dead_session ケース | `detectRateLimit` / `isDeadSessionError` をモックして Err<EngineError> を確認 |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | `runSession` → `runEngine` の Result 伝播 | |
| E2E テスト | 該当なし — 理由: 内部リファクタリング。AC-E021-11 は pnpm build && pnpm test で確認 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし — 既存コード構造改善のみ |
| サブドメイン種別 | コア（engine-runner はエンジン実行の核心） |

- 参照 Epic 仕様書: ES-021 §Story 21.3, §エラーケース（engine-runner: rate limit / dead session 行）
- 参照設計: `docs/requirements/ES-021-error-handling-result.md` §ストーリーと受入基準 §Story 21.3, §未決定事項 #3
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/sessions/engine-runner.ts`（既存: `runSession` 関数、`detectRateLimit`・`isDeadSessionError` の使用箇所 L226, L242, L488）
  - `packages/jimmy/src/shared/rateLimit.ts`（`detectRateLimit` / `isDeadSessionError` の定義）
  - `packages/jimmy/src/shared/result.ts`（TASK-043 で作成済みの前提）
  - `docs/conventions/error-handling.md`（現在の内容を更新）

## 依存

- 先行 Task: TASK-043（result.ts が存在すること）、TASK-044（Repository Result 変更が完了していること）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（E2E シナリオ）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なしを含む）
