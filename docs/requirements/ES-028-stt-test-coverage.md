<!-- 配置先: docs/requirements/ES-028-stt-test-coverage.md — 相対リンクはこの配置先を前提としている -->
# ES-028: src/stt テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #185 |
| Phase 定義書 | PD-003 |
| Epic | E2 |
| 所属 BC | <!-- BC名 → 該当なし（インフラ/ユーティリティ層） --> |
| ADR 参照 | <!-- 該当なし --> |

## 対応ストーリー

<!-- Phase 定義書 PD-003 の E2（src/stt テストカバレッジ向上 Epic）から転記 -->

- S1: `initStt()` のテスト（STT モデルディレクトリを再帰的に作成すること）
- S2: `getModelPath()` のテスト（モデルファイルが存在する/存在しない場合のパス返却）
- S3: `resolveLanguages()` のテスト（設定の各パターン: languages 配列 / language 文字列 / デフォルト）
- S4: `getSttStatus()` のテスト（モデルの存在・ダウンロード状態を反映した SttStatus 返却）
- S5: `downloadModel()` のテスト（curl spawn モック・進捗コールバック・エラー・二重呼び出し防止・既存スキップ）
- S6: `transcribe()` のテスト（whisper-cli 実行・成功/失敗・言語指定・WAV 変換）

## 概要

`packages/jimmy/src/stt/stt.ts` のブランチカバレッジを 0% から 90% 以上に向上させる。
`initStt` / `getModelPath` / `resolveLanguages` / `getSttStatus` / `downloadModel` / `transcribe` の 6 関数を対象として単体テストを実装し、Node.js 組み込みモジュール（`fs`・`child_process`）をモックすることで外部依存なしにテスト可能にする。

## ストーリーと受入基準

### Story 1: initStt() のテスト

> As a **開発者（テスト実行者）**, I want to `initStt()` の振る舞いをモック環境でテストできる, so that STT ディレクトリ初期化ロジックを外部ファイルシステムなしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E028-01**: `initStt()` を呼び出すと `fs.mkdirSync` が `STT_MODELS_DIR` と `{ recursive: true }` を引数として呼ばれること ← S1
- [ ] **AC-E028-02**: `initStt()` を呼び出すとロガーが `STT_MODELS_DIR` を含む info ログを出力すること ← S1（AI 補完: ログ出力の検証は実装の正確性確認に必要）

**インターフェース:** `stt.ts` の `initStt(): void`

---

### Story 2: getModelPath() のテスト

> As a **開発者（テスト実行者）**, I want to `getModelPath()` の振る舞いをモック環境でテストできる, so that モデルファイルの存在確認ロジックを外部ファイルシステムなしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E028-03**: `getModelPath("small")` を呼び出し `fs.existsSync` が `true` を返すとき、モデルファイルの絶対パス文字列（`STT_MODELS_DIR` + `ggml-small.bin`）を返すこと ← S2
- [ ] **AC-E028-04**: `getModelPath("small")` を呼び出し `fs.existsSync` が `false` を返すとき、`null` を返すこと ← S2
- [ ] **AC-E028-05**: `getModelPath("unknown-model")` を呼び出すとき、`null` を返すこと ← S2（AI 補完: 未知モデル名の境界値テストは仕様の完全性に必要）

**インターフェース:** `stt.ts` の `getModelPath(model: string): string | null`

---

### Story 3: resolveLanguages() のテスト

> As a **開発者（テスト実行者）**, I want to `resolveLanguages()` の振る舞いをテストできる, so that 言語設定の各パターンが正しく解決されることを検証できるようにするため.

**受入基準:**

- [ ] **AC-E028-06**: `resolveLanguages({ languages: ["ja", "en"] })` を呼び出すとき、`["ja", "en"]` を返すこと ← S3
- [ ] **AC-E028-07**: `resolveLanguages({ language: "fr" })` を呼び出すとき、後方互換として `["fr"]` を返すこと ← S3
- [ ] **AC-E028-08**: `resolveLanguages({})` を呼び出すとき、デフォルト値として `["en"]` を返すこと ← S3
- [ ] **AC-E028-09**: `resolveLanguages(undefined)` を呼び出すとき、デフォルト値として `["en"]` を返すこと ← S3（AI 補完: undefined 引数のエッジケースは呼び出し側の誤用防止に必要）
- [ ] **AC-E028-10**: `resolveLanguages({ languages: [] })` を呼び出すとき（空配列）、`language` フォールバックか `["en"]` デフォルトが返ること ← S3（AI 補完: 空配列の境界値は実装上のフォールバック分岐を検証するために必要）

**インターフェース:** `stt.ts` の `resolveLanguages(sttConfig?): string[]`（純粋関数）

---

### Story 4: getSttStatus() のテスト

> As a **開発者（テスト実行者）**, I want to `getSttStatus()` の振る舞いをモック環境でテストできる, so that STT の状態オブジェクトが各条件下で正しく構築されることを検証できるようにするため.

**受入基準:**

- [ ] **AC-E028-11**: モデルが存在する状態で `getSttStatus("small", ["ja"])` を呼ぶとき、`{ available: true, model: "small", downloading: false, progress: 0, languages: ["ja"] }` を返すこと ← S4
- [ ] **AC-E028-12**: モデルが存在しない状態で `getSttStatus("small", ["ja"])` を呼ぶとき、`{ available: false, model: null, downloading: false, progress: 0, languages: ["ja"] }` を返すこと ← S4
- [ ] **AC-E028-13**: `getSttStatus()` を引数なしで呼ぶとき、デフォルトモデル `"small"` とデフォルト言語 `["en"]` が使用されること ← S4（AI 補完: デフォルト引数のフォールバック動作の検証は API 正確性に必要）

**インターフェース:** `stt.ts` の `getSttStatus(configModel?, languages?): SttStatus`

---

### Story 5: downloadModel() のテスト

> As a **開発者（テスト実行者）**, I want to `downloadModel()` の振る舞いをモック環境でテストできる, so that モデルダウンロードの各シナリオ（成功・失敗・二重起動防止・スキップ）を外部ネットワークなしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E028-14**: 既にモデルが存在する状態で `downloadModel("small", cb)` を呼ぶとき、curl を起動せず即座に `cb(100)` を呼んで完了すること ← S5
- [ ] **AC-E028-15**: ダウンロード中に再度 `downloadModel("small", cb)` を呼ぶとき、`"Download already in progress"` エラーを throw すること ← S5
- [ ] **AC-E028-16**: 未知モデル名（例: `"unknown"`）で `downloadModel("unknown", cb)` を呼ぶとき、`"Unknown model: unknown"` エラーを throw すること ← S5（AI 補完: 未知モデルの早期エラー検証は仕様境界の明確化に必要）
- [ ] **AC-E028-17**: 正常なモデルが未ダウンロードの状態で `downloadModel("small", cb)` を呼ぶとき、curl が正しい URL と出力先パスで起動し、プロセス終了コード 0 でファイルがリネームされて `cb(100)` が呼ばれること ← S5
- [ ] **AC-E028-18**: curl が 0 以外の終了コードで終了するとき、エラーを throw し一時ファイルが削除されること ← S5（AI 補完: ダウンロード失敗時のクリーンアップは実装上重要な副作用）
- [ ] **AC-E028-19**: curl がエラーイベント（`error` イベント）を発火するとき、エラーを throw し一時ファイルが削除されること ← S5（AI 補完: curl プロセス起動失敗は別のエラーパスであり独立テストが必要）

**インターフェース:** `stt.ts` の `downloadModel(model: string, onProgress: (progress: number) => void): Promise<void>`

---

### Story 6: transcribe() のテスト

> As a **開発者（テスト実行者）**, I want to `transcribe()` の振る舞いをモック環境でテストできる, so that 音声文字起こし処理の各シナリオを外部コマンドなしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E028-20**: モデルが存在し WAV ファイルを引数に `transcribe("audio.wav", "small")` を呼ぶとき、`whisper-cli` が正しい引数で実行され、空白行を除去したテキストが返ること ← S6
- [ ] **AC-E028-21**: WAV 以外のファイル（例: `"audio.mp3"`）を引数に `transcribe("audio.mp3", "small")` を呼ぶとき、まず `ffmpeg` でWAVに変換してから `whisper-cli` が実行され、変換後の WAV ファイルが削除されること ← S6
- [ ] **AC-E028-22**: モデルが存在しない状態で `transcribe("audio.wav", "small")` を呼ぶとき、`"Model 'small' not found."` を含むエラーを throw すること ← S6（AI 補完: モデル未存在の早期エラーは主要なエラーパス）
- [ ] **AC-E028-23**: `whisper-cli` の実行が失敗するとき、エラーを throw すること ← S6（AI 補完: コマンド実行失敗は主要な異常系）
- [ ] **AC-E028-24**: `language` 引数を指定して `transcribe("audio.wav", "small", "ja")` を呼ぶとき、`whisper-cli` に `-l ja` が渡されること ← S6
- [ ] **AC-E028-25**: WAV 変換中に `ffmpeg` が失敗するとき、エラーを throw し、一時 WAV ファイルのクリーンアップが実行されること ← S6（AI 補完: ffmpeg 失敗時のクリーンアップ動作の検証に必要）

**インターフェース:** `stt.ts` の `transcribe(audioPath: string, model: string, language?: string): Promise<string>`

---

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | 該当なし | 該当なし |
| DB スキーマ骨格 | 該当なし | 該当なし |
| API spec 骨格 | 該当なし | 該当なし |

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| `model` (downloadModel) | `MODEL_URLS` に存在するキーであること | `"Unknown model: ${model}"` エラーを throw |
| `model` (transcribe) | `getModelPath` で `null` 以外が返ること | `"Model '${model}' not found. Download it first."` エラーを throw |

## ステータス遷移（該当する場合）

該当なし（テスト追加 Epic のため）

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| ダウンロード二重起動 | `downloading === true` の状態で `downloadModel` を呼ぶ | `"Download already in progress"` エラーを throw | グローバル状態による排他制御 |
| 未知モデル指定 (downloadModel) | `MODEL_URLS[model]` が `undefined` | `"Unknown model: ${model}"` エラーを throw | 早期エラー返却 |
| モデル未存在 (transcribe) | `getModelPath` が `null` を返す | `"Model '${model}' not found."` エラーを throw | 早期エラー返却 |
| curl 失敗 | curl の終了コードが 0 以外 | エラーを throw し一時ファイルを削除 | ダウンロード失敗時のクリーンアップ |
| curl エラーイベント | curl プロセスの `error` イベント発火 | エラーを throw し一時ファイルを削除 | プロセス起動失敗 |
| ffmpeg 失敗 | `execFileAsync(FFMPEG, ...)` が reject | エラーを throw | WAV 変換失敗 |

## 非機能要件

| 項目 | 基準 |
|------|------|
| ブランチカバレッジ | `src/stt/stt.ts` のブランチカバレッジが 90% 以上 |
| 外部依存排除 | テスト実行時に `fs`・`child_process` のモックを使用し、実ファイルシステム・ネットワーク・外部プロセスに依存しないこと |
| テスト実行時間 | 全テストが 5 秒以内に完了すること |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | Phase 3 以降の開発者（src/stt の機能変更・拡張を行う人） |
| デリバリーする価値 | src/stt のコード変更が既存動作を壊していないことを CI で自動検証できるようになる。外部依存（ファイルシステム・curl・ffmpeg・whisper-cli）のモックにより高速・安定したテストが実行可能になる |
| デモシナリオ | `pnpm test` を実行して src/stt のブランチカバレッジが 90% 以上であることを coverage レポートで確認する |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | `pnpm test` でテストが全件 PASS し、`pnpm test -- --coverage` で src/stt のブランチカバレッジが 90% 以上であること |
| 検証環境 | ローカル環境（Node.js + vitest）。外部コマンド（curl/ffmpeg/whisper-cli）は vi.mock でモック |
| 前提条件 | `packages/jimmy` の依存インストール済み（`pnpm install`）。vitest がインストール済み |

## 他 Epic への依存・影響

- Phase 3 の全体カバレッジ目標（90%）達成に貢献する
- src/stt を利用する他モジュール（gateway 等）のテストとは独立

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `downloadModel` のグローバル変数（`downloading`, `downloadProgress`）のリセット方法（テスト間でのステート漏れ対策） | 未決定 | Task 実装時に `vi.resetModules()` または `beforeEach` でのモジュール再インポートを検討 |
| 2 | `progressInterval` のタイマーのモック方法 | 未決定 | Task 実装時に `vi.useFakeTimers()` の使用を検討 |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている
- [ ] ステータス遷移が図示されている（該当する場合）← 該当なし
- [x] 権限が各操作で明記されている（テスト Epic のため権限なし）
- [ ] 関連 ADR が参照されている ← 該当なし
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-ENNN-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [ ] 所属 BC が記載され、BC キャンバスが docs/domain/ に存在する ← 該当なし（インフラ層）
- [x] 設計成果物セクションが記入されている（該当なしを含む）
