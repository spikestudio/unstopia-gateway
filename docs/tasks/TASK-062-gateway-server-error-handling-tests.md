# Task: [ES-027] Story 6 — gateway-server.ts エラーハンドリングテスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #180 |
| Epic 仕様書 | ES-027 |
| Story | S6 |
| Complexity | M |
| PR | #TBD |

## 責務

`gateway-server.ts` のエラーハンドリング（存在しないツール・ツール例外・API 非 2xx・trigger_cron_job not-found）をユニットテストで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/mcp/__tests__/gateway-server.test.ts`（TASK-060/061 で作成済みのファイルに追記）

対象外（隣接 Task との境界）:

- TASK-060: MCP プロトコル層のエラー（-32601 等）は別 Task
- TASK-061: 正常系の 12 ツールハンドラーは別 Task

## Epic から委ねられた詳細

- **AC-E027-34（存在しないツール名）**: `handleTool("unknown_tool", {})` を呼び出すと `Error: Unknown tool: unknown_tool` がスローされ、`tools/call` ハンドラーで `result.isError: true` として応答される
- **AC-E027-35（ツールハンドラー例外）**: `fetch` が `reject` するようにモックし、ツールハンドラーが例外をスローするケースを検証する。`result.isError: true` かつ例外メッセージが `content[0].text` に含まれること
- **AC-E027-36（API 非 2xx）**: `fetch` が `ok: false` のレスポンスを返すようにモックし、`apiGet`/`apiPost`/`apiPut` が例外をスローして `result.isError: true` になることを検証する
- **AC-E027-37（trigger_cron_job not-found）**: `/api/cron` が空配列を返すようにモックし、存在しない jobId で `trigger_cron_job` を呼び出すと `{ error: "Job \"nonexistent\" not found" }` を含む JSON が返ることを確認する。実装は例外ではなく通常 result を返す点に注意

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E027-34**: 存在しないツール名で `tools/call` を呼び出すと、`result.isError: true` かつエラーメッセージを含む `content[0].text` が返る
- [ ] **AC-E027-35**: ツールハンドラーが例外をスローしたとき、`result.isError: true` かつ例外メッセージが `content[0].text` に含まれる
- [ ] **AC-E027-36**: gateway API が非 2xx レスポンスを返したとき、ツール呼び出しが `result.isError: true` のレスポンスを返す
- [ ] **AC-E027-37**: `trigger_cron_job` で存在しない jobId を指定すると `error: "Job not found"` を含む JSON が返る
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E027-34〜37）

### 品質面

- [ ] ユニットテストが追加・通過している（vitest）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `handleRequest["tools/call"]` のエラーパス: 未知ツール・例外伝播・API 非 2xx・trigger_cron_job not-found | `fetch` を vi.fn() でモック |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: ユニットテストでエラーパスをカバーできるため | |

**モック方針（非 2xx）**:

```ts
vi.mocked(fetch).mockResolvedValueOnce({
  ok: false,
  status: 500,
  statusText: "Internal Server Error",
  text: async () => "Server Error",
} as Response);
```

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（テスト専用 Epic） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-027 Story S6（AC-E027-34〜37）
- 参照設計: `docs/domain/mcp-test-coverage-ac-mapping.md` §Part 2（AC-E027-34〜37 ドメイン要素マッピング）
- 参照 ADR: 該当なし
- 参照コード: `packages/jimmy/src/mcp/gateway-server.ts`（`handleTool` default ケース、`tools/call` の try-catch、`apiGet`/`apiPost`/`apiPut` の `!res.ok` 分岐）

## 依存

- 先行 Task: TASK-060（`handleRequest` の export が完了していること）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E027-34〜37）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task（TASK-060）が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
