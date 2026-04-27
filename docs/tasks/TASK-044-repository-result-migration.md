# Task: [ES-021] Story 21.2 — ISessionRepository 戻り値型を Result<T,E> に変更

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #136 |
| Epic 仕様書 | ES-021 |
| Story | 21.2 |
| Complexity | M |
| PR | #xxx |

## 責務

`ISessionRepository` インターフェースと両実装（`SqliteSessionRepository` / `InMemorySessionRepository`）の主要メソッドの戻り値型を `Result<T, E>` に変更し、全呼び出し元を更新する。

## スコープ

対象ファイル:

- `packages/jimmy/src/sessions/repositories/ISessionRepository.ts`（更新）
- `packages/jimmy/src/sessions/repositories/SqliteSessionRepository.ts`（更新）
- `packages/jimmy/src/sessions/repositories/InMemorySessionRepository.ts`（更新）
- Repository を呼び出す全ファイル（`engine-runner.ts`、`manager.ts`、`registry.ts` 等）のうち、TASK-045 で扱う `runSession` スコープを除く部分

対象外（隣接 Task との境界）:

- TASK-043: `result.ts` の型定義は行わない（TASK-043 で完了済みの前提）
- TASK-045: engine-runner の `runSession` / `runEngine` 関数本体への Result 適用は TASK-045 で行う
- IQueueRepository / IFileRepository / IMessageRepository への Result 適用はスコープ外（未決定事項 #2）

## Epic から委ねられた詳細

- 変更対象メソッド: `findById` / `findBySessionKey`（= `getSessionBySessionKey`）: not-found は正常系なので `Ok<Session | null>` を返す
- 変更対象メソッド: `save` / `update`（= `updateSession`）: 成功時 `Ok<void>`、DB 制約違反等の永続化エラー時 `Err<RepositoryError>` を返す
- `RepositoryError` 型は `result.ts` と同じか `ISessionRepository.ts` 内で定義する（実装者が判断）
- `SqliteSessionRepository` と `InMemorySessionRepository` の両実装でシグネチャ一致を TypeScript コンパイルで保証する
- 変更により破壊的な型変更が生じる場合、呼び出し元で `result.success` ナローイングを使うこと

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E021-05**: 開発者が `ISessionRepository` の `findById` / `findByKey` を呼ぶと、セッションが存在する場合 `Ok<Session>` が返り、存在しない場合 `Ok<null>` が返る（not-found は正常系として扱う）
- [ ] **AC-E021-06**: 開発者が `ISessionRepository` の `save` / `update` を呼ぶと、成功時 `Ok<void>` が返り、DB 制約違反などの永続化エラー時 `Err<RepositoryError>` が返る
- [ ] **AC-E021-07**: 開発者が `SqliteSessionRepository` と `InMemorySessionRepository` の両実装で同一のシグネチャが保たれていることを TypeScript のコンパイルで確認できる
- [ ] **AC-E021-08**: 既存の Repository 利用箇所（`engine-runner.ts` など）が Result を受け取る形に更新され、`pnpm build && pnpm test` が PASS する
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `SqliteSessionRepository` / `InMemorySessionRepository` の Result 戻り値 | ok/err 分岐をそれぞれテスト |
| ドメインロジックテスト | 該当なし | Repository は支援サブドメイン |
| 統合テスト | `ISessionRepository` 実装とインターフェース整合性 | TypeScript コンパイルで確認 |
| E2E テスト | 該当なし — 理由: 内部リファクタリング。AC-E021-08 は pnpm build && pnpm test で確認 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし — 既存コード構造改善のみ |
| サブドメイン種別 | 支援（Repository 層） |

- 参照 Epic 仕様書: ES-021 §Story 21.2, §エラーケース（Repository 永続化エラー行）
- 参照設計: `docs/requirements/ES-021-error-handling-result.md` §ストーリーと受入基準 §Story 21.2
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/sessions/repositories/ISessionRepository.ts`
  - `packages/jimmy/src/sessions/repositories/SqliteSessionRepository.ts`
  - `packages/jimmy/src/sessions/repositories/InMemorySessionRepository.ts`
  - `packages/jimmy/src/shared/result.ts`（TASK-043 で作成済みの前提）

## 依存

- 先行 Task: TASK-043（result.ts が存在すること）

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
