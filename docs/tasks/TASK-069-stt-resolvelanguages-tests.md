# Task: [ES-028] Story 3 — `resolveLanguages()` テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #189 |
| Epic 仕様書 | ES-028 |
| Story | S3 |
| Complexity | S |
| PR | #<!-- Step 2 で記入 --> |

## 責務

`resolveLanguages()` の振る舞いをテストし、言語設定の各パターン（`languages` 配列 / `language` 文字列 / デフォルト / undefined / 空配列）が正しく解決されることを検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/stt/__tests__/stt.test.ts`（TASK-067/068 で作成したファイルに追記）

対象外（隣接 Task との境界）:

- TASK-067: `initStt` テストは別 Task
- TASK-068: `getModelPath` テストは別 Task

## Epic から委ねられた詳細

- **純粋関数のテスト**: `resolveLanguages` は純粋関数であり、モックは不要。引数を変えながら返り値を `expect(...).toEqual(...)` で確認する
- **空配列 AC-E028-10 の期待値**: `resolveLanguages({ languages: [] })` の期待値は「`language` フォールバックか `["en"]` デフォルト」。実装（`stt.ts` L113）を確認すると `languages.length > 0` が偽になるため `language` フォールバックを試み、なければ `["en"]` を返す。`{ languages: [] }` で `language` も未指定の場合は `["en"]` が期待値となる

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E028-06**: `resolveLanguages({ languages: ["ja", "en"] })` を呼び出すとき、`["ja", "en"]` を返すこと
- [ ] **AC-E028-07**: `resolveLanguages({ language: "fr" })` を呼び出すとき、後方互換として `["fr"]` を返すこと
- [ ] **AC-E028-08**: `resolveLanguages({})` を呼び出すとき、デフォルト値として `["en"]` を返すこと
- [ ] **AC-E028-09**: `resolveLanguages(undefined)` を呼び出すとき、デフォルト値として `["en"]` を返すこと
- [ ] **AC-E028-10**: `resolveLanguages({ languages: [] })` を呼び出すとき（空配列）、`language` フォールバックか `["en"]` デフォルトが返ること
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E028-06〜10）

### 品質面

- [ ] ユニットテストが追加・通過している（vitest）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `resolveLanguages` の全 5 パターン（AC-E028-06〜10） | モック不要（純粋関数） |
| ドメインロジックテスト | 言語設定正規化の決定表（優先順位: languages > language > default） | 上記ユニットテストと統合 |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 純粋関数、外部依存なし | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/ユーティリティ層） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-028 Story S3（AC-E028-06〜10）
- 参照設計: `docs/domain/stt-test-coverage-domain-model.md` §Entity: LanguageConfig（Domain Logic: 言語設定正規化の決定表）
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/stt/stt.ts`（`resolveLanguages` 関数、L112〜116）

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E028-06〜10）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（依存なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
