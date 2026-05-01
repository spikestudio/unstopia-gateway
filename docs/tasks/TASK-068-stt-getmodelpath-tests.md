# Task: [ES-028] Story 2 — `getModelPath()` テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #188 |
| Epic 仕様書 | ES-028 |
| Story | S2 |
| Complexity | S |
| PR | #<!-- Step 2 で記入 --> |

## 責務

`getModelPath()` の振る舞いを `fs` モック環境でテストし、モデルファイルの存在確認ロジックを外部ファイルシステムなしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/stt/__tests__/stt.test.ts`（TASK-067 で作成したファイルに追記）

対象外（隣接 Task との境界）:

- TASK-067: `initStt` テストは別 Task
- TASK-070: `getSttStatus` は `getModelPath` を内部で使うが、そのテストは別 Task

## Epic から委ねられた詳細

- **`fs.existsSync` モックの切り替え**: `vi.mocked(fs.existsSync).mockReturnValue(true/false)` を使用して各テストケースに応じた返り値を設定する
- **`MODEL_FILES` のキー対応確認**: `"small"` は `MODEL_FILES["small"]` に対応するファイル名（`ggml-small.bin`）が存在することを前提とする。`"unknown-model"` は `MODEL_FILES` に存在しないキーであることを確認する
- **パス結合の検証**: `STT_MODELS_DIR + "/" + ggml-small.bin` が返り値に一致することを確認する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E028-03**: `getModelPath("small")` を呼び出し `fs.existsSync` が `true` を返すとき、モデルファイルの絶対パス文字列（`STT_MODELS_DIR` + `ggml-small.bin`）を返すこと
- [ ] **AC-E028-04**: `getModelPath("small")` を呼び出し `fs.existsSync` が `false` を返すとき、`null` を返すこと
- [ ] **AC-E028-05**: `getModelPath("unknown-model")` を呼び出すとき、`null` を返すこと
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E028-03〜05）

### 品質面

- [ ] ユニットテストが追加・通過している（vitest）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `getModelPath("small")` ×2 パターン（existsSync true/false）/ `getModelPath("unknown-model")` | `node:fs` を vi.mock でモック |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 純粋な計算ロジック + fs 参照、ユニットテストで完結 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/ユーティリティ層） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-028 Story S2（AC-E028-03〜05）
- 参照設計: `docs/domain/stt-test-coverage-domain-model.md` §Entity: ModelRegistry（モデルパス解決の決定表）
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/stt/stt.ts`（`getModelPath` 関数・`MODEL_FILES` 定数）
  - `packages/jimmy/src/shared/paths.ts`（`STT_MODELS_DIR` 定数の定義）

## 依存

- 先行 Task: --（`stt.ts` への変更なし、テストファイル追記のみ）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E028-03〜05）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（依存なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
