<!-- 配置先: docs/requirements/ES-033-gateway-test-coverage.md — 相対リンクはこの配置先を前提としている -->
# ES-033: src/gateway テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #235 |
| Phase 定義書 | PD-003 |
| Epic | E5 |
| 所属 BC | gateway（HTTP サーバー・ライフサイクル管理層） |
| ADR 参照 | <!-- 該当なし --> |

## 対応ストーリー

<!-- Phase 定義書 PD-003 の E5 から転記 -->

- S1: src/gateway（33% → 90%以上）のテスト追加

## 概要

`src/gateway` 配下のファイル（`server.ts` / `lifecycle.ts` / `files.ts` / `watcher.ts` / `budgets.ts` / `costs.ts`）に対してユニットテストを追加し、branch カバレッジを現状 32.79% から 90% 以上に引き上げる。優先度の高いファイルは `lifecycle.ts`（0%）・`files.ts`（0%）・`watcher.ts`（0%）であり、`budgets.ts`（72.72%）・`costs.ts`（87.5%）の未カバーブランチも補完する。`server.ts`（0%）は依存が多いため、テスタブルな純粋関数を優先してカバーする。

## ストーリーと受入基準

### Story 1.1: lifecycle.ts のテストカバレッジ向上

> As a **開発者**, I want to `lifecycle.ts` の関数（startForeground / startDaemon / stop / getStatus）のテストを追加する, so that デーモンの起動・停止・状態確認のリグレッションを検知できるようにするため.

**受入基準:**

- [ ] **AC-E033-01**: `lifecycle.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E033-02**: `stop()` 関数で PID ファイルが存在し、プロセスが生きている場合に `SIGTERM` を送り `true` を返す ← S1
- [ ] **AC-E033-03**: `stop()` 関数で PID ファイルが存在するが、プロセスが見つからない（ESRCH）場合に PID ファイルを削除してポートフォールバックに移行する ← S1
- [ ] **AC-E033-04**: `stop()` 関数で PID ファイルが存在しない場合にポートスキャンにフォールバックし、プロセスが見つかれば `true` を返す ← S1
- [ ] **AC-E033-05**: `stop()` 関数でポートにもプロセスが存在しない場合に `false` を返す ← S1（AI 補完: 境界条件の完全カバレッジのため）
- [ ] **AC-E033-06**: `getStatus()` 関数で PID ファイルが存在しプロセスが生きている場合に `{ running: true, pid }` を返す ← S1
- [ ] **AC-E033-07**: `getStatus()` 関数で PID ファイルが存在するがプロセスが死んでいる場合（スタレな PID ファイル）にポートフォールバックを試みる ← S1（AI 補完: スタレ PID ファイルケースは重要な境界条件）
- [ ] **AC-E033-08**: `getStatus()` 関数で PID ファイルが存在しない場合にポートフォールバックを試みる ← S1

**インターフェース:** 内部関数（Node.js プロセス管理・ファイルシステム操作）

### Story 1.2: files.ts のテストカバレッジ向上

> As a **開発者**, I want to `files.ts` の HTTP ハンドラー（ファイルアップロード / ダウンロード / 一覧 / 削除 / 転送）のテストを追加する, so that ファイル管理機能のリグレッションを検知できるようにするため.

**受入基準:**

- [ ] **AC-E033-09**: `files.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E033-10**: `ensureFilesDir()` を呼び出すと FILES_DIR が作成される ← S1
- [ ] **AC-E033-11**: `handleFilesRequest` で `GET /api/files` を呼び出すとファイル一覧を含む JSON レスポンスが返る ← S1
- [ ] **AC-E033-12**: `handleFilesRequest` で `GET /api/files/:id` を呼び出すと、存在するファイルがダウンロードできる ← S1
- [ ] **AC-E033-13**: `handleFilesRequest` で存在しない `id` を `GET /api/files/:id` で取得すると 404 が返る ← S1（AI 補完: エラーケースはユーザー体験上必須）
- [ ] **AC-E033-14**: `handleFilesRequest` で `GET /api/files/:id/meta` を呼び出すとメタデータ JSON が返る ← S1
- [ ] **AC-E033-15**: `handleFilesRequest` で JSON ボディの `POST /api/files`（base64 content）を呼び出すとファイルが保存され 201 と FileMeta が返る ← S1
- [ ] **AC-E033-16**: JSON ボディで `filename` が欠落している場合に 400 が返る ← S1（AI 補完: バリデーションエラーのカバレッジ）
- [ ] **AC-E033-17**: JSON ボディで `content` と `url` の両方が指定された場合に 400 が返る ← S1（AI 補完: バリデーションエラーのカバレッジ）
- [ ] **AC-E033-18**: JSON ボディで `content` も `url` も指定されない場合に 400 が返る ← S1（AI 補完: バリデーションエラーのカバレッジ）
- [ ] **AC-E033-19**: `resolveDestination` でホワイトリスト外の URL を指定した `POST /api/files/transfer` が 403 を返す ← S1（AI 補完: セキュリティ境界条件）

**インターフェース:** HTTP ルートハンドラー `handleFilesRequest(req, res, pathname, method, context)`

### Story 1.3: watcher.ts のテストカバレッジ向上

> As a **開発者**, I want to `watcher.ts` の関数（syncSkillSymlinks / startWatchers / stopWatchers）のテストを追加する, so that ファイル変更監視の挙動変更を検知できるようにするため.

**受入基準:**

- [ ] **AC-E033-20**: `watcher.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E033-21**: `syncSkillSymlinks()` を呼び出すと `.claude/skills/` と `.agents/skills/` に `skills/` のサブディレクトリへのシンボリックリンクが作成される ← S1
- [ ] **AC-E033-22**: `syncSkillSymlinks()` で既存のシンボリックリンクが `skills/` に存在しないスキル名のものは削除される（ストールリンク除去） ← S1（AI 補完: ストールリンク除去ロジックの重要な境界条件）
- [ ] **AC-E033-23**: `syncSkillSymlinks()` で `skills/` ディレクトリが存在しない場合にエラーなく完了する ← S1（AI 補完: skills ディレクトリ不在時の堅牢性）
- [ ] **AC-E033-24**: `startWatchers()` を呼び出してから `stopWatchers()` を呼び出すとウォッチャーが正常に停止する ← S1
- [ ] **AC-E033-25**: `stopWatchers()` を複数回呼び出してもエラーにならない ← S1（AI 補完: 冪等性の保証）

**インターフェース:** 内部関数（chokidar ウォッチャー管理・ファイルシステム操作）

### Story 1.4: budgets.ts / costs.ts の未カバーブランチ補完

> As a **開発者**, I want to `budgets.ts` / `costs.ts` の未カバーブランチのテストを追加する, so that 予算・コスト計算のエッジケースを保護できるようにするため.

**受入基準:**

- [ ] **AC-E033-26**: `budgets.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E033-27**: `costs.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E033-28**: `getBudgetStatus()` で `percent >= 100` の場合に `status: "paused"` を返す ← S1（AI 補完: 既存テストで未カバーの分岐）
- [ ] **AC-E033-29**: `getBudgetStatus()` で `percent >= 80 && percent < 100` の場合に `status: "warning"` を返す ← S1（AI 補完: 既存テストで未カバーの分岐）
- [ ] **AC-E033-30**: `getCostsByEmployee()` で `period: "week"` を指定した場合に正しい cutoff 日付で集計される ← S1（AI 補完: costs.ts の未カバーブランチ）

**インターフェース:** 内部関数（SQLite DB 操作）

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | 該当なし | 該当なし |
| DB スキーマ骨格 | 該当なし | 該当なし |
| API spec 骨格 | 該当なし | 該当なし |

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| POST /api/files (JSON) の `filename` | 必須 | 400: "filename is required" |
| POST /api/files (JSON) の `content`/`url` | どちらか一方のみ必須 | 400: "content or url is required" または "content and url are mutually exclusive" |
| POST /api/files (multipart) のファイルサイズ | 50 MB 以下 | 400: "File exceeds 50 MB limit" |
| POST /api/files/transfer の `destination` | 必須 | 400: "destination is required" |
| POST /api/files/transfer の `destination` | config.yaml remotes ホワイトリストに含まれること | 403: "Remote '...' is not in config.yaml remotes whitelist" |

## ステータス遷移（該当する場合）

該当なし

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| ファイル未発見（ダウンロード） | `GET /api/files/:id` で DB にレコードなし | 404 JSON レスポンス | |
| ファイル未発見（ダウンロード） | DB にレコードはあるがディスク上にファイルなし | 404 JSON レスポンス | |
| transfer ホワイトリスト違反 | destination が remotes ホワイトリスト外 | 403 JSON レスポンス | |
| PID ファイルなし＋ポートにも不在 | stop() 呼び出し | false を返す（エラーなし） | |
| スタレ PID ファイル (ESRCH) | stop() の process.kill が ESRCH を返す | PID ファイルを削除してポートフォールバックへ | |

## 非機能要件

| 項目 | 基準 |
|------|------|
| テスト実行速度 | 全テストが 10 秒以内に完了する |
| テスト独立性 | 各テストが独立して実行でき、他テストの状態に依存しない |
| モック使用 | 外部依存（chokidar / child_process / network）は vi.mock でモックする |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 後続 Epic・リファクタリング担当の開発者 |
| デリバリーする価値 | `src/gateway` の branch カバレッジが 32.79% → 90% 以上になることで、lifecycle / files / watcher のリグレッションを自動検知できるようになる |
| デモシナリオ | `pnpm test -- --coverage` 実行後、`src/gateway` の branch カバレッジが 90% 以上であることをカバレッジレポートで確認する |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | `pnpm test -- --coverage` を実行し、`src/gateway` の branch カバレッジが 90% 以上であることをカバレッジレポートで確認する |
| 検証環境 | ローカル Node.js 環境。SQLite は tmpdir に配置し実 DB に触れない |
| 前提条件 | pnpm install 済み。chokidar / fs / child_process は vi.mock でモックする |

## 他 Epic への依存・影響

- ES-032（src/gateway/api テストカバレッジ向上）: 同一 `src/gateway` ディレクトリ内だが対象ファイルが異なるため競合しない
- `lifecycle.ts` は `server.ts` に依存しているが、`server.ts` 自体のテストはスコープ外（依存度が高く統合テストが必要なため）

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `server.ts`（0%）全体のカバレッジ向上: HTTPサーバー立ち上げは統合テストが必要なため本 Epic ではスコープ外とする | 確定（スコープ外） | Phase 4 以降 |
| 2 | `watcher.ts` の chokidar イベントシミュレーション: vi.mock でのイベント発火テストの詳細実装 | 実装時に決定 | Task 定義 |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている
- [ ] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（権限制御なし、内部 API）
- [x] 関連 ADR が参照されている（該当なし）
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-ENNN-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [x] 所属 BC が記載されている（gateway — HTTP サーバー・ライフサイクル管理層）
- [x] 設計成果物セクションが記入されている（該当なし）
