<!-- 配置先: docs/domain/stt-test-coverage-ac-mapping.md -->
# AC-ドメイン要素マッピングマトリクス — ES-028: src/stt テストカバレッジ向上

## 概要

このドキュメントは ES-028 の全 AC をパターン分類し、対応するドメイン要素にマッピングしたものです。

**テスト専用 Epic の解釈方針:**
このEpicはテストコードを追加するものです。ACは「テストが〜を検証すること」という形式ですが、
ドメイン要素としては**テスト対象関数に存在するビジネスロジック**を対象として分析します。
テスト自体はドメインモデルを持たず、テスト対象コード（`stt.ts`）の関数とその振る舞いが
ドメイン要素に相当します。

---

## パターン分類テーブル

| AC-ID | AC 概要 | 分類パターン |
|-------|---------|------------|
| AC-E028-01 | `initStt()` を呼ぶと `fs.mkdirSync` が `STT_MODELS_DIR` と `{ recursive: true }` で呼ばれる | 操作 |
| AC-E028-02 | `initStt()` を呼ぶとロガーが `STT_MODELS_DIR` を含む info ログを出力する | 操作 |
| AC-E028-03 | `getModelPath("small")` で `fs.existsSync` が `true` → モデルファイルの絶対パスを返す | 計算ロジック（+ 操作） |
| AC-E028-04 | `getModelPath("small")` で `fs.existsSync` が `false` → `null` を返す | 計算ロジック（+ 操作） |
| AC-E028-05 | `getModelPath("unknown-model")` → `null` を返す | 操作（+ 不変条件） |
| AC-E028-06 | `resolveLanguages({ languages: ["ja", "en"] })` → `["ja", "en"]` を返す | 計算ロジック |
| AC-E028-07 | `resolveLanguages({ language: "fr" })` → 後方互換として `["fr"]` を返す | 計算ロジック（+ 不変条件） |
| AC-E028-08 | `resolveLanguages({})` → デフォルト値として `["en"]` を返す | 計算ロジック（+ 不変条件） |
| AC-E028-09 | `resolveLanguages(undefined)` → デフォルト値として `["en"]` を返す | 計算ロジック（+ 不変条件） |
| AC-E028-10 | `resolveLanguages({ languages: [] })` → `language` フォールバックか `["en"]` デフォルト | 計算ロジック（+ 不変条件） |
| AC-E028-11 | モデル存在時 `getSttStatus("small", ["ja"])` → `{ available: true, ... }` を返す | 計算ロジック（+ 操作） |
| AC-E028-12 | モデル未存在時 `getSttStatus("small", ["ja"])` → `{ available: false, model: null, ... }` を返す | 計算ロジック（+ 操作） |
| AC-E028-13 | `getSttStatus()` 引数なし → デフォルトモデル `"small"` とデフォルト言語 `["en"]` が使用される | 不変条件（+ 計算ロジック） |
| AC-E028-14 | モデル存在時 `downloadModel("small", cb)` → curl 起動せず即座に `cb(100)` を呼んで完了 | 操作（+ 不変条件） |
| AC-E028-15 | ダウンロード中に再度 `downloadModel("small", cb)` → `"Download already in progress"` を throw | 不変条件 |
| AC-E028-16 | 未知モデル名で `downloadModel("unknown", cb)` → `"Unknown model: unknown"` を throw | 不変条件（+ バリデーション） |
| AC-E028-17 | 正常未ダウンロード時 `downloadModel("small", cb)` → curl が正しい URL と出力先で起動 → リネーム → `cb(100)` | 操作 |
| AC-E028-18 | curl が 0 以外の終了コードで終了 → エラー throw し一時ファイルが削除 | 操作（+ 不変条件） |
| AC-E028-19 | curl が `error` イベント発火 → エラー throw し一時ファイルが削除 | 操作（+ 不変条件） |
| AC-E028-20 | WAV ファイルで `transcribe("audio.wav", "small")` → whisper-cli 正しい引数で実行、空白行除去テキスト返却 | 操作 |
| AC-E028-21 | WAV 以外 `"audio.mp3"` で `transcribe` → ffmpeg で WAV 変換後 whisper-cli 実行、変換後 WAV 削除 | 操作（+ 不変条件） |
| AC-E028-22 | モデル未存在時 `transcribe("audio.wav", "small")` → `"Model 'small' not found."` を throw | 不変条件 |
| AC-E028-23 | `whisper-cli` 実行失敗 → エラーを throw | 操作（+ 不変条件） |
| AC-E028-24 | `language` 引数指定で `transcribe("audio.wav", "small", "ja")` → whisper-cli に `-l ja` が渡される | 操作（+ 計算ロジック） |
| AC-E028-25 | WAV 変換中に ffmpeg 失敗 → エラー throw し一時 WAV クリーンアップ | 操作（+ 不変条件） |

---

## AC-ドメイン要素マッピングマトリクス

| AC-ID | AC 概要 | ドメイン要素 | 要素種別 |
|-------|---------|------------|---------|
| AC-E028-01 | `initStt()` — `fs.mkdirSync` が `STT_MODELS_DIR` と `{ recursive: true }` で呼ばれる | SttService.initStt | 操作（事後条件: mkdirSync が正しい引数で呼ばれる） |
| AC-E028-02 | `initStt()` — ロガーが `STT_MODELS_DIR` を含む info ログを出力 | SttService.initStt | 操作（事後条件: info ログが出力される） |
| AC-E028-03 | `getModelPath("small")` — existsSync=true → 絶対パス返却 | SttService.getModelPath | 計算ロジック（存在確認 → パス解決） |
| AC-E028-04 | `getModelPath("small")` — existsSync=false → null 返却 | SttService.getModelPath | 計算ロジック（不在 → null） |
| AC-E028-05 | `getModelPath("unknown-model")` → null 返却 | SttService.getModelPath（ModelRegistry.lookup） | 操作（未知モデル → null） |
| AC-E028-06 | `resolveLanguages({ languages: ["ja", "en"] })` → `["ja", "en"]` | SttConfig.resolveLanguages | 計算ロジック（languages 配列優先） |
| AC-E028-07 | `resolveLanguages({ language: "fr" })` → `["fr"]`（後方互換） | SttConfig.resolveLanguages | 計算ロジック（後方互換フォールバック） |
| AC-E028-08 | `resolveLanguages({})` → `["en"]`（デフォルト） | SttConfig.resolveLanguages | 計算ロジック（デフォルト値） |
| AC-E028-09 | `resolveLanguages(undefined)` → `["en"]`（デフォルト） | SttConfig.resolveLanguages | 計算ロジック（undefined 入力のデフォルト） |
| AC-E028-10 | `resolveLanguages({ languages: [] })` → language フォールバックか `["en"]` | SttConfig.resolveLanguages | 計算ロジック（空配列フォールバック） |
| AC-E028-11 | モデル存在時 `getSttStatus` → `{ available: true, model: "small", downloading: false, ... }` | SttService.getSttStatus | 計算ロジック（ステータス構築） |
| AC-E028-12 | モデル未存在時 `getSttStatus` → `{ available: false, model: null, ... }` | SttService.getSttStatus | 計算ロジック（ステータス構築） |
| AC-E028-13 | `getSttStatus()` 引数なし → デフォルト `"small"`, `["en"]` 使用 | SttService.getSttStatus | 不変条件（デフォルト引数保証） |
| AC-E028-14 | モデル存在時 `downloadModel` → curl 起動せず `cb(100)` 即時完了 | SttService.downloadModel（DownloadState） | 操作（既存スキップ: 冪等性保証） |
| AC-E028-15 | ダウンロード中に再 `downloadModel` → `"Download already in progress"` throw | DownloadState.downloading | 不変条件（排他制御） |
| AC-E028-16 | 未知モデル `downloadModel("unknown", cb)` → `"Unknown model: unknown"` throw | ModelRegistry.validate | 不変条件（モデル存在チェック） |
| AC-E028-17 | 正常未ダウンロード時 `downloadModel` → curl 起動 → リネーム → `cb(100)` | SttService.downloadModel | 操作（正常系ダウンロードフロー） |
| AC-E028-18 | curl 終了コード非0 → エラー throw、一時ファイル削除 | SttService.downloadModel（CleanupLogic） | 操作（失敗時クリーンアップ） |
| AC-E028-19 | curl error イベント → エラー throw、一時ファイル削除 | SttService.downloadModel（CleanupLogic） | 操作（プロセス起動失敗クリーンアップ） |
| AC-E028-20 | WAV ファイルで `transcribe` → whisper-cli 正引数、空白行除去テキスト返却 | SttService.transcribe | 操作（正常系文字起こし） |
| AC-E028-21 | MP3 等で `transcribe` → ffmpeg WAV 変換 → whisper-cli → 変換 WAV 削除 | SttService.transcribe（AudioConverter） | 操作（WAV 変換フロー） |
| AC-E028-22 | モデル未存在時 `transcribe` → `"Model 'small' not found."` throw | SttService.transcribe | 不変条件（モデル存在前提） |
| AC-E028-23 | whisper-cli 実行失敗 → エラー throw | SttService.transcribe | 操作（失敗時エラー伝播） |
| AC-E028-24 | `language` 指定で `transcribe` → whisper-cli に `-l ja` 渡される | SttService.transcribe（LanguageArg） | 操作（言語オプション適用） |
| AC-E028-25 | ffmpeg 失敗 → エラー throw、一時 WAV クリーンアップ | SttService.transcribe（AudioConverter） | 操作（ffmpeg 失敗時クリーンアップ） |

---

## セルフレビュー結果

### completeness チェック

- [x] 全 25 件の AC がマッピングマトリクスに記録されている（漏れゼロ）
- [x] 「該当なし」の AC は存在しない（全 AC にドメイン要素が紐付く）
- [x] 同一ドメイン要素に複数 AC が紐づく箇所（例: SttService.downloadModel の CleanupLogic）で矛盾なし

### ドメイン要素の整理

このEpicで識別されたドメイン要素（`stt.ts` 内の論理的な単位）:

| ドメイン要素 | 要素種別 | 関連 AC 数 |
|------------|---------|----------|
| SttService.initStt | 操作 | 2件 (AC-E028-01, 02) |
| SttService.getModelPath | 計算ロジック + 操作 | 3件 (AC-E028-03, 04, 05) |
| SttConfig.resolveLanguages | 計算ロジック | 5件 (AC-E028-06〜10) |
| SttService.getSttStatus | 計算ロジック + 不変条件 | 3件 (AC-E028-11, 12, 13) |
| SttService.downloadModel | 操作 + 不変条件 | 6件 (AC-E028-14〜19) |
| DownloadState.downloading | 不変条件 | 1件 (AC-E028-15) ※downloadModel 内含む |
| ModelRegistry.validate | 不変条件 | 1件 (AC-E028-16) ※downloadModel 内含む |
| CleanupLogic (download) | 操作 | 2件 (AC-E028-18, 19) ※downloadModel 内含む |
| SttService.transcribe | 操作 + 不変条件 | 6件 (AC-E028-20〜25) |
| AudioConverter | 操作 | 2件 (AC-E028-21, 25) ※transcribe 内含む |

<!-- AI-UNCERTAIN: 優劣不明 - テスト専用 Epic のドメイン要素粒度について。
     テストEpicでは「テスト対象コードの論理単位」をドメイン要素と見なす方針を採ったが、
     「テスト設計そのものをドメインとして扱う」という別解釈もありうる。
     採用方針: テスト対象コードのビジネスロジック単位を元にマッピングする（テストの記述単位ではなく）。
     これにより Step 2 のドメインモデル詳細が stt.ts の実装と整合するよう設計できる。 -->
