# Task: [ES-028] Story 5 — `downloadModel()` テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #191 |
| Epic 仕様書 | ES-028 |
| Story | S5 |
| Complexity | M |
| PR | #<!-- Step 2 で記入 --> |

## 責務

`downloadModel()` の振る舞いを `fs`・`child_process` モック環境でテストし、モデルダウンロードの各シナリオ（既存スキップ・二重起動防止・未知モデル・正常ダウンロード・curl 失敗・curl エラー）を外部ネットワークなしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/stt/__tests__/stt.test.ts`（TASK-067〜070 で作成したファイルに追記）

対象外（隣接 Task との境界）:

- TASK-067: `initStt` テストは別 Task
- TASK-068: `getModelPath` テストは別 Task（`downloadModel` 内で `getModelPath` が呼ばれるが、`fs.existsSync` モックで間接制御する）
- TASK-072: `transcribe` テストは別 Task

## Epic から委ねられた詳細

- **グローバル変数 `downloading` のリセット**: `downloadModel` はグローバル変数 `downloading` を使用する。テスト間でのステート漏れを防ぐため、`vi.resetModules()` を用いて各テストで `stt.ts` を再インポートするか、`beforeEach` で状態をリセットする方法を実装者が選択する。`vi.resetModules()` を使う場合は動的インポートが必要になる点に注意
- **`progressInterval` タイマーのモック**: `vi.useFakeTimers()` を使い `setInterval` を制御することでテスト実行時間を削減する。`vi.runAllTimers()` / `vi.advanceTimersByTime()` で進捗コールバックを制御する
- **`spawn` モックの構築**: `vi.mock("node:child_process")` を使用し、`spawn` がモック EventEmitter を返すように設定する。`close` イベント（code 0 / code 1）・`error` イベントをそれぞれ発火させてシナリオを再現する
- **`fs.renameSync` / `fs.unlinkSync` の検証**: 正常終了時は `renameSync` が呼ばれること、失敗時は `unlinkSync` が呼ばれることを `expect(vi.mocked(fs.renameSync)).toHaveBeenCalled()` 等で確認する
- **`fs.statSync` のモック（進捗ポーリング）**: `setInterval` 内で呼ばれる `fs.statSync` をモックし、`{ size: 200_000_000 }` 等を返すことで進捗コールバックが正しい値で呼ばれることを確認できる。フェイクタイマー使用時は `vi.advanceTimersByTime(1001)` でポーリングを発火させる

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E028-14**: 既にモデルが存在する状態で `downloadModel("small", cb)` を呼ぶとき、curl を起動せず即座に `cb(100)` を呼んで完了すること
- [ ] **AC-E028-15**: ダウンロード中に再度 `downloadModel("small", cb)` を呼ぶとき、`"Download already in progress"` エラーを throw すること
- [ ] **AC-E028-16**: 未知モデル名（例: `"unknown"`）で `downloadModel("unknown", cb)` を呼ぶとき、`"Unknown model: unknown"` エラーを throw すること
- [ ] **AC-E028-17**: 正常なモデルが未ダウンロードの状態で `downloadModel("small", cb)` を呼ぶとき、curl が正しい URL と出力先パスで起動し、プロセス終了コード 0 でファイルがリネームされて `cb(100)` が呼ばれること
- [ ] **AC-E028-18**: curl が 0 以外の終了コードで終了するとき、エラーを throw し一時ファイルが削除されること
- [ ] **AC-E028-19**: curl がエラーイベント（`error` イベント）を発火するとき、エラーを throw し一時ファイルが削除されること
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E028-14〜19）

### 品質面

- [ ] ユニットテストが追加・通過している（vitest）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `downloadModel` の 6 パターン（AC-E028-14〜19） | `node:fs`・`node:child_process` を vi.mock でモック、vi.useFakeTimers() 使用 |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 外部プロセス依存、ユニットテストで完結 | |

**テスト構造（概要）:**

```ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("node:fs");
vi.mock("node:child_process");

describe("downloadModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // downloading グローバル変数リセット（実装者が方法を選択）
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("既存モデルがある場合は curl を起動せず cb(100) を呼ぶ", async () => { /* ... */ });
  it("ダウンロード中の二重呼び出しは 'Download already in progress' エラー", async () => { /* ... */ });
  it("未知モデルは 'Unknown model: unknown' エラー", async () => { /* ... */ });
  it("正常ダウンロード: curl が正しい引数で起動し renameSync が呼ばれ cb(100) が呼ばれる", async () => { /* ... */ });
  it("curl 終了コード 1: エラー throw かつ unlinkSync 呼び出し", async () => { /* ... */ });
  it("curl error イベント: エラー throw かつ unlinkSync 呼び出し", async () => { /* ... */ });
});
```

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/ユーティリティ層） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-028 Story S5（AC-E028-14〜19）
- 参照設計: `docs/domain/stt-test-coverage-domain-model.md` §Entity: ModelDownloader（Invariants・Domain Logic）
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/stt/stt.ts`（`downloadModel` 関数・グローバル変数 `downloading`・`downloadProgress`）
  - `packages/jimmy/src/shared/paths.ts`（`STT_MODELS_DIR` 定数の定義）

## 依存

- 先行 Task: TASK-068（`fs.existsSync` モックパターンの参照）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E028-14〜19）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（依存なし — テストファイル追記のみ）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
