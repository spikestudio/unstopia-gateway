# Task: [ES-026] Story 5 — session-queue-handlers.ts 実装 + UT

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #163 |
| Epic 仕様書 | ES-026 |
| Story | 5 |
| Complexity | S |
| PR | #TBD |

## 責務

`handleSessionsRequest` のキュー操作エンドポイント群（`/queue`, `/queue/:itemId`, `/queue/pause`, `/queue/resume`）を `session-queue-handlers.ts` に抽出し、依存注入可能なシグネチャで実装してユニットテストでカバーする。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/session-queue-handlers.ts`（**新規作成**）
- `packages/jimmy/src/gateway/api/__tests__/session-queue-handlers.test.ts`（**新規作成**）

対象外（隣接 Task との境界）:

- TASK-057: `sessions.ts` から各ハンドラーを呼び出すよう routing を切り替える（本 Task は実装のみ）
- TASK-056: session-crud.ts 実装（キュー操作とは独立した責務）

## Epic から委ねられた詳細

- 5 つの関数（`getQueue`, `clearQueue`, `cancelQueueItem`, `pauseQueue`, `resumeQueue`）を公開関数として定義する（API spec Section 2-5 参照）
- `QueueHandlerDeps` インターフェースで外部依存を注入可能にする（`getSession`, `getQueueItems`, `cancelQueueItem`, `cancelAllPendingQueueItems`）
- `pause`/`resume` の `context.sessionManager.getQueue()` 操作は `context` 経由で呼ぶ（`ApiContext` の `sessionManager` は引数として受け取る）
- `queue:updated` イベントは `context.emit` で発火する
- `cancelQueueItem` が `false` を返した場合: 409 Conflict `{ error: "Item not found or already running" }`

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E026-16**: `session-queue-handlers.ts` が `gateway/api/` 以下に存在し、`GET /api/sessions/:id/queue`・`DELETE /api/sessions/:id/queue`・`DELETE /api/sessions/:id/queue/:itemId`・`POST /api/sessions/:id/queue/pause`・`POST /api/sessions/:id/queue/resume` の処理が同ファイルに集約されている
- [ ] **AC-E026-17**: `DELETE /api/sessions/:id/queue/:itemId` で対象アイテムが存在しない・既に実行中の場合に 409 を返すことを検証するユニットテストが通過する
- [ ] **AC-E026-18**: `POST /api/sessions/:id/queue/pause` および `resume` でそれぞれ `queue:updated` イベントが `paused: true` / `paused: false` で発火されることを検証するユニットテストが通過する
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E026-16〜18）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（`pnpm lint`・`pnpm typecheck` エラーなし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `getQueue`, `clearQueue`, `cancelQueueItem`, `pauseQueue`, `resumeQueue` 関数 | `vi.mock` で `QueueHandlerDeps` の全依存をモック |
| ドメインロジックテスト | 該当なし | — |
| 統合テスト | 該当なし | — |
| E2E テスト | 該当なし — 理由: 内部モジュール抽出のみ。E2E は TASK-059 で実施 | — |

**テストケース（最低限）:**

1. `cancelQueueItem`: `deps.cancelQueueItem` が `false` を返す場合に 409 レスポンスを返すこと
2. `cancelQueueItem`: セッション不在（`getSession` が null）の場合に 404 を返すこと
3. `pauseQueue`: `queue:updated` イベントが `{ paused: true }` で発火されること
4. `pauseQueue`: セッション不在の場合に 404 を返すこと
5. `resumeQueue`: `queue:updated` イベントが `{ paused: false }` で発火されること
6. `getQueue`: セッション不在の場合に 404 を返すこと
7. `getQueue`: キューアイテム一覧が返ること
8. `clearQueue`: `cancelAllPendingQueueItems` が呼ばれ `queue:updated` が発火されること

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（支援ドメイン） |
| サブドメイン種別 | 支援: 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-026 Story 5（AC-E026-16〜18）
- 参照設計: `docs/design/session-runner-sessions-refactor-api-spec.md` §Section 2-5（session-queue-handlers.ts の公開インターフェース骨格）
- 参照設計: `docs/domain/session-runner-sessions-refactor-domain-model.md` §SessionQueueHandler
- 参照コード: `packages/jimmy/src/gateway/api/sessions.ts` の 421〜496行（既存のキュー操作エンドポイントが移植元）
- 参照規約: `docs/conventions/testing.md`

## 依存

- 先行 Task: なし（--）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E026-16〜18）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（本 Task は先行なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
