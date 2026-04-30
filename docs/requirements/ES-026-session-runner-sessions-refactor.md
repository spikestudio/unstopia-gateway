# ES-026: session-runner-sessions-refactor

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #160 |
| Phase 定義書 | PD-002 |
| Epic | E16（PD-002 残タスク・feedback Issue #158 起点） |
| 所属 BC | 該当なし（支援ドメイン・構造改善） |
| ADR 参照 | — |

## 対応ストーリー

- S1: runWebSession からレートリミット処理を session-rate-limit.ts に抽出 → モックで単体テスト可能にする
- S2: runWebSession から fallback エンジン切り替え処理を session-fallback.ts に抽出 → モックで単体テスト可能にする
- S3: Transcript 読み込み (loadRawTranscript/loadTranscriptMessages) の fs 依存を抽象化 → モックして単体テスト可能にする
- S4: POST /api/sessions/:id/message ハンドラーを session-message.ts に分割 → 単体テスト可能にする
- S5: キュー操作ハンドラー群を session-queue.ts に分割 → 単体テスト可能にする
- S6: セッション CRUD ハンドラーを整理し各ハンドラーを独立してテストできる形にする
- S7: 全関数・ハンドラーにユニットテストを追加 → branch カバレッジ 100% 達成
- S8: pnpm build && pnpm test が全 PASS することを確認

## 概要

`gateway/api/session-runner.ts`（801行）と `gateway/api/sessions.ts`（632行）を
責務単位のモジュールに分割し、各モジュールに対してユニットテストを追加する。
Phase 2 の成功基準「`gateway/api.ts` を 500行以下のファイルに分割」を完全達成し、
branch カバレッジ向上にも貢献する。

## ストーリーと受入基準

### Story 1: レートリミット処理の抽出（S1）

> As a **開発者**, I want to `runWebSession` に埋め込まれたレートリミット待機・リトライループを独立モジュールに抽出したい, so that レートリミット処理をモックで単体テストできる.

**受入基準:**

- [ ] **AC-E026-01**: `session-rate-limit.ts`（または同等の命名ファイル）が `gateway/api/` 以下に存在し、レートリミット検出・待機・リトライの処理が同ファイルに集約されている。← S1
- [ ] **AC-E026-02**: 抽出したレートリミット関数がモック可能な引数シグネチャを持ち（`detectRateLimit` 等の外部依存を注入可能）、`vi.mock` または依存注入でテストできる。← S1
- [ ] **AC-E026-03**: レートリミット状態に入ったセッションが `status: "waiting"` に更新され、`notifyRateLimited` が呼び出されることをモックで検証するユニットテストが通過する。← S1
- [ ] **AC-E026-04**: レートリミットが解除されてリトライが成功した場合に `notifyRateLimitResumed` が呼び出されることを検証するユニットテストが通過する。← S1

**インターフェース:** `gateway/api/session-rate-limit.ts`（新規）

---

### Story 2: Fallback エンジン切り替え処理の抽出（S2）

> As a **開発者**, I want to `runWebSession` に埋め込まれた fallback エンジン切り替え処理を独立モジュールに抽出したい, so that フォールバックロジックをモックで単体テストできる.

**受入基準:**

- [ ] **AC-E026-05**: `session-fallback.ts`（または同等の命名ファイル）が `gateway/api/` 以下に存在し、Claude → Codex フォールバック切り替え・`engineOverride` の書き込みロジックが同ファイルに集約されている。← S2
- [ ] **AC-E026-06**: Claude がレートリミットかつ `strategy === "fallback"` の場合に Codex エンジンが呼び出され、`session.engine` が fallback エンジン名に更新されることをモックで検証するユニットテストが通過する。← S2
- [ ] **AC-E026-07**: fallback エンジンが設定に存在しない場合（`engines.get(fallbackName)` が undefined）にフォールバックをスキップして通常のレートリミット待機に入ることをモックで検証するユニットテストが通過する。← S2（AI 補完: フォールバック不在の境界ケース。既存コードで `if (fallbackEngine)` のブランチがあるが未テスト）

**インターフェース:** `gateway/api/session-fallback.ts`（新規）

---

### Story 3: Transcript 読み込みの fs 抽象化（S3）

> As a **開発者**, I want to `loadRawTranscript` / `loadTranscriptMessages` の `node:fs` 依存をインターフェース抽象化したい, so that モックしてユニットテストを書ける.

**受入基準:**

- [ ] **AC-E026-08**: `loadRawTranscript` と `loadTranscriptMessages` が、`fs.readFileSync` / `fs.readdirSync` 等のファイルシステム操作を直接呼び出さず、注入可能な抽象（関数引数または `FileSystemReader` 型インターフェース）経由でアクセスする。← S3
- [ ] **AC-E026-09**: 存在する JSONL ファイルからエントリが正しくパースされることをインメモリのモック実装で検証するユニットテストが通過する。← S3
- [ ] **AC-E026-10**: 対象ディレクトリが存在しない・ファイルが存在しない・JSON パースエラーが発生する各境界ケースで空配列が返ることをモックで検証するユニットテストが通過する。← S3（AI 補完: 既存コードには `if (!fs.existsSync(claudeProjectsDir)) return []` 等の境界ケースがあるが未テスト）

**インターフェース:** `gateway/api/session-runner.ts`（既存・関数シグネチャ変更）または新規ファイル

---

### Story 4: POST /api/sessions/:id/message ハンドラーの分割（S4）

> As a **開発者**, I want to `handleSessionsRequest` の `POST /api/sessions/:id/message` 処理を独立ハンドラーに抽出したい, so that メッセージ受信フローを単体テストできる.

**受入基準:**

- [ ] **AC-E026-11**: `session-message.ts`（または同等の命名ファイル）が `gateway/api/` 以下に存在し、POST メッセージ受信・割り込み判定・キュー登録・`dispatchWebSessionRun` 呼び出しの処理が同ファイルに集約されている。← S4
- [ ] **AC-E026-12**: `message` フィールドが空の場合に 400 を返すことを検証するユニットテストが通過する。← S4
- [ ] **AC-E026-13**: セッションが `status: "running"` かつ割り込み可能エンジンの場合に `engine.kill` が呼び出されることを検証するユニットテストが通過する。← S4
- [ ] **AC-E026-14**: セッションが `status: "waiting"` の場合に `queuedText` 通知メッセージが挿入されて `session:notification` イベントが発火されることを検証するユニットテストが通過する。← S4（AI 補完: rate-limit 待機中のキュー通知は重要な UX 分岐。現在未テスト）
- [ ] **AC-E026-15**: セッションが `status: "interrupted"` の場合にステータスが `running` にリセットされて `session:resumed` イベントが発火されることを検証するユニットテストが通過する。← S4（AI 補完: 再起動後の interrupted 状態復旧は重要な回復フロー。現在未テスト）

**インターフェース:** `gateway/api/session-message.ts`（新規）

---

### Story 5: キュー操作ハンドラー群の分割（S5）

> As a **開発者**, I want to `handleSessionsRequest` 内のキュー操作エンドポイント（`/queue`, `/queue/:itemId`, `/queue/pause`, `/queue/resume`）を独立ハンドラーに抽出したい, so that キュー操作を単体テストできる.

**受入基準:**

- [ ] **AC-E026-16**: `session-queue-handlers.ts`（または同等の命名ファイル）が `gateway/api/` 以下に存在し、`GET /api/sessions/:id/queue`・`DELETE /api/sessions/:id/queue`・`DELETE /api/sessions/:id/queue/:itemId`・`POST /api/sessions/:id/queue/pause`・`POST /api/sessions/:id/queue/resume` の処理が同ファイルに集約されている。← S5
- [ ] **AC-E026-17**: `DELETE /api/sessions/:id/queue/:itemId` で対象アイテムが存在しない・既に実行中の場合に 409 を返すことを検証するユニットテストが通過する。← S5
- [ ] **AC-E026-18**: `POST /api/sessions/:id/queue/pause` および `resume` でそれぞれ `queue:updated` イベントが `paused: true` / `paused: false` で発火されることを検証するユニットテストが通過する。← S5（AI 補完: イベント発火は SSE 接続クライアントへの通知に直結。現在未テスト）

**インターフェース:** `gateway/api/session-queue-handlers.ts`（新規）

---

### Story 6: セッション CRUD ハンドラーの整理（S6）

> As a **開発者**, I want to `handleSessionsRequest` の CRUD 操作（GET/PATCH/DELETE セッション）を独立ハンドラーに抽出・整理したい, so that CRUD 操作を独立してテストできる.

**受入基準:**

- [ ] **AC-E026-19**: 分割後の各ファイルが 500 行以下であること（`session-runner.ts`・`sessions.ts` を含む全ファイル）。← S6
- [ ] **AC-E026-20**: セッション一覧取得（`GET /api/sessions`）・個別取得（`GET /api/sessions/:id`）・更新（`PATCH /api/sessions/:id`）・削除（`DELETE /api/sessions/:id`）の各エンドポイントが分割後も正常に動作し、既存テストが全 PASS する。← S6
- [ ] **AC-E026-21**: 削除対象セッションが存在しない場合に 404 を返すことを検証するユニットテストが通過する。← S6（AI 補完: CRUD の 404 境界ケースは基本的な品質要件。現在未テスト）

**インターフェース:** `gateway/api/session-crud.ts`（新規、または既存 `sessions.ts` にリファクタリング）

---

### Story 7: ユニットテスト追加 + branch カバレッジ（S7）

> As a **開発者**, I want to 上記で分割した全モジュールにユニットテストを追加したい, so that branch カバレッジ 100% を達成できる.

**受入基準:**

- [ ] **AC-E026-22**: `gateway/api/` 以下の新規・既存ファイルの branch カバレッジが vitest レポートで 100% を達成する。← S7
- [ ] **AC-E026-23**: 各テストファイルが `vi.mock` または依存注入を使用して外部依存（`registry.js`・`logger.js`・`engine`）を完全にモックしており、データベースやファイルシステムに依存しない純粋なユニットテストになっている。← S7

**インターフェース:** `gateway/api/__tests__/`（新規テストディレクトリ）

---

### Story 8: ビルド・テスト全 PASS（S8）

> As a **開発者**, I want to リファクタリング完了後に `pnpm build && pnpm test` が全て PASS することを確認したい, so that 既存動作が維持されていることを保証できる.

**受入基準:**

- [ ] **AC-E026-24**: `pnpm build` がエラーなく完了する（型エラー・インポートエラーなし）。← S8
- [ ] **AC-E026-25**: `pnpm test` が全テスト PASS する（既存テストの破損なし・新規テストも全 PASS）。← S8

**インターフェース:** CI パイプライン

---

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| AC マッピングマトリクス | `docs/domain/session-runner-sessions-refactor-ac-mapping.md` | 完了（G2 通過済み） |
| 集約モデル詳細 | `docs/domain/session-runner-sessions-refactor-domain-model.md` | 完了（Step 2 承認済み） |
| DB スキーマ骨格 | 該当なし（スキーマ変更なし） | スキップ |
| API spec 骨格（モジュール分割仕様） | `docs/design/session-runner-sessions-refactor-api-spec.md` | 完了（Step 3） |
| インフラ設計骨格 | 該当なし（インフラ変更なし） | スキップ |
| バッチ/ジョブ設計骨格 | 該当なし（バッチ処理追加なし） | スキップ |

## ゲート状態

| ゲート | 状態 |
|--------|------|
| G2（AC 承認） | 通過済み |
| G3（設計承認） | 通過済み |

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| POST /api/sessions/:id/message の `message` フィールド | 必須・非空文字列 | 400 Bad Request `{ "error": "message is required" }` |
| POST /api/sessions/:id/message のセッション ID | 存在する SessionID | 404 Not Found |
| DELETE /api/sessions/:id/queue/:itemId のキューアイテム ID | 存在する・未実行中 | 409 Conflict `{ "error": "Item not found or already running" }` |

## ステータス遷移（該当する場合）

本 Epic は既存コードのリファクタリングであり、セッションステータス遷移は変更しない。
既存の `idle → running → idle/error/waiting` 遷移が維持されることを確認すること。

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| Transcript ファイルなし | `engineSessionId` に対応するJSONLファイルが存在しない | 空配列 `[]` を返す | `loadRawTranscript` の正常動作 |
| JSON パースエラー | JSONL の行が不正な JSON | 当該行をスキップして残りのエントリを返す | 部分的な破損データへの耐性 |
| Fallback エンジン未設定 | `config.sessions?.fallbackEngine` に対応するエンジンが `engines.get()` で取得できない | フォールバックをスキップしてレートリミット待機に移行 | エンジン未設定時のフェイルセーフ |
| 実行中セッションへのメッセージ（非割り込みエンジン） | `session.status === "running"` かつ `isInterruptibleEngine()` が false | キューに積んで `session:queued` イベント発火 | 非同期エンジンの安全なキューイング |

## 非機能要件

| 項目 | 基準 |
|------|------|
| ファイルサイズ | 分割後の各ファイルが 500 行以下 |
| branch カバレッジ | `gateway/api/` 以下の新規ファイルで 100% |
| 型安全性 | `pnpm typecheck` エラーなし・`biome` ゼロ警告 |
| 後方互換性 | 既存 API エンドポイントの動作変更なし |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 後続 Epic の開発者（Phase 3 以降の機能追加担当） |
| デリバリーする価値 | `gateway/api/` の各モジュールが 500 行以下になり、レートリミット・フォールバック・メッセージ受信・キュー操作の各処理を独立してテスト・変更できるようになる |
| デモシナリオ | `pnpm test --coverage` で `gateway/api/` の branch カバレッジが 100% と表示される。各ファイルが 500 行以下であることを `wc -l` で確認する |

> 技術基盤 Epic のため対象ユーザーは後続開発者。

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | AC-E026-24・AC-E026-25: `pnpm build && pnpm test` 全 PASS。AC-E026-22: `pnpm test --coverage` で branch カバレッジ 100% |
| 検証環境 | ローカル開発環境（データベース不要・全モック） |
| 前提条件 | `pnpm install` 完了。Node.js / biome / vitest が利用可能 |

## 他 Epic への依存・影響

- **依存:** ES-025（CLI 分割）完了済み・ES-013〜025 の各リファクタリング完了済み
- **影響:** Phase 3 以降の機能追加 Epic（Antigravity エンジン対応等）が `gateway/api/` を修正する際に分割後のモジュール構造を前提にする
- **Feedback Issue:** #158 を本 Epic で解消する

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `loadRawTranscript`/`loadTranscriptMessages` の fs 抽象化の粒度（関数引数 vs インターフェース注入） | 未決定 | Task 分解時に決定 |
| 2 | `session-runner.ts` の残余コード（`runWebSession` 本体）のファイル名・配置 | 未決定 | Task 分解時に決定 |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている
- [ ] ステータス遷移が図示されている（該当する場合）— 本 Epic では変更なし
- [x] 権限が各操作で明記されている（権限制御なし・内部 API）
- [ ] 関連 ADR が参照されている — ADR なし（既存コードのリファクタリングのみ）
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-ENNN-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [x] 所属 BC が記載され、BC キャンバスが docs/domain/ に存在する（該当なし）
- [x] 設計成果物セクションが記入されている（該当なし）
