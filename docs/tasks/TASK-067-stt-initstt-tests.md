# Task: [ES-028] Story 1 — `initStt()` テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #187 |
| Epic 仕様書 | ES-028 |
| Story | S1 |
| Complexity | S |
| PR | #<!-- Step 2 で記入 --> |

## 責務

`initStt()` の振る舞いを `fs` モック環境でテストし、STT ディレクトリ初期化ロジックの正確性を外部ファイルシステムなしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/stt/__tests__/stt.test.ts`（新規作成 or 追記）

対象外（隣接 Task との境界）:

- TASK-068: `getModelPath` テストは別 Task
- TASK-069: `resolveLanguages` テストは別 Task
- TASK-070: `getSttStatus` テストは別 Task
- TASK-071: `downloadModel` テストは別 Task
- TASK-072: `transcribe` テストは別 Task

## Epic から委ねられた詳細

- **`fs` モックの方法**: `vi.mock("node:fs")` を使用し、`fs.mkdirSync` をスパイとして設定する
- **ロガーモックの方法**: `vi.mock` で `../shared/logger.js` をモックし `logger.info` をスパイとして設定する
- **テストファイルの配置**: `packages/jimmy/src/stt/__tests__/stt.test.ts` を新規作成する。`describe("initStt")` ブロック内に記述する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E028-01**: `initStt()` を呼び出すと `fs.mkdirSync` が `STT_MODELS_DIR` と `{ recursive: true }` を引数として呼ばれること
- [ ] **AC-E028-02**: `initStt()` を呼び出すとロガーが `STT_MODELS_DIR` を含む info ログを出力すること
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E028-01〜02）

### 品質面

- [ ] ユニットテストが追加・通過している（vitest）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `initStt()`: `fs.mkdirSync` 呼び出し確認 / `logger.info` 呼び出し確認 | `node:fs` と logger を vi.mock でモック |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 外部依存なし、ユニットテストで完結 | |

**テスト構造:**

```ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";

vi.mock("node:fs");
vi.mock("../shared/logger.js", () => ({ logger: { info: vi.fn() } }));

describe("initStt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("STT_MODELS_DIR を recursive:true で mkdirSync する", () => {
    const { initStt } = await import("../stt.js");
    initStt();
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining(""), { recursive: true });
  });

  it("STT_MODELS_DIR を含む info ログを出力する", () => {
    const { logger } = await import("../shared/logger.js");
    const { initStt } = await import("../stt.js");
    initStt();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(/* STT_MODELS_DIR */));
  });
});
```

注意: `STT_MODELS_DIR` は `shared/paths.ts` でモジュールロード時に確定する定数。実際の値は `vi.mocked` や定数インポートで参照する。

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/ユーティリティ層） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-028 Story S1（AC-E028-01〜02）
- 参照設計: `docs/domain/stt-test-coverage-domain-model.md` §Entity: SttInitService
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/stt/stt.ts`（`initStt` 関数・`STT_MODELS_DIR` 使用箇所）
  - `packages/jimmy/src/shared/paths.ts`（`STT_MODELS_DIR` 定数の定義）
  - `packages/jimmy/src/shared/logger.ts`（`logger` の定義）

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E028-01〜02）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（依存なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
