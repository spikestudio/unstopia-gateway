# Task: [ES-027] Story 1 — gateway-server.ts MCP プロトコルハンドリングテスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #178 |
| Epic 仕様書 | ES-027 |
| Story | S1 |
| Complexity | M |
| PR | #177 |

## 責務

`gateway-server.ts` の `handleRequest` 関数に対して、MCP プロトコルハンドリング（initialize / tools/list / tools/call の正常系 / notifications/initialized / 未知メソッド）をユニットテストで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/mcp/__tests__/gateway-server.test.ts`（新規作成）

対象外（隣接 Task との境界）:

- TASK-061: 各ツールハンドラーの詳細テスト（tools/call 経由の 12 ツールは別 Task）
- TASK-062: ツールハンドラー例外・API 非 2xx などのエラーハンドリングは別 Task

## Epic から委ねられた詳細

- **handleRequest の直接呼び出し方式**: `process.stdin` / `rl.on("line")` への依存を避けるため、`handleRequest` 関数をモジュール外部からインポートして直接呼び出す。`gateway-server.ts` は現状 export がないため、テスト用に `export function handleRequest` と `export function sendResponse` を追加する（または `vi.spyOn` でモジュール内部を観測する）
- **sendResponse のスパイ**: `process.stdout.write` をモックするか、`sendResponse` 関数自体を `vi.spyOn` して呼び出し引数を観測する
- **AC-E027-04（通知への無応答）の検証方法**: `sendResponse` が呼ばれないことを `vi.spyOn` の `not.toHaveBeenCalled()` で確認する
- **fetch のモック**: `tools/call` の正常系（AC-E027-03）では `vi.fn()` で fetch をモックし、ツールハンドラーが API 呼び出しを行うことを前提とする

## 完了条件

**機能面（AC-ID 参照）:**

- [x] **AC-E027-01**: `initialize` リクエストを送信すると、`protocolVersion: "2024-11-05"`・`capabilities.tools: {}`・`serverInfo.name: "unstopia-gateway"` を含む JSON-RPC レスポンスが返る
- [x] **AC-E027-02**: `tools/list` リクエストを送信すると、12 個のツール定義（name・description・inputSchema を含む）が `result.tools` 配列に返る
- [x] **AC-E027-03**: `tools/call` リクエストで有効なツール名と引数を送信すると、`result.content[0].type === "text"` のレスポンスが返る
- [x] **AC-E027-04**: `notifications/initialized` を送信すると、`sendResponse` が呼ばれない（stdout への書き込みが発生しない）
- [x] **AC-E027-05**: 未知のメソッドを送信すると、`error.code: -32601`（Method not found）を含む JSON-RPC エラーレスポンスが返る
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E027-01〜05）

### 品質面

- [x] ユニットテストが追加・通過している（vitest）
- [x] コードレビューが承認されている
- [x] CI パイプラインがグリーン
- [x] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `handleRequest`: initialize / tools/list / tools/call / notifications/initialized / 未知メソッド | `sendResponse` を vi.spyOn でモック |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: ユニットテストで全分岐をカバーできるため | |

**テストファイル配置**: `packages/jimmy/src/mcp/__tests__/gateway-server.test.ts`

**モック方針**:

```ts
import { vi } from "vitest";
// process.stdout.write をモックして sendResponse の出力を観測
vi.spyOn(process.stdout, "write").mockImplementation(() => true);
// fetch をモック（tools/call テスト用）
global.fetch = vi.fn();
```

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（テスト専用 Epic） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-027 Story S1（AC-E027-01〜05）
- 参照設計: `docs/domain/mcp-test-coverage-ac-mapping.md` §Part 2（AC-E027-01〜05 ドメイン要素マッピング）
- 参照 ADR: 該当なし
- 参照コード: `packages/jimmy/src/mcp/gateway-server.ts`（`handleRequest`・`sendResponse`・`TOOLS` 定数）

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E027-01〜05）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（依存なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
