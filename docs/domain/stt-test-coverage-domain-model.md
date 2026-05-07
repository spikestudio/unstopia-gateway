<!-- 配置先: docs/domain/stt-test-coverage-domain-model.md -->
# 集約モデル詳細 — ES-028: src/stt テストカバレッジ向上

> テスト専用 Epic のため、本ドキュメントは「テスト対象コード（`stt.ts`）の論理構造」を
> ドメインモデルとして記述する。DB 集約・永続化エンティティではなく、
> `stt.ts` の関数・状態・不変条件を整理することで実装者がテストを書く際のリファレンスとして機能する。

## 設計方針

このEpicはドメインモデルを新規追加するのではなく、既存の `stt.ts` 実装のロジック構造を
ドメイン観点で整理し、テスト設計の根拠ドキュメントとして記述する。

**Phase ドメイン分析成果物との関係:**
- BC キャンバスなし（インフラ/ユーティリティ層として扱う）
- ドメインイベントなし（STT は副作用を持つが、ドメインイベントとして公開するものはない）
- 用語集への追記: 下記「用語追加」セクションに記載

---

## 集約一覧

| 集約名 | 論理的ルート | 責務（1文） |
|--------|------------|------------|
| SttInitService | `initStt()` 操作 | STTモデルディレクトリの存在を保証する |
| ModelRegistry | `getModelPath()` + `MODEL_FILES` + `MODEL_URLS` | モデル名からファイルパス・URLを解決し、モデルの存在を検証する |
| LanguageConfig | `resolveLanguages()` + `SttConfig` 型 | 言語設定を正規化し、後方互換性を保ちながら文字列配列として返す |
| SttStatusAggregator | `getSttStatus()` + `SttStatus` 型 | ダウンロード状態・モデル存在・言語設定を合成した STT 状態を返す |
| DownloadOrchestrator | `downloadModel()` + `downloading` + `downloadProgress` グローバル状態 | モデルのダウンロードを排他制御し、進捗を通知する |
| TranscriptionService | `transcribe()` + `convertToWav()` | 音声ファイルを文字起こしし、非 WAV ファイルを自動変換する |

---

## Entity: SttInitService

### Fields（属性）

| フィールド | 型 | 制約 | 必須 | 対応 AC |
|-----------|---|------|------|--------|
| STT_MODELS_DIR | string (path) | 外部定数（`shared/paths.ts` より取得） | 必須 | AC-E028-01, AC-E028-02 |

### Invariants（不変条件）

- `initStt()` を呼ぶと `STT_MODELS_DIR` が再帰的に作成される（`recursive: true`） — 根拠: AC-E028-01
- `initStt()` を呼ぶとロガーが `STT_MODELS_DIR` パスを含む info ログを出力する — 根拠: AC-E028-02

### Operations（操作の事前/事後条件）

| 操作名 | 事前条件 | 事後条件 | 失敗時の挙動 | 根拠 AC-ID |
|-------|---------|---------|------------|-----------|
| `initStt()` | なし（副作用なし）| `fs.mkdirSync(STT_MODELS_DIR, { recursive: true })` が呼ばれる。ロガーが info ログを出力する | fs エラー時は例外を伝播（テスト対象外） | AC-E028-01, AC-E028-02 |

---

## Entity: ModelRegistry

### Fields（属性）

| フィールド | 型 | 制約 | 必須 | 対応 AC |
|-----------|---|------|------|--------|
| model | string | `MODEL_FILES` のキーであること | 必須 | AC-E028-03, AC-E028-04, AC-E028-05 |
| STT_MODELS_DIR | string (path) | 外部定数 | 必須 | AC-E028-03, AC-E028-04 |

### Invariants（不変条件）

- `getModelPath(model)` は `MODEL_FILES[model]` が存在しない場合 `null` を返す（未知モデル） — 根拠: AC-E028-05
- `getModelPath(model)` は `fs.existsSync` の結果に従い、ファイルが存在すれば絶対パスを、存在しなければ `null` を返す — 根拠: AC-E028-03, AC-E028-04
- パス解決は `path.join(STT_MODELS_DIR, filename)` で行われる — 根拠: AC-E028-03

### Domain Logic（計算式・決定表）

| ロジック名 | 入力 | 出力 | 計算式 / 決定表 | 根拠 AC-ID |
|-----------|-----|------|---------------|-----------|
| モデルパス解決 | model: string | string \| null | 決定表: `MODEL_FILES[model]` が undefined → `null`; `fs.existsSync(path.join(STT_MODELS_DIR, filename))` = false → `null`; それ以外 → `path.join(STT_MODELS_DIR, filename)` | AC-E028-03, AC-E028-04, AC-E028-05 |

### Operations（操作の事前/事後条件）

| 操作名 | 事前条件 | 事後条件 | 失敗時の挙動 | 根拠 AC-ID |
|-------|---------|---------|------------|-----------|
| `getModelPath(model)` | なし | 返り値は string（絶対パス）または null | 失敗なし（純粋に null 返却） | AC-E028-03〜05 |

---

## Entity: LanguageConfig

### Fields（属性）

| フィールド | 型 | 制約 | 必須 | 対応 AC |
|-----------|---|------|------|--------|
| languages | string[] \| undefined | 空配列は「指定なし」と同義 | 任意 | AC-E028-06, AC-E028-10 |
| language | string \| undefined | 後方互換フィールド | 任意 | AC-E028-07 |

### Invariants（不変条件）

- `languages` が空でない配列の場合、それをそのまま返す — 根拠: AC-E028-06
- `languages` が undefined または空配列で `language` が存在する場合、`[language]` を返す（後方互換） — 根拠: AC-E028-07
- `languages` も `language` も存在しない（または両方 undefined/空）場合、`["en"]` をデフォルトとして返す — 根拠: AC-E028-08, AC-E028-09
- `sttConfig` 自体が `undefined` の場合、`["en"]` を返す — 根拠: AC-E028-09
- 空配列 `languages: []` の場合は `language` フォールバックを試み、なければ `["en"]` を返す — 根拠: AC-E028-10

### Domain Logic（計算式・決定表）

| ロジック名 | 入力 | 出力 | 計算式 / 決定表 | 根拠 AC-ID |
|-----------|-----|------|---------------|-----------|
| 言語設定正規化 | sttConfig?: { language?: string; languages?: string[] } | string[] | 優先順位: (1) `languages` が非空配列 → そのまま返す (2) `language` が存在 → `[language]` (3) それ以外（undefined・空配列・空設定）→ `["en"]` | AC-E028-06〜10 |

### Operations（操作の事前/事後条件）

| 操作名 | 事前条件 | 事後条件 | 失敗時の挙動 | 根拠 AC-ID |
|-------|---------|---------|------------|-----------|
| `resolveLanguages(sttConfig?)` | なし（純粋関数） | 戻り値は必ず 1 件以上の string[] | 失敗なし | AC-E028-06〜10 |

---

## Entity: SttStatusAggregator

### Fields（属性）

| フィールド | 型 | 制約 | 必須 | 対応 AC |
|-----------|---|------|------|--------|
| configModel | string \| undefined | 未指定時は `"small"` がデフォルト | 任意 | AC-E028-11, AC-E028-12, AC-E028-13 |
| languages | string[] \| undefined | 未指定時は `["en"]` がデフォルト | 任意 | AC-E028-11, AC-E028-12, AC-E028-13 |

### 返却型 SttStatus

| フィールド | 型 | 説明 |
|-----------|---|------|
| available | boolean | モデルが存在する場合 `true` |
| model | string \| null | モデルが存在する場合はモデル名、存在しない場合は `null` |
| downloading | boolean | グローバル変数 `downloading` の値 |
| progress | number | グローバル変数 `downloadProgress` の値 |
| languages | string[] | 引数 `languages` または `["en"]` |

### Invariants（不変条件）

- `configModel` が未指定の場合、`"small"` をデフォルトモデルとして使用する — 根拠: AC-E028-13
- `languages` が未指定の場合、`["en"]` をデフォルトとして使用する — 根拠: AC-E028-13
- `getModelPath(model)` が non-null を返す場合、`available: true`, `model: configModel` を返す — 根拠: AC-E028-11
- `getModelPath(model)` が `null` を返す場合、`available: false`, `model: null` を返す — 根拠: AC-E028-12

### Domain Logic（計算式・決定表）

| ロジック名 | 入力 | 出力 | 計算式 / 決定表 | 根拠 AC-ID |
|-----------|-----|------|---------------|-----------|
| STT状態構築 | configModel?, languages? | SttStatus | `model = configModel \|\| "small"` → `getModelPath(model)` で存否確認 → SttStatus 構築 | AC-E028-11〜13 |

### Operations（操作の事前/事後条件）

| 操作名 | 事前条件 | 事後条件 | 失敗時の挙動 | 根拠 AC-ID |
|-------|---------|---------|------------|-----------|
| `getSttStatus(configModel?, languages?)` | なし | SttStatus オブジェクトを返す | 失敗なし | AC-E028-11〜13 |

---

## Entity: DownloadOrchestrator

### Fields（属性）

| フィールド | 型 | 制約 | 必須 | 対応 AC |
|-----------|---|------|------|--------|
| model | string | `MODEL_URLS` のキーであること | 必須 | AC-E028-14〜19 |
| onProgress | (progress: number) => void | コールバック関数 | 必須 | AC-E028-14, AC-E028-17 |
| `downloading` (グローバル) | boolean | モジュールレベルの状態変数 | — | AC-E028-15 |
| `downloadProgress` (グローバル) | number | 0〜100 | — | AC-E028-17 |

### Invariants（不変条件）

- `downloading === true` の状態で `downloadModel` を呼ぶと `"Download already in progress"` エラーを throw する — 根拠: AC-E028-15
- `MODEL_URLS[model]` が undefined の場合 `"Unknown model: ${model}"` エラーを throw する — 根拠: AC-E028-16
- モデルが既に存在する場合（`getModelPath` が non-null）、curl を起動せず即座に `onProgress(100)` を呼んで return する（冪等性） — 根拠: AC-E028-14
- ダウンロード失敗時（curl 非ゼロ終了コードまたは error イベント）、一時ファイル（`.downloading` 拡張子）を削除する — 根拠: AC-E028-18, AC-E028-19
- ダウンロード成功後、一時ファイルを最終パスにリネームし `onProgress(100)` を呼ぶ — 根拠: AC-E028-17
- `finally` ブロックで `downloading = false` にリセットする（成否にかかわらず） — 根拠: AC-E028-15, AC-E028-17

### State Machine（状態遷移）

| 遷移元 | イベント | ガード条件 | 遷移先 | 根拠 AC-ID |
|--------|---------|----------|--------|-----------|
| idle | `downloadModel()` 呼び出し | `downloading === false` かつモデル未存在 | downloading | AC-E028-17 |
| idle | `downloadModel()` 呼び出し | モデルが既に存在 | idle（即時完了）| AC-E028-14 |
| idle | `downloadModel()` 呼び出し | `downloading === true` | idle（エラー throw）| AC-E028-15 |
| idle | `downloadModel()` 呼び出し | `MODEL_URLS[model]` なし | idle（エラー throw）| AC-E028-16 |
| downloading | curl close(0) | 常に可 | idle（成功）| AC-E028-17 |
| downloading | curl close(非0) | 常に可 | idle（失敗・クリーンアップ）| AC-E028-18 |
| downloading | curl error イベント | 常に可 | idle（失敗・クリーンアップ）| AC-E028-19 |

### Operations（操作の事前/事後条件）

| 操作名 | 事前条件 | 事後条件 | 失敗時の挙動 | 根拠 AC-ID |
|-------|---------|---------|------------|-----------|
| `downloadModel(model, onProgress)` | `downloading === false` かつ `MODEL_URLS[model]` 存在 | curl が正しい URL と出力先パスで起動、完了後にリネームと `onProgress(100)` | `downloading = false` にリセット後エラーを throw。一時ファイルを削除 | AC-E028-14〜19 |

<!-- AI-UNCERTAIN: 事実不明 - グローバル変数 `downloading` / `downloadProgress` のテスト間リセット方法。
     `vi.resetModules()` でモジュールを再インポートするか `beforeEach` で直接リセットする必要があるが、
     現在の stt.ts は export されていないためテストから直接アクセスできない。
     この未決定事項は Epic 仕様書にも記載済み（未決定事項 #1）。Task 実装時に決定する。 -->

---

## Entity: TranscriptionService

### Fields（属性）

| フィールド | 型 | 制約 | 必須 | 対応 AC |
|-----------|---|------|------|--------|
| audioPath | string | ファイルパス（任意の音声形式。.wav 以外は変換） | 必須 | AC-E028-20, AC-E028-21, AC-E028-22 |
| model | string | `getModelPath` が non-null を返すこと | 必須 | AC-E028-20, AC-E028-22 |
| language | string \| undefined | 省略時は whisper-cli のデフォルト（en）を使用 | 任意 | AC-E028-24 |

### Invariants（不変条件）

- `getModelPath(model)` が `null` の場合、`"Model '${model}' not found. Download it first."` エラーを throw する — 根拠: AC-E028-22
- `.wav` 以外の拡張子の場合、`convertToWav()` で変換してから whisper-cli を実行する — 根拠: AC-E028-21
- `convertToWav()` 後の一時 WAV ファイルは `finally` で削除する — 根拠: AC-E028-21, AC-E028-25
- whisper-cli の出力から空白行・前後空白を除去して結合した文字列を返す — 根拠: AC-E028-20
- `language` 引数が指定された場合、whisper-cli に `-l <language>` を渡す — 根拠: AC-E028-24
- whisper-cli が失敗（reject）した場合エラーを throw する — 根拠: AC-E028-23
- ffmpeg 変換が失敗した場合、一時 WAV ファイルのクリーンアップを行いエラーを throw する — 根拠: AC-E028-25

### Domain Logic（計算式・決定表）

| ロジック名 | 入力 | 出力 | 計算式 / 決定表 | 根拠 AC-ID |
|-----------|-----|------|---------------|-----------|
| 言語引数解決 | language?: string | `-l <lang>` 引数 | language が指定されていれば `-l ${language}` を渡す。未指定時は `"en"` がデフォルト（whisper-cli のデフォルト動作に依存） | AC-E028-24 |
| 出力テキスト正規化 | whisper-cli stdout | string | `stdout.split("\n").map(trim).filter(non-empty).join(" ").trim()` | AC-E028-20 |

### Operations（操作の事前/事後条件）

| 操作名 | 事前条件 | 事後条件 | 失敗時の挙動 | 根拠 AC-ID |
|-------|---------|---------|------------|-----------|
| `transcribe(audioPath, model, language?)` | `getModelPath(model)` が non-null であること | 空白行を除去したテキスト文字列を返す。非 WAV の場合は変換後 WAV を削除する | モデル未存在: エラー throw。whisper-cli 失敗: エラー throw。ffmpeg 失敗: 一時 WAV 削除後エラー throw | AC-E028-20〜25 |
| `convertToWav(inputPath)` (internal) | inputPath がアクセス可能な音声ファイルであること | 同ディレクトリに `.wav` ファイルを生成し、そのパスを返す | ffmpeg 失敗時は execFileAsync が reject → `transcribe` の finally でクリーンアップ | AC-E028-21, AC-E028-25 |

---

## セルフレビュー結果

### consistency チェック

- [x] 全 25 件の AC が Step 1 マッピングマトリクス（`stt-test-coverage-ac-mapping.md`）に記録済み
- [x] ドメインモデルの全エンティティが AC に対応している
- [x] 各不変条件に根拠 AC-ID が明記されている
- [x] 状態遷移（DownloadOrchestrator）は AC-E028-15, AC-E028-17〜19 と整合している
- [x] Fields の制約列がドメインモデルの属性制約と一致している

### completeness チェック

- [x] 全 6 エンティティに Invariants が 1 件以上定義されている
- [x] DownloadOrchestrator（状態数 3 以上）の全遷移にガード条件が定義されている（「常に可」含む）
- [x] 「〜によって決まる」パターンの AC（AC-E028-06〜10, AC-E028-24）に Domain Logic が定義されている
- [x] 全操作に Operations（事後条件・失敗時の挙動）が定義されている
- [x] Step 1 マッピングマトリクスの未マップ AC: 0 件

### FAIL 条件チェック

- [x] Step 1 マッピングマトリクスに未マップ AC なし → PASS
- [x] Invariants 0 件エンティティなし → PASS
- [x] ガード条件未定義の状態遷移なし → PASS

---

## ドメインイベント詳細

このEpicはテスト専用であり、ドメインイベントは発行しない。
`docs/domain/domain-events.md` への追記は不要。

---

## 用語追加

`docs/glossary.md` に以下を追記する:

| 用語 | 定義 | 備考 |
|------|------|------|
| SttModelsDir | STT モデルファイルを格納するディレクトリ（`STT_MODELS_DIR` 定数で参照） | `shared/paths.ts` で定義 |
| WhisperModel | Whisper.cpp で使用する GGML 形式の音声認識モデルファイル（tiny/base/small/medium/large-v3-turbo） | `MODEL_FILES` / `MODEL_URLS` で管理 |
| TranscribeAudio | `transcribe()` 関数による音声文字起こし処理。非 WAV ファイルは ffmpeg で自動変換する | ES-028 で定義 |
