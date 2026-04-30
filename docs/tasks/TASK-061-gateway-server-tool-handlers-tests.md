# Task: [ES-027] Story 2 — gateway-server.ts 全12ツールハンドラーテスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #179 |
| Epic 仕様書 | ES-027 |
| Story | S2 |
| Complexity | L |
| PR | #TBD |

## 責務

`gateway-server.ts` の `handleTool` 関数内、全 12 ツールハンドラーが正しく gateway API を呼び出すことをユニットテストで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/mcp/__tests__/gateway-server.test.ts`（TASK-060 で作成済みのファイルに追記）

対象外（隣接 Task との境界）:

- TASK-060: MCP プロトコル層（initialize / tools/list 等）は別 Task
- TASK-062: ツールハンドラー内でのエラーハンドリングは別 Task

## Epic から委ねられた詳細

- **fetch のモック方式**: `global.fetch = vi.fn()` で全テストケースをモックする。各テストで `vi.mocked(fetch).mockResolvedValueOnce(...)` を使い、API 応答をコントロールする
- **list_sessions のフィルタリング検証（AC-E027-07）**: API レスポンスに複数ステータスのセッションを含む mock を返し、`status` 引数でフィルタリングされた結果だけが返ることを確認する
- **trigger_cron_job のジョブ検索ロジック（AC-E027-16）**: `/api/cron` の GET に対して jobs 配列を返し、`jobId` で一致するジョブが検索されて `triggered: true` が返ることを確認する。`apiPost(/api/cron/{id}/trigger)` は fire-and-forget なのでアサートは不要（実装コメント参照）
- **handleTool への直接アクセス**: TASK-060 で `handleRequest` を export した後、`tools/call` 経由か、または `handleTool` 関数自体を export して直接呼び出す。直接呼び出しの方がシンプルで推奨

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E027-06**: `send_message` ツールを呼び出すと、`/api/connectors/{connector}/send` に `channel`・`text` が POST される
- [ ] **AC-E027-07**: `list_sessions` ツールを `status` フィルター付きで呼び出すと、`/api/sessions` のレスポンスから該当ステータスのセッションのみが返る
- [ ] **AC-E027-08**: `get_session` ツールを呼び出すと、`/api/sessions/{sessionId}` の結果が返る
- [ ] **AC-E027-09**: `create_child_session` ツールを呼び出すと、`/api/sessions` に `employee`・`prompt` が POST される
- [ ] **AC-E027-10**: `send_to_session` ツールを呼び出すと、`/api/sessions/{sessionId}/message` に `message` が POST される
- [ ] **AC-E027-11**: `list_employees` ツールを呼び出すと、`/api/org` の結果が返る
- [ ] **AC-E027-12**: `get_employee` ツールを呼び出すと、`/api/org/employees/{name}` の結果が返る
- [ ] **AC-E027-13**: `update_board` ツールを呼び出すと、`/api/org/departments/{department}/board` に `board` が PUT される
- [ ] **AC-E027-14**: `get_board` ツールを呼び出すと、`/api/org/departments/{department}/board` の結果が返る
- [ ] **AC-E027-15**: `list_cron_jobs` ツールを呼び出すと、`/api/cron` の結果が返る
- [ ] **AC-E027-16**: `trigger_cron_job` ツールを `jobId` で呼び出すと、`/api/cron` から一致するジョブを検索し `triggered: true` が返る
- [ ] **AC-E027-17**: `update_cron_job` ツールを呼び出すと、`/api/cron/{jobId}` に指定フィールドが PUT される
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E027-06〜17）

### 品質面

- [ ] ユニットテストが追加・通過している（vitest）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `handleTool`: 全 12 ツール（send_message / list_sessions / get_session / create_child_session / send_to_session / list_employees / get_employee / update_board / get_board / list_cron_jobs / trigger_cron_job / update_cron_job） | `fetch` を vi.fn() でモック |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: ユニットテストで全 API 呼び出しをカバーできるため | |

**モック方針**:

```ts
global.fetch = vi.fn();
// 各テストケースで:
vi.mocked(fetch).mockResolvedValueOnce({
  ok: true,
  json: async () => ({ ... }),
} as Response);
```

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（テスト専用 Epic） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-027 Story S2（AC-E027-06〜17）
- 参照設計: `docs/domain/mcp-test-coverage-ac-mapping.md` §Part 2（AC-E027-06〜17 ドメイン要素マッピング）
- 参照 ADR: 該当なし
- 参照コード: `packages/jimmy/src/mcp/gateway-server.ts`（`handleTool` 関数、`apiGet`・`apiPost`・`apiPut` ヘルパー）

## 依存

- 先行 Task: TASK-060（`handleRequest` / `handleTool` の export が完了していること）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E027-06〜17）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（L: ~800 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task（TASK-060）が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
