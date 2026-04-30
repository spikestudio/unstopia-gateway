# Task: [ES-026] Story 6 — session-crud.ts 実装 + UT

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #166 |
| Epic 仕様書 | ES-026 |
| Story | 6 |
| Complexity | M |
| PR | #TBD |

## 責務

`handleSessionsRequest` のセッション CRUD エンドポイント（`GET/PUT/DELETE /api/sessions/:id` および関連エンドポイント）を `session-crud.ts` に抽出・新規作成し、依存注入可能なシグネチャで実装してユニットテストでカバーする。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/session-crud.ts`（**新規作成**）
- `packages/jimmy/src/gateway/api/__tests__/session-crud.test.ts`（**新規作成**）

対象外（隣接 Task との境界）:

- TASK-057: `sessions.ts` から `session-crud.ts` の各ハンドラーを呼び出すよう routing を切り替える（本 Task は実装のみ）
- `sessions.ts` の以下のエンドポイントは本 Task で移動しない（`sessions.ts` に残留）:
  - `GET /api/sessions`
  - `GET /api/sessions/interrupted`
  - `POST /api/sessions`
  - `POST /api/sessions/stub`
  - `POST /api/sessions/bulk-delete`

## Epic から委ねられた詳細

- **`session-crud.ts` を新規作成する**（API spec Section 2-6 で確定）
- 以下の関数を公開関数として定義する（API spec Section 2-6 参照）:
  - `getSessionHandler(req, res, context, deps, sessionId, url)` — GET /api/sessions/:id
  - `updateSessionHandler(req, res, context, deps, sessionId)` — PUT /api/sessions/:id
  - `deleteSessionHandler(res, context, deps, sessionId)` — DELETE /api/sessions/:id（404条件含む）
  - `stopSession(res, context, deps, sessionId)` — POST /api/sessions/:id/stop
  - `resetSession(res, context, deps, sessionId)` — POST /api/sessions/:id/reset
  - `duplicateSessionHandler(res, context, deps, sessionId)` — POST /api/sessions/:id/duplicate
  - `getChildren(res, context, deps, sessionId)` — GET /api/sessions/:id/children
  - `getTranscript(res, context, deps, sessionId)` — GET /api/sessions/:id/transcript
- `CrudDeps` インターフェースで全外部依存を注入可能にする（API spec Section 2-6 参照）
- `updateSessionHandler` のバリデーション: `title` が非文字列 → 400、空文字列（trim後）→ 400、最大 200 文字でトリム
- `deleteSessionHandler`: セッション不在の場合は 404。存在するエンジンプロセスを kill してから delete
- ファイル行数を 500 行以下に収めること（AC-E026-19）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E026-19**: `session-crud.ts` のファイル行数が 500 行以下（`wc -l` で確認）
- [ ] **AC-E026-20**: セッション一覧取得・個別取得・更新・削除の各エンドポイントが分割後も正常に動作し、既存テストが全 PASS する
- [ ] **AC-E026-21**: 削除対象セッションが存在しない場合に 404 を返すことを検証するユニットテストが通過する
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E026-19〜21）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（`pnpm lint`・`pnpm typecheck` エラーなし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `deleteSessionHandler`, `updateSessionHandler`, `getSessionHandler`（主要 3 関数） | `vi.mock` で `CrudDeps` の全依存をモック |
| ドメインロジックテスト | 該当なし | — |
| 統合テスト | 該当なし | — |
| E2E テスト | 該当なし — 理由: 内部モジュール抽出のみ。E2E は TASK-059 で実施 | — |

**テストケース（最低限）:**

1. `deleteSessionHandler`: セッション不在の場合に 404 を返すこと（AC-E026-21）
2. `deleteSessionHandler`: セッションが存在する場合に `deleteSession` が呼ばれ `session:deleted` が発火されること
3. `updateSessionHandler`: `title` が非文字列の場合に 400 を返すこと
4. `updateSessionHandler`: `title` が空文字列（trim後）の場合に 400 を返すこと
5. `updateSessionHandler`: セッション不在の場合に 404 を返すこと
6. `getSessionHandler`: セッション不在の場合に 404 を返すこと

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（支援ドメイン） |
| サブドメイン種別 | 支援: 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-026 Story 6（AC-E026-19〜21）
- 参照設計: `docs/design/session-runner-sessions-refactor-api-spec.md` §Section 2-6（session-crud.ts の公開インターフェース骨格）
- 参照設計: `docs/domain/session-runner-sessions-refactor-domain-model.md` §SessionCrudHandler
- 参照コード: `packages/jimmy/src/gateway/api/sessions.ts` の 219〜524行（既存 CRUD エンドポイントが移植元）
- 参照コード: `packages/jimmy/src/gateway/api/session-runner.ts`（`loadRawTranscript`, `loadTranscriptMessages` の参照先 — TASK-053 で変更後のシグネチャを使用すること）
- 参照規約: `docs/conventions/testing.md`

## 依存

- 先行 Task: TASK-053（`loadRawTranscript`/`loadTranscriptMessages` のシグネチャが変更後の形で参照する）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E026-19〜21）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task（TASK-053）が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
