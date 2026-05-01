# Task: [ES-028] Story 6 — `transcribe()` テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #192 |
| Epic 仕様書 | ES-028 |
| Story | S6 |
| Complexity | M |
| PR | #<!-- Step 2 で記入 --> |

## 責務

`transcribe()` の振る舞いを `fs`・`child_process` モック環境でテストし、音声文字起こし処理の各シナリオ（WAV 直接処理・ffmpeg 変換・モデル未存在・whisper-cli 失敗・言語指定・ffmpeg 失敗）を外部コマンドなしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/stt/__tests__/stt.test.ts`（TASK-067〜071 で作成したファイルに追記）

対象外（隣接 Task との境界）:

- TASK-068: `getModelPath` テストは別 Task（`transcribe` は内部的に `getModelPath` を呼ぶが、`fs.existsSync` モックで間接制御する）
- TASK-071: `downloadModel` テストは別 Task

## Epic から委ねられた詳細

- **`execFileAsync` のモック方法**: `promisify(execFile)` で生成された `execFileAsync` をモックするには、`vi.mock("node:child_process")` で `execFile` をモックする。`vi.mocked(execFile).mockImplementation()` で `stdout` 付きの resolve / reject を制御する
- **`whisper-cli` の出力のクリーン処理検証**: `execFileAsync` が `{ stdout: "  Hello World\n\nFoo  \n" }` を返すとき、`transcribe` の返り値が `"Hello World Foo"` になることを確認する（空白行除去・trim・join の動作検証）
- **非 WAV ファイルの ffmpeg 変換フロー**: `audioPath.endsWith(".wav")` が `false` の場合に `execFileAsync(FFMPEG, ...)` が呼ばれることを確認する。`ffmpeg` 呼び出し後に `whisper-cli` が呼ばれ、最後に `fs.unlinkSync` で一時 WAV ファイルが削除されることを検証する
- **ffmpeg 失敗時のクリーンアップ**: `execFileAsync(FFMPEG, ...)` が reject した場合、エラーが throw され一時 WAV ファイルの `fs.unlinkSync` が呼ばれることを確認する（`finally` ブロックの動作）
- **モデルパス確認**: `fs.existsSync` を `false` を返すようにモックし、`getModelPath` が `null` を返す状態で `transcribe` を呼び出すと `"Model 'small' not found."` エラーを throw することを確認する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E028-20**: モデルが存在し WAV ファイルを引数に `transcribe("audio.wav", "small")` を呼ぶとき、`whisper-cli` が正しい引数で実行され、空白行を除去したテキストが返ること
- [ ] **AC-E028-21**: WAV 以外のファイル（例: `"audio.mp3"`）を引数に `transcribe("audio.mp3", "small")` を呼ぶとき、まず `ffmpeg` でWAVに変換してから `whisper-cli` が実行され、変換後の WAV ファイルが削除されること
- [ ] **AC-E028-22**: モデルが存在しない状態で `transcribe("audio.wav", "small")` を呼ぶとき、`"Model 'small' not found."` を含むエラーを throw すること
- [ ] **AC-E028-23**: `whisper-cli` の実行が失敗するとき、エラーを throw すること
- [ ] **AC-E028-24**: `language` 引数を指定して `transcribe("audio.wav", "small", "ja")` を呼ぶとき、`whisper-cli` に `-l ja` が渡されること
- [ ] **AC-E028-25**: WAV 変換中に `ffmpeg` が失敗するとき、エラーを throw し、一時 WAV ファイルのクリーンアップが実行されること
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E028-20〜25）

### 品質面

- [ ] ユニットテストが追加・通過している（vitest）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `transcribe` の 6 パターン（AC-E028-20〜25） | `node:fs`・`node:child_process` を vi.mock でモック |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 外部コマンド（whisper-cli・ffmpeg）依存、ユニットテストで完結 | |

**テスト構造（概要）:**

```ts
describe("transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("WAV ファイルで whisper-cli が正しい引数で呼ばれ空白行除去テキストが返る", async () => { /* ... */ });
  it("非 WAV ファイルで ffmpeg 変換後 whisper-cli が呼ばれ一時ファイルが削除される", async () => { /* ... */ });
  it("モデル未存在で 'Model small not found.' エラー", async () => { /* ... */ });
  it("whisper-cli 失敗でエラー throw", async () => { /* ... */ });
  it("language 引数 'ja' が whisper-cli に -l ja として渡される", async () => { /* ... */ });
  it("ffmpeg 失敗でエラー throw かつ一時 WAV ファイルが削除される", async () => { /* ... */ });
});
```

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/ユーティリティ層） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-028 Story S6（AC-E028-20〜25）
- 参照設計: `docs/domain/stt-test-coverage-domain-model.md` §Entity: TranscriptionService（Invariants・Domain Logic）
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/stt/stt.ts`（`transcribe` 関数・`convertToWav` 内部関数・`execFileAsync` の使用箇所）
  - `packages/jimmy/src/shared/paths.ts`（`STT_MODELS_DIR` 定数の定義）

## 依存

- 先行 Task: TASK-068（`getModelPath` → `fs.existsSync` モックパターンの参照）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E028-20〜25）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（依存なし — テストファイル追記のみ）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
