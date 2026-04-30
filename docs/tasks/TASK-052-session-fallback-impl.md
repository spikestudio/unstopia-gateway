# Task: [ES-026] Story 2 — session-fallback.ts 実装 + UT

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #164 |
| Epic 仕様書 | ES-026 |
| Story | 2 |
| Complexity | S |
| PR | #TBD |

## 責務

`runWebSession` に埋め込まれた Claude → fallback エンジン切り替え処理を `session-fallback.ts` に抽出し、依存注入可能なシグネチャで実装してユニットテストでカバーする。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/session-fallback.ts`（**新規作成**）
- `packages/jimmy/src/gateway/api/__tests__/session-fallback.test.ts`（**新規作成**）

対象外（隣接 Task との境界）:

- TASK-051: `session-rate-limit.ts` の実装（レートリミット待機ロジック）
- TASK-057: `session-runner.ts` から `switchToFallback` を実際に呼び出すよう切り替える（本 Task では新規ファイルの実装のみ）

## Epic から委ねられた詳細

- `switchToFallback(deps, session, fallbackEngine, fallbackName, prompt, config, context, attachments?)` を公開関数として定義する（API spec Section 2-2 参照）
- 戻り値: `true`（フォールバック成功）/ `false`（フォールバックエンジン未設定でスキップ）
- `FallbackDeps` インターフェースで外部依存を注入可能にする（`updateSession`, `insertMessage`, `getMessages`, `notifyDiscordChannel`）
- `fallbackEngine.run()` の呼び出しも `switchToFallback` 内で実施する。呼び出し元（TASK-057）は `switchToFallback` の戻り値で分岐する
- `engineOverride` の `transportMeta` への書き込みロジックは本 Task の責務

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E026-05**: `session-fallback.ts` が `gateway/api/` 以下に存在し、Claude → Codex フォールバック切り替え・`engineOverride` の書き込みロジックが同ファイルに集約されている
- [ ] **AC-E026-06**: Claude がレートリミットかつ `strategy === "fallback"` の場合に Codex エンジンが呼び出され、`session.engine` が fallback エンジン名に更新されることをモックで検証するユニットテストが通過する
- [ ] **AC-E026-07**: fallback エンジンが設定に存在しない場合（`engines.get(fallbackName)` が undefined）にフォールバックをスキップして通常のレートリミット待機に入ることをモックで検証するユニットテストが通過する
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E026-05〜07）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（`pnpm lint`・`pnpm typecheck` エラーなし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `switchToFallback` 関数 | `vi.mock` で `FallbackDeps` の全依存をモック |
| ドメインロジックテスト | 該当なし | — |
| 統合テスト | 該当なし | — |
| E2E テスト | 該当なし — 理由: 内部モジュール抽出のみ。E2E は TASK-059 で実施 | — |

**テストケース（最低限）:**

1. `switchToFallback`: `fallbackEngine` が `null`/`undefined` の場合に `false` を返しエンジン関数を呼ばないこと
2. `switchToFallback`: フォールバック成功時に `session.engine` が fallbackName に更新（`updateSession` が呼ばれる）こと
3. `switchToFallback`: フォールバック成功時に `true` を返すこと
4. `switchToFallback`: `notifyDiscordChannel` が呼ばれること（フォールバック成功時）
5. `switchToFallback`: `fallbackEngine.run()` のエラー時にエラー状態でセッションを更新すること

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（支援ドメイン） |
| サブドメイン種別 | 支援: 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-026 Story 2（AC-E026-05〜07）
- 参照設計: `docs/design/session-runner-sessions-refactor-api-spec.md` §Section 2-2（session-fallback.ts の公開インターフェース骨格）
- 参照設計: `docs/domain/session-runner-sessions-refactor-domain-model.md` §SessionFallbackService
- 参照コード: `packages/jimmy/src/gateway/api/session-runner.ts`（既存の `runWebSession` の 377〜507行あたりの fallback 処理が移植元）
- 参照規約: `docs/conventions/testing.md`

## 依存

- 先行 Task: TASK-051（session-rate-limit.ts が完了済みでないと session-runner.ts の構造が確定しない）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E026-05〜07）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task（TASK-051）が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
