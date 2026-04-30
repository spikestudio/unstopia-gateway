# API spec 骨格 — ES-026: session-runner-sessions-refactor

生成日: 2026-04-28
Epic 仕様書: `docs/requirements/ES-026-session-runner-sessions-refactor.md`
ドメインモデル: `docs/domain/session-runner-sessions-refactor-domain-model.md`

> **範囲定義**: 本 Epic は既存 API エンドポイントの**内部リファクタリング**である。
> エンドポイントの URL・HTTP メソッド・リクエスト/レスポンス型は変更しない。
> 骨格ではモジュール分割後の「どのモジュールがどのエンドポイントを担うか」と
> 「各モジュールの関数シグネチャ」を定義する。

---

## スキップ判断

| 成果物 | 判断 | 理由 |
|--------|------|------|
| DB スキーマ骨格 | **スキップ** | 本 Epic は DB スキーマを変更しない。既存 SQLite スキーマはそのまま維持される。 |
| インフラ設計骨格 | **スキップ** | 新規クラウドリソース・コンテナ追加なし。既存プロセスモデルを維持する。 |
| バッチ/ジョブ設計骨格 | **スキップ** | バッチ処理・非同期ジョブの追加なし。既存キュー機構（PQueue）はそのまま維持される。 |

---

## Section 1: 横断設計事項（前提確認）

| 横断設計事項 | 確認状態 | 内容 |
|------------|---------|------|
| 認証・認可方針 | 確定済み | 認証なし（内部 API）。権限制御なし。 |
| エラーコード体系 | 既存踏襲 | HTTP ステータスコード + `{ error: string }` JSON。既存 `badRequest` / `notFound` / `serverError` ユーティリティを維持。 |
| セキュリティ方針 | 既存踏襲 | CORS・CSRF・レート制限は既存設定を引き継ぐ。本 Epic では変更なし。 |
| DB マイグレーション | 該当なし | スキーマ変更なし。マイグレーション不要。 |

---

## Section 2: エンドポイント一覧（モジュール担当付き）

> すべてのエンドポイントは既存の URL・メソッドを維持する。
> 「担当モジュール（分割後）」列がリファクタリングの主成果物。

### 2-1. `session-rate-limit.ts`（新規: `SessionRateLimitService`）

**注:** `session-rate-limit.ts` はエンドポイントを持たない内部モジュール。
`runWebSession` から呼び出されるロジック単位として独立する。

| 関数名 | 役割 | 根拠 AC-ID |
|--------|------|-----------|
| `handleRateLimit(deps, session, rateLimit, config, context)` | レートリミット検出後の `status: "waiting"` 更新 + `notifyRateLimited` 呼び出し | AC-E026-02, 03 |
| `retryUntilDeadline(deps, session, deadlineMs, engine, config, context)` | リトライループ（期限内再試行）+ 成功時 `notifyRateLimitResumed` | AC-E026-04 |

```typescript
// gateway/api/session-rate-limit.ts — 公開インターフェース骨格

export interface RateLimitDeps {
  detectRateLimit: typeof import("../../shared/rateLimit.js").detectRateLimit;
  computeNextRetryDelayMs: typeof import("../../shared/rateLimit.js").computeNextRetryDelayMs;
  computeRateLimitDeadlineMs: typeof import("../../shared/rateLimit.js").computeRateLimitDeadlineMs;
  notifyRateLimited: typeof import("../../sessions/callbacks.js").notifyRateLimited;
  notifyRateLimitResumed: typeof import("../../sessions/callbacks.js").notifyRateLimitResumed;
  notifyDiscordChannel: typeof import("../../sessions/callbacks.js").notifyDiscordChannel;
  updateSession: typeof import("../../sessions/registry.js").updateSession;
  insertMessage: typeof import("../../sessions/registry.js").insertMessage;
}

/**
 * レートリミット検出後の待機・通知処理。
 * status を "waiting" に更新し notifyRateLimited を呼び出す。
 * @returns 待機に入る場合の delay ミリ秒
 */
export async function handleRateLimit(
  deps: RateLimitDeps,
  session: import("../../shared/types.js").Session,
  rateLimit: { limited: true; resetsAt?: Date },
  config: import("../../shared/types.js").JinnConfig,
  context: import("../types.js").ApiContext,
): Promise<{ delayMs: number; deadlineMs: number }>

/**
 * リトライループ。deadlineMs まで繰り返す。
 * 成功時: notifyRateLimitResumed を呼び出して resolve。
 * タイムアウト: status を "error" に更新して resolve。
 */
export async function retryUntilDeadline(
  deps: RateLimitDeps,
  session: import("../../shared/types.js").Session,
  deadlineMs: number,
  engine: import("../../shared/types.js").Engine,
  prompt: string,
  config: import("../../shared/types.js").JinnConfig,
  context: import("../types.js").ApiContext,
  attachments?: string[],
): Promise<void>
```

---

### 2-2. `session-fallback.ts`（新規: `SessionFallbackService`）

**注:** エンドポイントを持たない内部モジュール。`runWebSession` のレートリミット分岐から呼び出される。

```typescript
// gateway/api/session-fallback.ts — 公開インターフェース骨格

export interface FallbackDeps {
  updateSession: typeof import("../../sessions/registry.js").updateSession;
  insertMessage: typeof import("../../sessions/registry.js").insertMessage;
  getMessages: typeof import("../../sessions/registry.js").getMessages;
  notifyDiscordChannel: typeof import("../../sessions/callbacks.js").notifyDiscordChannel;
}

/**
 * Claude → fallback エンジン切り替え。
 * @returns true: フォールバック成功（呼び出し元はリトライ不要）
 *          false: フォールバックエンジン未設定（呼び出し元はレートリミット待機に移行）
 * 根拠: AC-E026-05, 06, 07
 */
export async function switchToFallback(
  deps: FallbackDeps,
  session: import("../../shared/types.js").Session,
  fallbackEngine: import("../../shared/types.js").Engine,
  fallbackName: string,
  prompt: string,
  config: import("../../shared/types.js").JinnConfig,
  context: import("../types.js").ApiContext,
  attachments?: string[],
): Promise<boolean>
```

---

### 2-3. `session-runner.ts`（既存・関数シグネチャ変更: `TranscriptReader`）

既存 `loadRawTranscript` / `loadTranscriptMessages` の fs 依存を抽象化する。
エンドポイントへの影響なし（既存の呼び出し元は引数省略でデフォルト動作を維持）。

```typescript
// gateway/api/session-runner.ts — 変更後のシグネチャ骨格

/** 注入可能な fs 抽象インターフェース（テスト時にインメモリ実装を渡す） */
export interface TranscriptReader {
  existsSync(path: string): boolean;
  readdirSync(path: string, options: { withFileTypes: true }): import("node:fs").Dirent[];
  readFileSync(path: string, encoding: "utf-8"): string;
}

/**
 * JSONL Transcript を読み込み TranscriptEntry[] として返す。
 * reader 省略時はデフォルトの node:fs 実装を使用する（後方互換性）。
 * 根拠: AC-E026-08, 09, 10
 */
export function loadRawTranscript(
  engineSessionId: string,
  reader?: TranscriptReader,
): TranscriptEntry[]

/**
 * JSONL Transcript を読み込み { role, content }[] として返す。
 * reader 省略時はデフォルトの node:fs 実装を使用する（後方互換性）。
 * 根拠: AC-E026-08, 09, 10
 */
export function loadTranscriptMessages(
  engineSessionId: string,
  reader?: TranscriptReader,
): Array<{ role: string; content: string }>
```

---

### 2-4. `session-message.ts`（新規: `SessionMessageHandler`）

`POST /api/sessions/:id/message` を担うハンドラー。

| メソッド | パス | 担当関数 | 対応 AC |
|---------|------|---------|--------|
| POST | `/api/sessions/:id/message` | `handlePostMessage` | AC-E026-11, 12, 13, 14, 15 |

```typescript
// gateway/api/session-message.ts — 公開インターフェース骨格

export interface PostMessageDeps {
  getSession: typeof import("../../sessions/registry.js").getSession;
  insertMessage: typeof import("../../sessions/registry.js").insertMessage;
  updateSession: typeof import("../../sessions/registry.js").updateSession;
  enqueueQueueItem: typeof import("../../sessions/registry.js").enqueueQueueItem;
  getClaudeExpectedResetAt: typeof import("../../shared/usageAwareness.js").getClaudeExpectedResetAt;
  maybeRevertEngineOverride: typeof import("./session-runner.js").maybeRevertEngineOverride;
  dispatchWebSessionRun: typeof import("./session-runner.js").dispatchWebSessionRun;
  resolveAttachmentPaths: typeof import("./utils.js").resolveAttachmentPaths;
}

/**
 * POST /api/sessions/:id/message ハンドラー。
 * 入力バリデーション → 割り込み/キュー判定 → dispatch の一連の処理を担う。
 *
 * エラー応答:
 *   400: `message` フィールドが空または未設定
 *   404: セッション ID が存在しない
 *   500: エンジンが取得できない
 * 根拠: AC-E026-11, 12, 13, 14, 15
 */
export async function handlePostMessage(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: PostMessageDeps,
  sessionId: string,
): Promise<void>
```

#### リクエスト/レスポンス型

```typescript
// リクエストボディ（既存 EnqueueMessageBody を流用）
interface EnqueueMessageBody {
  message?: string;    // required: ユーザーメッセージ本文
  prompt?: string;     // alias for message（後方互換）
  role?: string;       // optional: "notification" のみ特別扱い
  attachments?: string[]; // optional: 添付ファイルパス
}

// 成功レスポンス
interface PostMessageResponse {
  status: "queued";
  sessionId: string;
}

// エラーレスポンス（既存共通形式）
interface ErrorResponse {
  error: string;
}
```

#### ステータス分岐ロジック（骨格）

| `session.status` | `isNotification` | `isInterruptibleEngine` | 挙動 |
|------------------|-----------------|------------------------|------|
| `"waiting"` | false | — | `queuedText` 通知メッセージ挿入 + `session:notification` 発火 |
| `"running"` | false | true | `engine.kill` → 500ms wait → `session:interrupted` 発火 |
| `"running"` | false | false | `session:queued` 発火（エンジン停止なし） |
| `"running"` | true | — | `session:queued` 発火（通知は割り込みしない） |
| `"interrupted"` | false | — | `status: "running"` にリセット + `session:resumed` 発火 |
| その他 | — | — | 即座にキューに積んで dispatch |

---

### 2-5. `session-queue-handlers.ts`（新規: `SessionQueueHandler`）

キュー操作エンドポイント群を担うハンドラー。

| メソッド | パス | 担当関数 | 対応 AC |
|---------|------|---------|--------|
| GET | `/api/sessions/:id/queue` | `getQueue` | AC-E026-16 |
| DELETE | `/api/sessions/:id/queue` | `clearQueue` | AC-E026-16 |
| DELETE | `/api/sessions/:id/queue/:itemId` | `cancelQueueItem` | AC-E026-16, 17 |
| POST | `/api/sessions/:id/queue/pause` | `pauseQueue` | AC-E026-16, 18 |
| POST | `/api/sessions/:id/queue/resume` | `resumeQueue` | AC-E026-16, 18 |

```typescript
// gateway/api/session-queue-handlers.ts — 公開インターフェース骨格

export interface QueueHandlerDeps {
  getSession: typeof import("../../sessions/registry.js").getSession;
  getQueueItems: typeof import("../../sessions/registry.js").getQueueItems;
  cancelQueueItem: typeof import("../../sessions/registry.js").cancelQueueItem;
  cancelAllPendingQueueItems: typeof import("../../sessions/registry.js").cancelAllPendingQueueItems;
}

/** GET /api/sessions/:id/queue — キューアイテム一覧取得 */
export async function getQueue(
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
): Promise<void>
// レスポンス: QueueItem[]（既存型）
// エラー: 404（セッション不在）

/** DELETE /api/sessions/:id/queue — 全未処理アイテムをキャンセル */
export async function clearQueue(
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
): Promise<void>
// レスポンス: { status: "cleared", cancelled: number }
// エラー: 404（セッション不在）

/**
 * DELETE /api/sessions/:id/queue/:itemId — 特定アイテムをキャンセル
 * 根拠: AC-E026-17
 */
export async function cancelQueueItem(
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
  itemId: string,
): Promise<void>
// 成功レスポンス: { status: "cancelled", itemId: string }
// エラー:
//   404: セッション不在
//   409: アイテム不在または既実行中（"Item not found or already running"）

/**
 * POST /api/sessions/:id/queue/pause — キューを一時停止
 * 根拠: AC-E026-18
 */
export async function pauseQueue(
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
): Promise<void>
// 成功レスポンス: { status: "paused", sessionId: string }
// イベント: queue:updated { sessionId, sessionKey, paused: true }
// エラー: 404（セッション不在）

/**
 * POST /api/sessions/:id/queue/resume — キューを再開
 * 根拠: AC-E026-18
 */
export async function resumeQueue(
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: QueueHandlerDeps,
  sessionId: string,
): Promise<void>
// 成功レスポンス: { status: "resumed", sessionId: string }
// イベント: queue:updated { sessionId, sessionKey, paused: false }
// エラー: 404（セッション不在）
```

---

### 2-6. `session-crud.ts`（新規: `SessionCrudHandler`）

既存 `sessions.ts` からセッション CRUD エンドポイントを抽出する新規ファイル。

> **設計決定（未決定事項 #2 の解決）**: `session-crud.ts` を**新規作成**する。
> 理由: `sessions.ts` に残るエンドポイント（POST /api/sessions, POST /api/sessions/stub 等）と
> CRUD エンドポイントの責務を明確に分離するため。
> `sessions.ts` は新規セッション作成・特殊操作を引き続き担う。

<!-- AI-UNCERTAIN: 優劣不明 - 「session-crud.ts 新規作成」と「sessions.ts にリファクタリング」の選択。仕様書の未決定事項 #2。推奨は新規作成だが、sessions.ts の行数削減効果と重複リスクのバランスで人間の判断を求める。 -->

| メソッド | パス | 担当関数 | 対応 AC |
|---------|------|---------|--------|
| GET | `/api/sessions` | （sessions.ts に残留） | AC-E026-20 |
| GET | `/api/sessions/interrupted` | （sessions.ts に残留） | AC-E026-20 |
| POST | `/api/sessions` | （sessions.ts に残留） | AC-E026-20 |
| POST | `/api/sessions/stub` | （sessions.ts に残留） | AC-E026-20 |
| POST | `/api/sessions/bulk-delete` | （sessions.ts に残留） | AC-E026-20 |
| GET | `/api/sessions/:id` | `getSession` | AC-E026-20 |
| PUT | `/api/sessions/:id` | `updateSession` | AC-E026-20 |
| DELETE | `/api/sessions/:id` | `deleteSession` | AC-E026-20, 21 |
| POST | `/api/sessions/:id/stop` | `stopSession` | AC-E026-20 |
| POST | `/api/sessions/:id/reset` | `resetSession` | AC-E026-20 |
| POST | `/api/sessions/:id/duplicate` | `duplicateSession` | AC-E026-20 |
| GET | `/api/sessions/:id/children` | `getChildren` | AC-E026-20 |
| GET | `/api/sessions/:id/transcript` | `getTranscript` | AC-E026-20 |

```typescript
// gateway/api/session-crud.ts — 公開インターフェース骨格（主要関数）

export interface CrudDeps {
  getSession: typeof import("../../sessions/registry.js").getSession;
  updateSession: typeof import("../../sessions/registry.js").updateSession;
  deleteSession: typeof import("../../sessions/registry.js").deleteSession;
  duplicateSession: typeof import("../../sessions/registry.js").duplicateSession;
  listSessions: typeof import("../../sessions/registry.js").listSessions;
  getMessages: typeof import("../../sessions/registry.js").getMessages;
  insertMessage: typeof import("../../sessions/registry.js").insertMessage;
  forkEngineSession: typeof import("../../sessions/fork.js").forkEngineSession;
  loadTranscriptMessages: typeof import("./session-runner.js").loadTranscriptMessages;
  loadRawTranscript: typeof import("./session-runner.js").loadRawTranscript;
}

/** GET /api/sessions/:id */
export async function getSession(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: CrudDeps,
  sessionId: string,
  url: URL,
): Promise<void>
// 成功: { ...SerializedSession, messages: Message[] }
// エラー: 404（セッション不在）

/** PUT /api/sessions/:id */
export async function updateSession(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: CrudDeps,
  sessionId: string,
): Promise<void>
// 成功: SerializedSession
// エラー: 400（バリデーション失敗）, 404（セッション不在）

/**
 * DELETE /api/sessions/:id
 * 根拠: AC-E026-20, 21
 */
export async function deleteSession(
  res: import("node:http").ServerResponse,
  context: import("../types.js").ApiContext,
  deps: CrudDeps,
  sessionId: string,
): Promise<void>
// 成功: { status: "deleted" }
// エラー: 404（セッション不在）
```

#### UpdateSession バリデーションルール

| フィールド | 型 | ルール | エラー時 |
|-----------|---|------|--------|
| `title` | `string?` | 文字列かつ非空文字列（trim 後）。最大 200 文字でトリム | 400 Bad Request |

---

## Section 3: エラーコード体系

既存の統一形式を維持する:

| HTTP ステータス | 条件 | レスポンスボディ |
|--------------|------|---------------|
| 400 | 入力バリデーション失敗 | `{ "error": "<理由>" }` |
| 404 | セッション/アイテムが存在しない | `{ "error": "Not Found" }` （utils.ts の `notFound` 関数） |
| 409 | 競合（キューアイテム実行中等） | `{ "error": "Item not found or already running" }` |
| 500 | サーバー内部エラー | `{ "error": "<理由>" }` |

---

## Section 4: 「AI が実装できるレベル」5 問

| 問 | 回答 |
|----|------|
| **1. エンティティの属性は何か** | `Session`: id, status (`idle/running/waiting/interrupted/error`), engine, engineSessionId, sessionKey, sourceRef, transportMeta, lastError, lastActivity（ドメインモデル参照）。`QueueItem`: id, sessionId, sessionKey, prompt, status（既存型）。 |
| **2. 適用されるビジネスルールは何か** | (a) レートリミット時に status を "waiting" に更新し notifyRateLimited を呼ぶ。(b) fallback エンジン不在の場合はレートリミット待機に入る。(c) "interrupted" セッションへのメッセージ受信で status を "running" にリセット。(d) "waiting" 中のメッセージ受信では queuedText 通知を挿入。(e) cancelQueueItem が false を返した場合は 409 を返す。(f) 各分割ファイルは 500 行以下。 |
| **3. データの保存方法は何か** | スキーマ変更なし。既存 SQLite（registry.js 経由）をそのまま使用。セッション更新は `updateSession()`、メッセージ挿入は `insertMessage()`。 |
| **4. インターフェースの入出力は何か** | 各モジュールの関数シグネチャは Section 2 参照。主要なのは: `handlePostMessage(req, res, context, deps, sessionId)` → `{ status: "queued", sessionId }`。`handleRateLimit(deps, session, ...)` → `{ delayMs, deadlineMs }`。`switchToFallback(deps, session, fallbackEngine, ...)` → `boolean`。 |
| **5. 失敗時の挙動は何か** | 400: message 空、title 空/非文字列。404: セッション/アイテム不在。409: キューアイテム実行中。500: エンジン取得失敗。ファイル読み取りエラー（Transcript）は空配列で続行（例外を投げない）。レートリミットタイムアウトは status を "error" に更新。 |

---

## Section 5: ファイル構成と行数見積もり

| ファイル | 種別 | 行数見積もり | 根拠 |
|---------|------|------------|------|
| `session-rate-limit.ts` | 新規 | ~80〜120 行 | レートリミット待機ループ + リトライ処理のみ |
| `session-fallback.ts` | 新規 | ~60〜80 行 | フォールバック切り替えロジックのみ |
| `session-runner.ts` | 既存（削減） | ~300〜400 行（現 801 行） | レートリミット・フォールバック抽出後 |
| `session-message.ts` | 新規 | ~100〜150 行 | POST message 処理（割り込み/キュー判定） |
| `session-queue-handlers.ts` | 新規 | ~80〜120 行 | 5 エンドポイント × ~20 行 |
| `session-crud.ts` | 新規 | ~250〜350 行 | 13 エンドポイント抽出 |
| `sessions.ts` | 既存（削減） | ~150〜200 行（現 632 行） | CRUD・キュー・message 抽出後 |

すべて 500 行以下の見込み（AC-E026-19 を満たす）。

---

## Section 6: AC カバレッジ確認

| AC-ID | 対応成果物 |
|-------|----------|
| AC-E026-01 | Section 2-1: `session-rate-limit.ts` の関数シグネチャ定義 |
| AC-E026-02 | Section 2-1: `RateLimitDeps` 依存注入インターフェース |
| AC-E026-03 | Section 2-1: `handleRateLimit` 関数仕様 |
| AC-E026-04 | Section 2-1: `retryUntilDeadline` 関数仕様 |
| AC-E026-05 | Section 2-2: `session-fallback.ts` の関数シグネチャ定義 |
| AC-E026-06 | Section 2-2: `switchToFallback` 関数仕様（戻り値 true/false） |
| AC-E026-07 | Section 2-2: `switchToFallback` ガード条件（fallbackEngine not null） |
| AC-E026-08 | Section 2-3: `TranscriptReader` インターフェース定義 |
| AC-E026-09 | Section 2-3: `loadRawTranscript` / `loadTranscriptMessages` シグネチャ |
| AC-E026-10 | Section 4 問5: 境界ケース（空配列を返す、例外を投げない） |
| AC-E026-11 | Section 2-4: `session-message.ts` の関数シグネチャ定義 |
| AC-E026-12 | Section 2-4: バリデーション（message 空 → 400） |
| AC-E026-13 | Section 2-4: ステータス分岐ロジック（running + interruptible → engine.kill） |
| AC-E026-14 | Section 2-4: ステータス分岐ロジック（waiting → queuedText 挿入） |
| AC-E026-15 | Section 2-4: ステータス分岐ロジック（interrupted → running リセット） |
| AC-E026-16 | Section 2-5: `session-queue-handlers.ts` 全エンドポイント定義 |
| AC-E026-17 | Section 2-5: `cancelQueueItem` の 409 条件 |
| AC-E026-18 | Section 2-5: `pauseQueue` / `resumeQueue` の `queue:updated` イベント仕様 |
| AC-E026-19 | Section 5: ファイル行数見積もり（全て 500 行以下） |
| AC-E026-20 | Section 2-6: `session-crud.ts` 全エンドポイント定義 |
| AC-E026-21 | Section 2-6: `deleteSession` の 404 条件 |
| AC-E026-22 | Section 4 問2: ビジネスルール（テスト戦略は Task に委ねる） |
| AC-E026-23 | Section 2 全体: 依存注入 `*Deps` インターフェース（全モジュールで vi.mock 対応） |
| AC-E026-24 | Section 4 問1〜5: 型定義の完全性（TypeScript 型エラーなし） |
| AC-E026-25 | Section 4 問5: 既存動作変更なし（後方互換シグネチャ） |

---

## AI 自信度マーク

<!-- AI-UNCERTAIN: 優劣不明 - `session-crud.ts` 新規作成 vs `sessions.ts` リファクタリング（未決定事項 #2）。新規作成を推奨したが、sessions.ts の行数が大幅に減るため responsibilities が曖昧になるリスクがある。人間の判断を求める。 -->

<!-- AI-UNCERTAIN: 優劣不明 - `retryUntilDeadline` を `session-rate-limit.ts` の公開関数として定義したが、`runWebSession` のループ構造に強く依存しているため、単独テストが難しくなる可能性がある。`handleRateLimit` と統合して 1 関数にするか、別途検討が必要。 -->

<!-- AI-UNCERTAIN: LLM依存 - 各ファイルの行数見積もりは既存コードの構造から推定したもの。実際の行数は実装後に確認すること（AC-E026-19 の検証は `wc -l` で実施）。 -->
