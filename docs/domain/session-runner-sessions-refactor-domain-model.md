# 集約モデル詳細 — ES-026: session-runner-sessions-refactor

> 本 Epic は支援ドメイン（内部リファクタリング）であり、BC キャンバスや集約モデルは「該当なし」と
> 仕様書に明記されている。ドメイン要素は「モジュール（ドメインサービス相当の処理単位）」として
> 捉え、分割後の各ファイルをドメインサービス相当の要素として定義する。

生成日: 2026-04-28
Epic 仕様書: `docs/requirements/ES-026-session-runner-sessions-refactor.md`
AC マッピング: `docs/domain/session-runner-sessions-refactor-ac-mapping.md`

---

## 集約一覧

本 Epic では集約（ビジネス集約）は存在しない。代わりに、分割後の各モジュール（ドメインサービス相当）を定義する。

| モジュール名 | 対応ファイル | 責務（1文） |
|------------|------------|------------|
| `SessionRateLimitService` | `gateway/api/session-rate-limit.ts` | Claude レートリミット検出・待機・リトライの一連の処理を管理する |
| `SessionFallbackService` | `gateway/api/session-fallback.ts` | レートリミット時の fallback エンジン切り替えロジックを管理する |
| `TranscriptReader` | `gateway/api/session-runner.ts`（関数シグネチャ変更） | JSONL Transcript ファイルの fs 依存を抽象化して注入可能にする |
| `SessionMessageHandler` | `gateway/api/session-message.ts` | POST メッセージ受信・割り込み判定・キュー登録・engine dispatch を担う |
| `SessionQueueHandler` | `gateway/api/session-queue-handlers.ts` | キュー操作エンドポイント（GET/DELETE/pause/resume）を担う |
| `SessionCrudHandler` | `gateway/api/session-crud.ts`（または sessions.ts 整理） | セッション CRUD エンドポイント（GET/PATCH/DELETE）を担う |

---

## Entity: Session（既存・変更なし）

本 Epic はセッション状態遷移を変更しない。リファクタリング後も既存の遷移を維持することを確認する。

### Fields（属性）

| フィールド | 型 | 制約 | 必須 | 対応 AC |
|-----------|---|------|------|--------|
| `id` | `string` | NOT NULL, UNIQUE | 必須 | — |
| `status` | `"idle" \| "running" \| "waiting" \| "interrupted" \| "error"` | NOT NULL | 必須 | AC-E026-03, 06, 13, 14, 15 |
| `engine` | `string` | NOT NULL | 必須 | AC-E026-06 |
| `engineSessionId` | `string \| null` | — | 任意 | AC-E026-06 |
| `sessionKey` | `string \| null` | — | 任意 | AC-E026-16, 18 |
| `sourceRef` | `string` | NOT NULL | 必須 | — |
| `transportMeta` | `JsonObject \| null` | — | 任意 | AC-E026-06, 07 |
| `lastError` | `string \| null` | — | 任意 | AC-E026-03, 04 |
| `lastActivity` | `string` | NOT NULL, ISO8601 | 必須 | — |

### Invariants（不変条件）[根拠 AC-ID を明記]

- `status === "waiting"` に遷移したとき、`notifyRateLimited` を必ず呼び出す — 根拠: AC-E026-03
- `status` が `"waiting"` → `"idle"` に回復したとき（リトライ成功）、`notifyRateLimitResumed` を必ず呼び出す — 根拠: AC-E026-04
- `engine === "claude"` かつ `strategy === "fallback"` のときのみ fallback エンジンへ切り替える。それ以外の場合はレートリミット待機に入る — 根拠: AC-E026-06, 07
- fallback エンジンが設定に存在しない場合（`engines.get(fallbackName)` が `undefined`）、フォールバックをスキップしてレートリミット待機に入る（フェイルセーフ） — 根拠: AC-E026-07
- `status === "interrupted"` のセッションにメッセージが来た場合、`status` を `"running"` にリセットして `session:resumed` イベントを発火する — 根拠: AC-E026-15
- 分割後の各ファイルは 500 行以下でなければならない — 根拠: AC-E026-19

### State Machine（Session.status）

| 遷移元 | イベント | ガード条件 | 遷移先 | 根拠 AC-ID |
|--------|---------|----------|--------|-----------|
| `idle` | engine.run 開始 | 常に可 | `running` | AC-E026-20 |
| `running` | engine 完了（正常） | 常に可 | `idle` | AC-E026-20 |
| `running` | engine 完了（エラー） | 常に可 | `error` | AC-E026-20 |
| `running` | Claude レートリミット検出 + strategy=fallback + fallbackEngine 存在 | `engine === "claude"` かつ `strategy === "fallback"` かつ `fallbackEngine != null` | `running`（engine 変更）| AC-E026-06 |
| `running` | Claude レートリミット検出（待機ルート） | 上記以外 | `waiting` | AC-E026-03 |
| `waiting` | リトライ成功 | `Date.now() < deadlineMs` かつ retryResult 正常 | `idle` | AC-E026-04 |
| `waiting` | 待機タイムアウト | `Date.now() >= deadlineMs` | `error` | AC-E026-03 |
| `running` | ユーザーが新メッセージ送信（割り込み可能エンジン） | `isInterruptibleEngine(engine)` かつ `engine.isAlive()` かつ `!isNotification` | `running`（engine.kill → 再起動）| AC-E026-13 |
| `interrupted` | ユーザーがメッセージ送信 | 常に可 | `running` | AC-E026-15 |

### Domain Logic

| ロジック名 | 入力 | 出力 | 計算式 / 決定表 | 根拠 AC-ID |
|-----------|-----|------|---------------|-----------|
| Transcript 取得 | `engineSessionId: string`, `reader: TranscriptReader（関数引数）` | `TranscriptEntry[]` | 案A: `reader.readRaw(engineSessionId)` を呼ぶ（fs 抽象化）。`reader` 未指定時はデフォルト実装（既存 fs ベース）を使用 | AC-E026-08, 09, 10 |
| レートリミット判定 | `detectRateLimit(result)` 戻り値 | `{ limited: boolean, resetsAt?: Date }` | 既存 `detectRateLimit` 関数を流用。limited=true かつ wasInterrupted=false の場合のみレートリミット処理に入る | AC-E026-03 |
| リトライ遅延計算 | `rateLimit.resetsAt: Date \| undefined` | `{ delayMs: number, resumeAt?: Date }` | 既存 `computeNextRetryDelayMs` を流用 | AC-E026-03, 04 |
| キューアイテムキャンセル可否 | `itemId: string` | `boolean` | `cancelQueueItem(itemId)` が `false` を返した場合 → 不在または実行中 → 409 を返す | AC-E026-17 |

### Operations（操作の事前/事後条件）

| 操作名 | 事前条件 | 事後条件 | 失敗時の挙動 | 根拠 AC-ID |
|-------|---------|---------|------------|-----------|
| `SessionRateLimitService.handleRateLimit(deps, session, ...)` | `session.status === "running"` かつ `rateLimit.limited === true` | `session.status` が `"waiting"` に更新され `notifyRateLimited` が呼ばれる | 例外発生時は `status: "error"` に更新 | AC-E026-02, 03 |
| `SessionRateLimitService.retry(deps, session, ...)` | `session.status === "waiting"` かつ `Date.now() < deadlineMs` | 成功時: `session.status === "idle"` かつ `notifyRateLimitResumed` 呼び出し | 再度レートリミットの場合は `status: "waiting"` を維持してループ継続 | AC-E026-04 |
| `SessionFallbackService.switchToFallback(deps, session, config, ...)` | `session.engine === "claude"` かつ `strategy === "fallback"` かつ `fallbackEngine != null` | `session.engine` が fallbackName に更新され `transportMeta.engineOverride` が書き込まれる | `fallbackEngine == null` の場合は何もせず `false` を返す | AC-E026-05, 06, 07 |
| `loadRawTranscript(engineSessionId, reader?)` | `engineSessionId` が文字列 | `TranscriptEntry[]`（空配列または解析結果） | ディレクトリ不在・ファイル不在・JSON パースエラーは空配列を返す（例外を投げない） | AC-E026-08, 09, 10 |
| `loadTranscriptMessages(engineSessionId, reader?)` | `engineSessionId` が文字列 | `Array<{role: string, content: string}>`（空配列または解析結果） | ディレクトリ不在・ファイル不在・JSON パースエラーは空配列を返す（例外を投げない） | AC-E026-08, 09, 10 |
| `SessionMessageHandler.handlePostMessage(req, res, context, sessionId, ...)` | セッションが存在する | `{status: "queued", sessionId}` を返す | `message` 空: 400。セッション不在: 404。engine 不在: 500 | AC-E026-11, 12, 13, 14, 15 |
| `SessionQueueHandler.cancelQueueItem(res, context, sessionId, itemId)` | セッションが存在する | `{status: "cancelled", itemId}` を返す | アイテム不在・実行中: 409。セッション不在: 404 | AC-E026-16, 17 |
| `SessionQueueHandler.pauseQueue(res, context, sessionId)` | セッションが存在する | `queue:updated` イベントが `paused: true` で発火 | セッション不在: 404 | AC-E026-16, 18 |
| `SessionQueueHandler.resumeQueue(res, context, sessionId)` | セッションが存在する | `queue:updated` イベントが `paused: false` で発火 | セッション不在: 404 | AC-E026-16, 18 |
| `SessionCrudHandler.delete(res, context, sessionId)` | セッションが存在する | `{status: "deleted"}` を返し `session:deleted` が発火 | セッション不在: 404 | AC-E026-20, 21 |

---

## ドメインサービス詳細

### SessionRateLimitService

| フィールド | 内容 |
|-----------|------|
| 対応ファイル | `gateway/api/session-rate-limit.ts`（新規） |
| 責務 | レートリミット検出後の待機・リトライループを管理。依存注入可能なシグネチャで `vi.mock` 対応 |
| 外部依存（注入対象） | `detectRateLimit`, `computeNextRetryDelayMs`, `computeRateLimitDeadlineMs`, `notifyRateLimited`, `notifyRateLimitResumed`, `notifyDiscordChannel`, `updateSession`, `insertMessage`, `engine.run`, `context.emit` |
| テスト戦略 | 依存をモック化して `status: "waiting"` 遷移・`notifyRateLimited` 呼び出し・リトライ成功後 `notifyRateLimitResumed` 呼び出しを検証 |

### SessionFallbackService

| フィールド | 内容 |
|-----------|------|
| 対応ファイル | `gateway/api/session-fallback.ts`（新規） |
| 責務 | Claude → Codex フォールバック切り替えと `engineOverride` の `transportMeta` 書き込みを管理 |
| 外部依存（注入対象） | `updateSession`, `insertMessage`, `context.emit`, `notifyDiscordChannel`, `fallbackEngine.run`, `getMessages` |
| テスト戦略 | `strategy === "fallback"` + `fallbackEngine != null` の場合に Codex が呼ばれ `session.engine` が更新されることを検証。`fallbackEngine == null` の場合にスキップされることを検証 |
| ガード条件 | `if (!fallbackEngine) return false;` — フォールバック不在時はレートリミット待機に移行（AC-E026-07） |

### TranscriptReader（インターフェース概念・関数引数として実装）

承認済み設計決定: **案A（optional 関数引数）** を採用する。

```typescript
// 注入可能な fs 抽象インターフェース（型定義）
export interface TranscriptReader {
  existsSync(path: string): boolean;
  readdirSync(path: string, options: { withFileTypes: true }): import("node:fs").Dirent[];
  readFileSync(path: string, encoding: "utf-8"): string;
}

// 関数シグネチャ変更後
export function loadRawTranscript(
  engineSessionId: string,
  reader?: TranscriptReader,  // optional: 省略時はデフォルト fs 実装
): TranscriptEntry[]

export function loadTranscriptMessages(
  engineSessionId: string,
  reader?: TranscriptReader,  // optional: 省略時はデフォルト fs 実装
): Array<{ role: string; content: string }>
```

| フィールド | 内容 |
|-----------|------|
| 対応ファイル | `gateway/api/session-runner.ts`（既存・シグネチャ変更）|
| 責務 | JSONL Transcript ファイルの読み取り。fs 依存をオプション引数で注入可能にし、テスト時はインメモリモックで代替 |
| 境界ケース | ディレクトリ不在・ファイル不在・JSON パースエラー → 空配列を返す（例外を投げない）|
| テスト戦略 | インメモリの `TranscriptReader` モックを渡して JSONL パース・境界ケースを検証 |

### SessionMessageHandler

| フィールド | 内容 |
|-----------|------|
| 対応ファイル | `gateway/api/session-message.ts`（新規）|
| 責務 | POST `/api/sessions/:id/message` の受信・割り込み判定・キュー登録・`dispatchWebSessionRun` 呼び出し |
| 主な分岐 | `status: "waiting"` → queuedText 通知 / `status: "running"` + 割り込み可能 → `engine.kill` / `status: "interrupted"` → `running` にリセット + `session:resumed` |
| テスト戦略 | `message` 空 → 400 / `status: "running"` 割り込み可能 → `engine.kill` 呼び出し / `status: "waiting"` → `session:notification` 発火 / `status: "interrupted"` → `session:resumed` 発火 |

### SessionQueueHandler

| フィールド | 内容 |
|-----------|------|
| 対応ファイル | `gateway/api/session-queue-handlers.ts`（新規）|
| 責務 | `GET/DELETE /queue`、`DELETE /queue/:itemId`、`POST /queue/pause`、`POST /queue/resume` の処理 |
| テスト戦略 | `cancelQueueItem` が false を返す場合の 409 / pause → `queue:updated {paused: true}` / resume → `queue:updated {paused: false}` |

### SessionCrudHandler

| フィールド | 内容 |
|-----------|------|
| 対応ファイル | `gateway/api/session-crud.ts`（新規）または `sessions.ts` のリファクタリング |
| 責務 | `GET/PATCH/DELETE /api/sessions/:id` の処理と既存 CRUD エンドポイントの整理 |
| テスト戦略 | セッション不在の場合の 404 / `title` 空文字列の場合の 400 |
| 注意 | 未決定事項 #2（新規 session-crud.ts vs 既存 sessions.ts 整理）は Task 分解時に決定 |

---

## ドメインイベント詳細

本 Epic は既存イベントのリファクタリングであり、新規イベントは追加しない。
既存イベントのペイロードは変更しない（後方互換性保証）。

| イベント名 | ペイロード | 発行条件 | 根拠 AC-ID |
|-----------|----------|---------|-----------|
| `session:notification` | `{ sessionId: string, message: string }` | レートリミット待機開始時 / `status: "waiting"` でのメッセージ受信時 | AC-E026-03, 14 |
| `session:rate-limited` | `{ sessionId: string, employee?: string, error?: string, resetsAt: Date \| null }` | Claude レートリミット検出時（待機ルート） | AC-E026-03 |
| `session:completed` | `{ sessionId: string, employee?, title?, result?, error?, cost?, durationMs? }` | セッション完了・エラー・タイムアウト時 | AC-E026-04, 06 |
| `session:interrupted` | `{ sessionId: string, reason: string }` | `engine.kill` 呼び出し後 | AC-E026-13 |
| `session:queued` | `{ sessionId: string, message: string }` | `status: "running"` かつ割り込み不可の場合のメッセージ受信時 | AC-E026-13 |
| `session:resumed` | `{ sessionId: string }` | `status: "interrupted"` のセッションへのメッセージ受信時 | AC-E026-15 |
| `queue:updated` | `{ sessionId: string, sessionKey?: string, paused?: boolean, depth?: number }` | キュー操作（pause/resume/cancel）時 | AC-E026-18 |

---

## Step 1 との整合性確認

| マッピングマトリクスのドメイン要素 | ドメインモデルでの対応 |
|----------------------------------|----------------------|
| `SessionRateLimitService` | モジュール詳細定義済み（Operations + Invariants） |
| `SessionFallbackService` | モジュール詳細定義済み（Operations + Invariants） |
| `TranscriptReader`（インターフェース）| 関数引数として実装（案A確定）。型定義あり |
| `SessionMessageHandler` | モジュール詳細定義済み（Operations） |
| `SessionQueueHandler` | モジュール詳細定義済み（Operations） |
| `SessionCrudHandler` | モジュール詳細定義済み（Operations）。新規 vs 整理は未決定 |
| `Session.status` 状態遷移 | State Machine テーブルで全遷移定義済み |

---

## AI 自信度マーク

<!-- AI-UNCERTAIN: 優劣不明 - SessionRateLimitService の公開インターフェース粒度。handleRateLimit と retry を別メソッドにするか、1 関数にまとめるか。現状は分離で定義したが Task 実装時に調整の余地あり。 -->

<!-- AI-UNCERTAIN: 優劣不明 - SessionCrudHandler のファイル名・配置（新規 session-crud.ts vs 既存 sessions.ts にリファクタリング）は「未決定事項 #2」として残存。Task 分解時に決定が必要。 -->
