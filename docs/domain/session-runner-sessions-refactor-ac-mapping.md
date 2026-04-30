# AC パターン分類 + AC-ドメイン要素マッピングマトリクス
# ES-026: session-runner-sessions-refactor

生成日: 2026-04-28  
Epic 仕様書: `docs/requirements/ES-026-session-runner-sessions-refactor.md`  
対象ファイル: `packages/jimmy/src/gateway/api/session-runner.ts`（801行）・`packages/jimmy/src/gateway/api/sessions.ts`（632行）

---

## Section 1: AC パターン分類テーブル

本 Epic は内部リファクタリングである。AC のほとんどが「ファイル分割後も既存の振る舞いを保証するユニットテスト」を定義しており、**操作（振る舞い検証）** が主パターンとなる。一部の AC は「〜の場合は〜に遷移する」ステータス遷移・「〜できない」不変条件を検証するためのものを含む。

| AC-ID | AC 概要 | 分類パターン |
|-------|---------|------------|
| AC-E026-01 | `session-rate-limit.ts` がレートリミット処理を集約して存在する | 操作（ファイル構造・モジュール構成要件） |
| AC-E026-02 | 抽出関数がモック可能な依存注入シグネチャを持つ | 操作（+ 不変条件: インターフェース制約） |
| AC-E026-03 | レートリミット状態で `status: "waiting"` + `notifyRateLimited` が呼ばれる | 状態遷移（+ イベント） |
| AC-E026-04 | リトライ成功時に `notifyRateLimitResumed` が呼ばれる | イベント（+ 状態遷移） |
| AC-E026-05 | `session-fallback.ts` がフォールバック処理を集約して存在する | 操作（ファイル構造・モジュール構成要件） |
| AC-E026-06 | Claude レートリミット + strategy=fallback の場合 Codex が呼ばれ `session.engine` が更新される | 状態遷移（+ 操作） |
| AC-E026-07 | fallback エンジン未設定の場合フォールバックをスキップしてレートリミット待機に入る | 不変条件（ガード条件: エンジン不在時フェイルセーフ） |
| AC-E026-08 | `loadRawTranscript`/`loadTranscriptMessages` が fs を直接呼ばず注入可能な抽象経由でアクセスする | 操作（+ 不変条件: インターフェース制約） |
| AC-E026-09 | 存在する JSONL ファイルからエントリが正しくパースされる | 操作（計算ロジック: JSONL パース） |
| AC-E026-10 | ディレクトリ不在・ファイル不在・JSON パースエラーで空配列が返る | 不変条件（境界ケース: エラー耐性） |
| AC-E026-11 | `session-message.ts` がメッセージ受信処理を集約して存在する | 操作（ファイル構造・モジュール構成要件） |
| AC-E026-12 | `message` フィールドが空の場合に 400 を返す | バリデーション |
| AC-E026-13 | `status: "running"` + 割り込み可能エンジンの場合 `engine.kill` が呼ばれる | 状態遷移（+ 操作） |
| AC-E026-14 | `status: "waiting"` の場合に `queuedText` 通知メッセージ挿入 + `session:notification` 発火 | 状態遷移（+ イベント） |
| AC-E026-15 | `status: "interrupted"` の場合にステータスが `running` にリセット + `session:resumed` 発火 | 状態遷移（+ イベント） |
| AC-E026-16 | `session-queue-handlers.ts` がキュー操作エンドポイントを集約して存在する | 操作（ファイル構造・モジュール構成要件） |
| AC-E026-17 | キューアイテム不在・既実行中の場合 409 を返す | バリデーション（+ 不変条件） |
| AC-E026-18 | pause/resume で `queue:updated` イベントが `paused: true/false` で発火 | イベント（+ 操作） |
| AC-E026-19 | 分割後の各ファイルが 500 行以下 | 不変条件（非機能要件: ファイルサイズ制約） |
| AC-E026-20 | CRUD エンドポイントが分割後も正常動作し既存テストが全 PASS | 操作（後方互換性保証） |
| AC-E026-21 | 削除対象セッション不在の場合 404 を返す | バリデーション |
| AC-E026-22 | `gateway/api/` 以下の branch カバレッジが 100% | 不変条件（非機能要件: テストカバレッジ） |
| AC-E026-23 | 各テストが外部依存を完全にモックした純粋ユニットテストになっている | 不変条件（テスト品質制約） |
| AC-E026-24 | `pnpm build` がエラーなく完了する | 不変条件（ビルド成功保証） |
| AC-E026-25 | `pnpm test` が全テスト PASS する | 不変条件（テスト全 PASS 保証） |

---

## Section 2: AC-ドメイン要素マッピングマトリクス

本 Epic は **支援ドメイン（内部リファクタリング）** であり、BC キャンバスや集約モデルは「該当なし」と仕様書に明記されている。ドメイン要素は「モジュール（ドメインサービス相当の処理単位）」として捉え、分割後の各ファイルをドメインサービス相当の要素にマッピングする。

| AC-ID | AC 概要 | ドメイン要素 | 要素種別 |
|-------|---------|------------|---------|
| AC-E026-01 | `session-rate-limit.ts` がレートリミット処理を集約 | `SessionRateLimitService`（新規モジュール） | 操作: モジュール構成 |
| AC-E026-02 | 依存注入可能なシグネチャ | `SessionRateLimitService.handleRateLimit(deps, ...)` | 不変条件: インターフェース制約 |
| AC-E026-03 | レートリミット時 `status: "waiting"` + `notifyRateLimited` | `Session.status` 状態遷移 / `SessionRateLimitService.notify` | 状態遷移 |
| AC-E026-04 | リトライ成功時 `notifyRateLimitResumed` | `SessionRateLimitService.notifyResumed` | イベント |
| AC-E026-05 | `session-fallback.ts` がフォールバック処理を集約 | `SessionFallbackService`（新規モジュール） | 操作: モジュール構成 |
| AC-E026-06 | Claude レートリミット + fallback 時 `session.engine` 更新 | `Session.engine` / `SessionFallbackService.switchToFallback` | 状態遷移 |
| AC-E026-07 | fallback エンジン未設定時スキップ | `SessionFallbackService.switchToFallback` ガード条件 | 不変条件 |
| AC-E026-08 | `loadRawTranscript`/`loadTranscriptMessages` が fs 抽象経由 | `TranscriptReader`（インターフェース）/ `FileSystemTranscriptReader`（実装） | 不変条件: インターフェース制約 |
| AC-E026-09 | JSONL エントリの正しいパース | `TranscriptReader.readRaw` / `TranscriptReader.readMessages` | 操作: 計算ロジック |
| AC-E026-10 | ディレクトリ不在・ファイル不在・パースエラーで空配列 | `TranscriptReader.readRaw` エラー境界 | 不変条件 |
| AC-E026-11 | `session-message.ts` がメッセージ受信処理を集約 | `SessionMessageHandler`（新規モジュール） | 操作: モジュール構成 |
| AC-E026-12 | `message` 空の場合 400 | `SessionMessageHandler.handlePostMessage` バリデーション | バリデーション |
| AC-E026-13 | `status: "running"` + 割り込み可能時 `engine.kill` | `Session.status` / `SessionMessageHandler.handleInterrupt` | 状態遷移 |
| AC-E026-14 | `status: "waiting"` 時 `queuedText` 挿入 + `session:notification` | `SessionMessageHandler.handleWaitingQueue` | 状態遷移 |
| AC-E026-15 | `status: "interrupted"` 時 `running` リセット + `session:resumed` | `Session.status` 状態遷移 / `SessionMessageHandler.handleResume` | 状態遷移 |
| AC-E026-16 | `session-queue-handlers.ts` がキュー操作を集約 | `SessionQueueHandler`（新規モジュール） | 操作: モジュール構成 |
| AC-E026-17 | キューアイテム不在・既実行中で 409 | `SessionQueueHandler.cancelQueueItem` バリデーション | バリデーション |
| AC-E026-18 | pause/resume で `queue:updated` 発火 | `SessionQueueHandler.pause` / `SessionQueueHandler.resume` | イベント |
| AC-E026-19 | 分割後ファイルが 500 行以下 | 全新規モジュール（ファイルサイズ不変条件） | 不変条件 |
| AC-E026-20 | CRUD エンドポイントが分割後も正常動作 | `SessionCrudHandler`（既存 sessions.ts からの整理） | 操作 |
| AC-E026-21 | セッション不在で 404 | `SessionCrudHandler.delete` バリデーション | バリデーション |
| AC-E026-22 | branch カバレッジ 100% | 全モジュール（テストカバレッジ不変条件） | 不変条件 |
| AC-E026-23 | 純粋ユニットテスト（外部依存モック完全） | 全テストファイル（テスト品質不変条件） | 不変条件 |
| AC-E026-24 | `pnpm build` 成功 | ビルドパイプライン（型安全性不変条件） | 不変条件 |
| AC-E026-25 | `pnpm test` 全 PASS | テストパイプライン（回帰防止不変条件） | 不変条件 |

---

## Section 3: セルフレビュー結果

### coverage チェック（未マップ AC ゼロ確認）

| チェック項目 | 結果 |
|------------|------|
| AC 総件数 | 25 件（AC-E026-01 〜 AC-E026-25） |
| マッピング件数 | 25 件 |
| 未マップ AC | 0 件 ✅ |
| 「該当なし」AC | 0 件（全 AC にドメイン要素が存在） |

### パターン分類の内訳

| パターン | 件数 |
|---------|------|
| 操作（モジュール構成含む） | 9 件 |
| 不変条件 | 8 件 |
| 状態遷移 | 5 件 |
| バリデーション | 3 件 |
| イベント | 2 件（主パターン） |
| 計算ロジック | 0 件（AC-E026-09 は操作の補足として扱った） |

### 新規ドメイン要素一覧

本 Epic で新たに識別したモジュール（ドメインサービス相当）:

| 新規要素 | 対応ファイル | 担当 AC |
|---------|------------|---------|
| `SessionRateLimitService` | `gateway/api/session-rate-limit.ts` | AC-E026-01〜04 |
| `SessionFallbackService` | `gateway/api/session-fallback.ts` | AC-E026-05〜07 |
| `TranscriptReader`（インターフェース） | `gateway/api/session-runner.ts`（既存・抽象化） | AC-E026-08〜10 |
| `SessionMessageHandler` | `gateway/api/session-message.ts` | AC-E026-11〜15 |
| `SessionQueueHandler` | `gateway/api/session-queue-handlers.ts` | AC-E026-16〜18 |
| `SessionCrudHandler` | `gateway/api/session-crud.ts`（または sessions.ts 整理） | AC-E026-19〜21 |

### AI 自信度マーク

<!-- AI-UNCERTAIN: 優劣不明 - AC-E026-08 の fs 抽象化粒度（関数引数 vs FileSystemReader インターフェース）。仕様書「未決定事項 #1」として残存。本マッピングでは両方に対応できる「TranscriptReader インターフェース」と表記したが、Task 分解時に決定が必要。 -->

<!-- AI-UNCERTAIN: 優劣不明 - AC-E026-20 で「session-crud.ts 新規作成」vs「既存 sessions.ts のリファクタリング」どちらで CRUD を整理するか。仕様書「未決定事項 #2」として残存。 -->
