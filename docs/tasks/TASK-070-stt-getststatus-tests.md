# Task: [ES-028] Story 4 — `getSttStatus()` テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #190 |
| Epic 仕様書 | ES-028 |
| Story | S4 |
| Complexity | S |
| PR | #<!-- Step 2 で記入 --> |

## 責務

`getSttStatus()` の振る舞いを `fs` モック環境でテストし、STT の状態オブジェクトが各条件下（モデル存在・未存在・デフォルト引数）で正しく構築されることを検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/stt/__tests__/stt.test.ts`（TASK-067〜069 で作成したファイルに追記）

対象外（隣接 Task との境界）:

- TASK-068: `getModelPath` テストは別 Task（`getSttStatus` は内部的に `getModelPath` を呼ぶが、モックで制御する）

## Epic から委ねられた詳細

- **`getModelPath` への依存制御**: `getSttStatus` は `getModelPath` を内部で呼ぶ。`vi.mocked(fs.existsSync).mockReturnValue(true/false)` で間接的に制御する（`getModelPath` 自体はモックしない — 実装の内部依存を活かす）
- **グローバル変数 `downloading` / `downloadProgress` のデフォルト値**: テスト開始時点でグローバル変数は `downloading: false`, `downloadProgress: 0` であることを前提とする。他の describe ブロック（`downloadModel` テスト）でリセット漏れがある場合は実装者が対処する
- **`SttStatus` 型の期待値**: `{ available: boolean, model: string | null, downloading: false, progress: 0, languages: string[] }` の形式で `expect().toEqual()` で確認する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E028-11**: モデルが存在する状態で `getSttStatus("small", ["ja"])` を呼ぶとき、`{ available: true, model: "small", downloading: false, progress: 0, languages: ["ja"] }` を返すこと
- [ ] **AC-E028-12**: モデルが存在しない状態で `getSttStatus("small", ["ja"])` を呼ぶとき、`{ available: false, model: null, downloading: false, progress: 0, languages: ["ja"] }` を返すこと
- [ ] **AC-E028-13**: `getSttStatus()` を引数なしで呼ぶとき、デフォルトモデル `"small"` とデフォルト言語 `["en"]` が使用されること
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E028-11〜13）

### 品質面

- [ ] ユニットテストが追加・通過している（vitest）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `getSttStatus`: モデル存在時・未存在時・デフォルト引数の 3 パターン | `node:fs` を vi.mock でモック（existsSync の返り値を制御） |
| ドメインロジックテスト | STT状態構築ロジック（SttStatus 型の構築） | 上記ユニットテストと統合 |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 内部 fs 依存のみ | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/ユーティリティ層） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-028 Story S4（AC-E028-11〜13）
- 参照設計: `docs/domain/stt-test-coverage-domain-model.md` §Entity: SttStatusAggregator（返却型 SttStatus・Invariants）
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/stt/stt.ts`（`getSttStatus` 関数 L118〜128・`SttStatus` インターフェース L100〜106）

## 依存

- 先行 Task: TASK-068（`getModelPath` テストで `fs.existsSync` モックパターンを確立しておくと参照しやすい）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E028-11〜13）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（TASK-068 の fs モックパターン参照のため）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
