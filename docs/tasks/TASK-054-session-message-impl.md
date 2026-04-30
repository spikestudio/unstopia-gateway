# Task: [ES-026] Story 4 — session-message.ts 実装 + UT

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #165 |
| Epic 仕様書 | ES-026 |
| Story | 4 |
| Complexity | M |
| PR | #TBD |

## 責務

`handleSessionsRequest` の `POST /api/sessions/:id/message` 処理を `session-message.ts` に抽出し、依存注入可能なシグネチャで実装してユニットテストでカバーする。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/session-message.ts`（**新規作成**）
- `packages/jimmy/src/gateway/api/__tests__/session-message.test.ts`（**新規作成**）

対象外（隣接 Task との境界）:

- TASK-051: `handleRateLimit`/`retryUntilDeadline` の実装（本 Task は呼び出さない）
- TASK-057: `sessions.ts` から `handlePostMessage` を呼び出すよう routing を切り替える（本 Task は実装のみ）

## Epic から委ねられた詳細

- `handlePostMessage(req, res, context, deps, sessionId)` を公開関数として定義する（API spec Section 2-4 参照）
- `PostMessageDeps` インターフェースで全外部依存を注入可能にする（`getSession`, `insertMessage`, `updateSession`, `enqueueQueueItem`, `getClaudeExpectedResetAt`, `maybeRevertEngineOverride`, `dispatchWebSessionRun`, `resolveAttachmentPaths`）
- ステータス分岐ロジックの詳細:
  - `status: "waiting"` かつ非通知: `queuedText` 通知メッセージを挿入し `session:notification` を発火
  - `status: "running"` かつ割り込み可能エンジン（`isInterruptibleEngine` && `engine.isAlive`）: `engine.kill` → 500ms wait → `session:interrupted` 発火
  - `status: "running"` かつ非割り込み/通知: `session:queued` 発火
  - `status: "interrupted"`: `status: "running"` にリセット + `session:resumed` 発火
- `engine` は `context`（`ApiContext`）から取得するのではなく、`deps` から注入する（テスト可能にするため）。ただし `context.emit` は `context` 経由で呼ぶ

<!-- 設計判断確定: category=error_strategy
     選択: vi.useFakeTimers（推奨）
     根拠: Vitest の vi.useFakeTimers() で setTimeout を同期的に進めることで、500ms wait を簡潔にテストできる。PostMessageDeps に sleep 関数を追加する必要がなくシグネチャがシンプルに保たれる。
     対案: extract-wait-as-injectable-sleep — sleep: (ms: number) => Promise<void> を deps に追加する方法。より明示的に依存を分離できるが、シグネチャが複雑になる
     トレードオフ: vi.useFakeTimers は afterEach で vi.useRealTimers() に戻す必要があるが、標準的な Vitest パターン。inject-sleep は deps が増えるが実際の実装でもテスト用実装でも同一インターフェースを使える -->

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E026-11**: `session-message.ts` が `gateway/api/` 以下に存在し、POST メッセージ受信・割り込み判定・キュー登録・`dispatchWebSessionRun` 呼び出しの処理が同ファイルに集約されている
- [ ] **AC-E026-12**: `message` フィールドが空の場合に 400 を返すことを検証するユニットテストが通過する
- [ ] **AC-E026-13**: セッションが `status: "running"` かつ割り込み可能エンジンの場合に `engine.kill` が呼び出されることを検証するユニットテストが通過する
- [ ] **AC-E026-14**: セッションが `status: "waiting"` の場合に `queuedText` 通知メッセージが挿入されて `session:notification` イベントが発火されることを検証するユニットテストが通過する
- [ ] **AC-E026-15**: セッションが `status: "interrupted"` の場合にステータスが `running` にリセットされて `session:resumed` イベントが発火されることを検証するユニットテストが通過する
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E026-11〜15）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（`pnpm lint`・`pnpm typecheck` エラーなし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `handlePostMessage` 関数 | `vi.mock` で `PostMessageDeps` の全依存をモック。`vi.useFakeTimers()` で 500ms wait をスキップ |
| ドメインロジックテスト | 該当なし | — |
| 統合テスト | 該当なし | — |
| E2E テスト | 該当なし — 理由: 内部モジュール抽出のみ。E2E は TASK-059 で実施 | — |

**テストケース（最低限）:**

1. `message` が空文字列の場合に 400 レスポンスを返すこと
2. `message` が未設定の場合に 400 レスポンスを返すこと
3. `status: "running"` + `isInterruptibleEngine = true` + `engine.isAlive = true`: `engine.kill` が呼ばれること
4. `status: "running"` + `isInterruptibleEngine = false`: `session:queued` イベントが発火されること
5. `status: "waiting"` + 非通知: `insertMessage` が `"notification"` ロールで呼ばれ `session:notification` が発火されること
6. `status: "interrupted"`: `updateSession` が `status: "running"` で呼ばれ `session:resumed` が発火されること
7. 通知メッセージ（`role: "notification"`）: `engine.kill` が呼ばれないこと
8. セッション不在（`getSession` が null を返す）: 404 レスポンスを返すこと

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（支援ドメイン） |
| サブドメイン種別 | 支援: 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-026 Story 4（AC-E026-11〜15）
- 参照設計: `docs/design/session-runner-sessions-refactor-api-spec.md` §Section 2-4（session-message.ts の公開インターフェース骨格、ステータス分岐ロジックテーブル）
- 参照設計: `docs/domain/session-runner-sessions-refactor-domain-model.md` §SessionMessageHandler
- 参照コード: `packages/jimmy/src/gateway/api/sessions.ts` の 526〜627行（既存 `POST /api/sessions/:id/message` 処理が移植元）
- 参照規約: `docs/conventions/testing.md`

## 依存

- 先行 Task: TASK-051（`maybeRevertEngineOverride`・`dispatchWebSessionRun` の依存先 session-rate-limit.ts が確定していること）、TASK-053（`loadTranscriptMessages` のシグネチャが確定していること）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E026-11〜15）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task（TASK-051, TASK-053）が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
