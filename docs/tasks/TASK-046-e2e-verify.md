# Task: [ES-021] E2E 検証 — pnpm build && pnpm test 全 PASS

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #138 |
| Epic 仕様書 | ES-021 |
| Story | 21.1, 21.2, 21.3 |
| Complexity | S |
| PR | #xxx |

## 責務

TASK-043〜045 の実装が完了した状態で `pnpm build && pnpm test` を実行し、全 AC（AC-E021-01〜11）が PASS することを確認する。

## スコープ

対象ファイル:

- 確認のみ。新規実装は行わない
- TASK-043〜045 で生成された全ファイル
- CI ログ・テスト結果の確認

対象外（隣接 Task との境界）:

- TASK-043: result.ts の型定義実装は行わない
- TASK-044: Repository 変更は行わない
- TASK-045: error-handling.md / engine-runner 変更は行わない
- 失敗した場合は対応 Task に差し戻し

## Epic から委ねられた詳細

- 該当なし（検証 Task のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E021-01**: `ok(value)` が `{ success: true, value }` の `Ok<T>` 型を返すテストが PASS
- [ ] **AC-E021-02**: `err(error)` が `{ success: false, error }` の `Err<E>` 型を返すテストが PASS
- [ ] **AC-E021-03**: TypeScript 型ナローイングによるコンパイルエラーなし（`pnpm build` PASS）
- [ ] **AC-E021-04**: 外部ライブラリ追加なし（`pnpm build` でパッケージ追加警告なし）
- [ ] **AC-E021-05**: `ISessionRepository.findById` / `findByKey` が `Ok<Session|null>` を返すテストが PASS
- [ ] **AC-E021-06**: `save` / `update` の成功時 `Ok<void>` / 失敗時 `Err<RepositoryError>` テストが PASS
- [ ] **AC-E021-07**: `SqliteSessionRepository` / `InMemorySessionRepository` がコンパイルで整合確認済み
- [ ] **AC-E021-08**: 既存呼び出し元が更新済みで `pnpm build && pnpm test` が PASS
- [ ] **AC-E021-09**: `docs/conventions/error-handling.md` に Result/throw 使い分け基準が記載済み
- [ ] **AC-E021-10**: `runEngine` 相当関数が rate_limit / dead_session で `Err<EngineError>` を返すテストが PASS
- [ ] **AC-E021-11**: 呼び出し元が Result を受け取る形に更新済みで `pnpm build && pnpm test` が PASS
- [ ] Epic 仕様書の全 AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | 該当なし — 検証専用 Task | |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | AC-E021-01〜11 全件 | `pnpm build && pnpm test` で全 AC を自動検証 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし |
| サブドメイン種別 | 該当なし（検証専用 Task） |

- 参照 Epic 仕様書: ES-021 §E2E 検証計画
- 参照設計: `docs/requirements/ES-021-error-handling-result.md` §E2E 検証計画
- 参照 ADR: 該当なし
- 参照コード: TASK-043〜045 で作成・更新された全ファイル

## 依存

- 先行 Task: TASK-043, TASK-044, TASK-045（全て完了済みであること）

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
