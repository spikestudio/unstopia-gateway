# Task: [ES-032] Story 1.4 — sessions.ts テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #231 |
| Epic 仕様書 | ES-032 |
| Story | 1.4 |
| Complexity | M |
| PR | #226 |

## 責務

`src/gateway/api/sessions.ts` の全 HTTP ハンドラー（list / interrupted / bulk-delete / stub / POST / GET/:id / PUT/:id / DELETE/:id / stop / reset / duplicate / queue 操作）に対するユニットテストを追加し、branch カバレッジを 0% から 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/sessions.test.ts`（新規作成）
- `packages/jimmy/src/gateway/api/sessions.ts`（読み取りのみ、変更なし）

対象外（隣接 Task との境界）:

- `session-crud.ts` / `session-message.ts` / `session-queue-handlers.ts` 等の直接テストは ES-026 で対応済み
- sessions.ts の委譲パスが呼ばれることのみを確認する

## Epic から委ねられた詳細

- `session-crud.ts` の関数（`defaultCrudDeps`, `getSessionHandler`, `updateSessionHandler`, `deleteSessionHandler` 等）はすべてモックする
- `session-message.ts` の `handlePostMessage`, `basePostMessageDeps` もモックする
- `session-queue-handlers.ts` の各関数もモックする
- `session-runner.ts` の `dispatchWebSessionRun` はモックして即時 resolve にする
- `POST /api/sessions/bulk-delete` の engine.kill パスは `isInterruptibleEngine` / `engine.isAlive` / `engine.kill` をすべてモックしてテストする
- `context.sessionManager.getEngine` は null / Engine オブジェクトの両方をテストする

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E032-26: `sessions.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E032-27: `GET /api/sessions` がセッション一覧を返すことが検証される
- [ ] AC-E032-28: `GET /api/sessions/interrupted` が中断済みセッション一覧を返すことが検証される
- [ ] AC-E032-29: `POST /api/sessions/bulk-delete` が ids 必須バリデーション / engine kill / 削除 / 削除数返却 の流れで検証される
- [ ] AC-E032-30: `POST /api/sessions/stub` がデフォルト greeting でスタブセッションを作成することが検証される
- [ ] AC-E032-31: `POST /api/sessions` が prompt 必須バリデーション / エンジン不在時エラー / 正常時キュー追加 を検証される
- [ ] AC-E032-32: `GET/PUT/DELETE /api/sessions/:id` / stop / reset / duplicate が各 sub-handler に委譲されることが検証される
- [ ] Epic 仕様書の AC-E032-26〜32 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | handleSessionsRequest の全ルート分岐 | session-crud / session-message / queue-handlers / session-runner はすべてモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 委譲パスの単体確認のみ。E2E は TASK-106 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway/api（HTTP ルーティング層） |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-032 §Story 1.4
- 参照コード: `packages/jimmy/src/gateway/api/sessions.ts`
- 参照コード: `packages/jimmy/src/gateway/api/__tests__/session-crud.test.ts`（モック構成の参考）

**モック対象一覧:**

- `../../sessions/registry` → `createSession`, `deleteSessions`, `enqueueQueueItem`, `getSession`, `insertMessage`, `listSessions`, `updateSession`, `getInterruptedSessions`
- `../../shared/logger` → `logger`
- `../../shared/types` → `isInterruptibleEngine`
- `./session-crud` → 全 named exports
- `./session-message` → `basePostMessageDeps`, `handlePostMessage`
- `./session-queue-handlers` → 全 named exports
- `./session-runner` → `dispatchWebSessionRun`
- `./utils` → `badRequest`, `json`, `matchRoute`, `readJsonBody`, `resolveAttachmentPaths`, `serializeSession`, `unwrapSession`

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] Epic から委ねられた詳細が転記されている
