# Task: [ES-021] Story 21.1 — Result<T,E> 型定義と基本ユーティリティ実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #135 |
| Epic 仕様書 | ES-021 |
| Story | 21.1 |
| Complexity | S |
| PR | #xxx |

## 責務

`packages/jimmy/src/shared/result.ts` に `Result<T, E>` 型と `ok`/`err` ヘルパーを実装し、型安全なエラーハンドリングの基盤を提供する。

## スコープ

対象ファイル:

- `packages/jimmy/src/shared/result.ts`（新規作成）

対象外（隣接 Task との境界）:

- TASK-044: Repository への Result 適用は行わない
- TASK-045: engine-runner への Result 適用は行わない

## Epic から委ねられた詳細

- `Ok<T>` の構造: `{ success: true, value: T }` — `success` フィールドで TypeScript の型ナローイングが動作すること
- `Err<E>` の構造: `{ success: false, error: E }` — `success: false` で `error` フィールドにアクセス可能
- `Result<T, E>` は `Ok<T> | Err<E>` のユニオン型として定義する
- `ok(undefined)` / `err(undefined)` が `Ok<undefined>` / `Err<undefined>` として推論されること（`never` は使わない）
- 外部ライブラリ（neverthrow 等）を追加しないこと

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E021-01**: 開発者が `ok(value)` を呼ぶと `{ success: true, value }` の `Ok<T>` 型が返る
- [ ] **AC-E021-02**: 開発者が `err(error)` を呼ぶと `{ success: false, error }` の `Err<E>` 型が返る
- [ ] **AC-E021-03**: 開発者が `Result<T, E>` 型を引数に取る関数を定義すると、TypeScript が `result.success` による型ナローイングを認識し、`result.value`（Ok 時）および `result.error`（Err 時）に型安全にアクセスできる
- [ ] **AC-E021-04**: 開発者が `shared/result.ts` を `import` するだけで利用でき、外部ライブラリへの依存を追加しない
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `ok`/`err` ヘルパー関数、`Result<T,E>` 型ナローイング | 型推論のテストは `vitest` + TypeScript コンパイルで確認 |
| ドメインロジックテスト | 該当なし | 型定義 Epic のため |
| 統合テスト | 該当なし | 単一ファイルの型定義のため |
| E2E テスト | 該当なし — 理由: 内部型定義ユーティリティ。pnpm build で型検証、vitest でランタイム動作検証 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし — 既存コード構造改善のみ |
| サブドメイン種別 | 汎用（共有ユーティリティ） |

- 参照 Epic 仕様書: ES-021 §Story 21.1
- 参照設計: `docs/requirements/ES-021-error-handling-result.md` §ストーリーと受入基準 / §エラーケース
- 参照 ADR: 該当なし
- 参照コード: `packages/jimmy/src/shared/` — 既存の shared ユーティリティパターンを参考にすること

## 依存

- 先行 Task: なし

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
