# モジュール依存関係

> **最終更新: 2026-04-28 — Phase 2（PD-002）完了時点の状態を反映**

## パッケージ構成

```
unstopia-gateway/
├── packages/jimmy/   # jinn-cli — メイン daemon プロセス（Node.js）
└── packages/web/     # @jinn/web — Web UI（Next.js）
```

`packages/web` は HTTP API 経由で `packages/jimmy` と通信します（直接 import はありません）。

---

## packages/jimmy/src — モジュール依存マップ

凡例: `A → B` = A が B に依存（A が B を import する）。

```
shared/      (基盤層 — 依存なし)
engines/   → shared/
connectors/→ shared/
mcp/       → shared/
stt/       → shared/
cron/      → shared/, connectors/, gateway/(org)
sessions/  → shared/, engines/, cron/, mcp/, gateway/(budgets)
gateway/   → shared/, engines/, connectors/, sessions/, cron/
gateway/types → sessions/(type), shared/
cli/       → (全モジュール)
```

> **ES-011（2026-04-25）にて循環依存をゼロ化済み。**
> - `gateway/api ⟷ gateway/files` サイクル: `ApiContext` を `gateway/types.ts` に分離して解消
> - `cron ⟷ sessions` サイクル: `SessionRouter` インターフェースを `shared/types.ts` に追加し、`cron/` が `sessions/manager.ts` に直接依存しないよう変更して解消
> - 現在 `npx madge --circular packages/jimmy/src` はゼロ件を報告

---

## モジュール別 責務と依存

### `shared/`

**責務:** 全モジュール共通の型定義・ユーティリティ。他の内部モジュールに依存しない基盤層。

| ファイル | 主な提供物 |
|---------|-----------|
| `types.ts` | `Engine`, `Connector`, `Session`, `JinnConfig` 等の中心的な型定義 |
| `config.ts` | `loadConfig()` — 設定ファイルの読み込み |
| `paths.ts` | `JINN_HOME`, `SESSIONS_DB`, `SKILLS_DIR` 等のパス定数 |
| `logger.ts` | `logger`, `configureLogger()`, `LogContext`（ES-023: JSON 構造化ログ対応済み） |
| `result.ts` | `Result<T,E>`, `Ok<T>`, `Err<E>`, `ok()`, `err()`, `isOk()`, `isErr()`（ES-021 追加） |
| `errors.ts` | `AppError`, `RepositoryError`, `appError()`, `repositoryError()`（ES-021 追加） |
| `retry.ts` | `exponentialBackoffMs()`, `withRetry<T>()`（ES-024 追加） |
| `effort.ts` | `resolveEffort()` — エフォートレベルの解決 |
| `rateLimit.ts` | レートリミット情報の解析・判定 |
| `usageAwareness.ts` | 使用量の認識・警告 |
| `version.ts` | `getPackageVersion()` |

依存: なし（外部ライブラリのみ）

---

### `engines/`

**責務:** AI エンジン（Claude / Codex / Gemini / Mock）へのアダプター。`Engine` インターフェースを実装する。

| ファイル | エンジン |
|---------|---------|
| `claude.ts` | Claude Code（`@anthropic-ai/sdk` + CLI spawn）— `ClaudeStreamProcessor` を利用 |
| `claude-stream-processor.ts` | Claude ストリーミング状態機械（`Idle/InText/InTool`）（ES-019 追加） |
| `codex.ts` | OpenAI Codex（CLI spawn） |
| `gemini.ts` | Google Gemini（API） |
| `mock.ts` | テスト用モックエンジン |

依存:
- `shared/logger`
- `shared/rateLimit`
- `shared/types`（`Engine`, `EngineRunOpts`, `EngineResult` インターフェース）

---

### `connectors/`

**責務:** メッセージングプラットフォームとの接続。`Connector` インターフェースを実装する。

| ディレクトリ | プラットフォーム |
|------------|---------------|
| `telegram/` | Telegram Bot API（grammy） |
| `slack/` | Slack API |
| `discord/` | Discord API |
| `whatsapp/` | WhatsApp（Baileys）— 再接続バックオフに `shared/retry.exponentialBackoffMs` を使用（ES-024） |
| `cron/` | Cron ジョブからのメッセージ配信 |

依存:
- `shared/types`（`Connector`, `IncomingMessage` インターフェース）
- `shared/logger`
- `shared/paths`
- `shared/retry`（WhatsApp のみ — ES-024）

---

### `cron/`

**責務:** Cron ジョブのスケジューリングと実行管理。

| ファイル | 主な機能 |
|---------|---------|
| `scheduler.ts` | ジョブのスケジュール・再起動・停止 |
| `jobs.ts` | 設定ファイルからジョブ定義を読み込む |
| `runner.ts` | ジョブの実行ロジック |

依存:
- `shared/`（types, paths, logger）— `SessionRouter` インターフェースも `shared/types` に定義
- `connectors/cron`（Cron コネクター）— `runner.ts`
- `gateway/org`（`findEmployee`, `scanOrg`）— `runner.ts`

> `runner.ts`・`scheduler.ts` は `SessionRouter`（`shared/types.ts` 定義）を使用。`sessions/manager.ts` への直接依存を除去済み（ES-011）。

---

### `mcp/`

**責務:** MCP（Model Context Protocol）サーバーの提供。エンジンへの追加コンテキストを供給する。

| ファイル | 主な機能 |
|---------|---------|
| `gateway-server.ts` | MCP サーバーの起動・提供 |
| `resolver.ts` | MCP サーバー設定の解決・書き出し |

依存:
- `shared/`（paths, types）

---

### `stt/`

**責務:** 音声テキスト変換（Speech-to-Text）。

| ファイル | 主な機能 |
|---------|---------|
| `stt.ts` | 音声入力のテキスト変換 |

依存:
- `shared/`（types, logger）

---

### `sessions/`

**責務:** セッションのライフサイクル管理（作成・継続・終了）、会話コンテキストの保持。

| ファイル | 主な機能 |
|---------|---------|
| `manager.ts` | `SessionManager` — セッション起動・終了・エンジン呼び出し（268行。ES-014 で分割） |
| `engine-runner.ts` | `runSession` — エンジン実行コア（ES-014 で `manager.ts` より抽出） |
| `cron-command-handler.ts` | Cron コマンド処理（ES-014 で `manager.ts` より抽出） |
| `registry.ts` | Repository ファサード — SQLite 永続化への委譲（ES-017 でファサード化） |
| `context.ts` | 会話コンテキストの構築・管理 |
| `callbacks.ts` | Connector へのコールバック処理 |
| `fork.ts` | セッションの分岐（fork） |
| `queue.ts` | メッセージキュー管理 |
| `repositories/` | Repository パターン実装（ES-017 追加） |

#### `sessions/repositories/`

| ファイル | 内容 |
|---------|------|
| `ISessionRepository.ts` | セッション Repository インターフェース（Result 型対応 — ES-021） |
| `IMessageRepository.ts` | メッセージ Repository インターフェース |
| `IQueueRepository.ts` | キュー Repository インターフェース |
| `IFileRepository.ts` | ファイル Repository インターフェース |
| `SqliteSessionRepository.ts` | SQLite 実装 |
| `SqliteMessageRepository.ts` | SQLite 実装 |
| `SqliteQueueRepository.ts` | SQLite 実装 |
| `SqliteFileRepository.ts` | SQLite 実装 |
| `InMemorySessionRepository.ts` | インメモリ実装（テスト用） |
| `InMemoryMessageRepository.ts` | インメモリ実装（テスト用） |
| `InMemoryQueueRepository.ts` | インメモリ実装（テスト用） |
| `InMemoryFileRepository.ts` | インメモリ実装（テスト用） |

依存:
- `shared/`（全体）
- `shared/result`・`shared/errors`（Repository インターフェースの戻り値型 — ES-021）
- `engines/`（Claude, Codex, Gemini — エンジン選択・実行）
- `gateway/budgets`（予算チェック）
- `cron/`（Cron ジョブの制御）
- `mcp/resolver`（MCP 設定の解決）

> `sessions/manager` → `gateway/budgets` の依存は静的 import として残存しています（ES-011 では type-level サイクルのみ解消）。`gateway/server` → `sessions/manager` と組み合わせて一方向性が保たれており、madge ではサイクルなしと判定されます。

---

### `gateway/`

**責務:** HTTP API サーバー、組織管理、ライフサイクル制御。daemon のコアレイヤー。

| ファイル/ディレクトリ | 主な機能 |
|---------------------|---------|
| `server.ts` | HTTP サーバー・エントリーポイント・DI 組み立て（Composition Root — ES-012） |
| `container.ts` | エンジン・コネクター・Repository ファクトリ（ES-012 追加） |
| `api.ts` | API ルートディスパッチャ（39行。ES-013 で分割済み） |
| `api/` | ドメイン別 API ハンドラー（ES-013 追加） |
| `api/api-types.ts` | リクエスト・レスポンス型定義（ES-022 追加） |
| `types.ts` | `ApiContext` インターフェース定義（ES-011 で `api.ts` から分離） |
| `org.ts` / `org-hierarchy.ts` | 組織・従業員・部署の管理 |
| `lifecycle.ts` | daemon の起動・停止フロー |
| `files.ts` | ファイル操作 API |
| `goals.ts` | ゴール管理 |
| `budgets.ts` | 予算管理（セッションコスト上限） |
| `costs.ts` | コスト計算 |
| `services.ts` | サービス管理 |
| `watcher.ts` | ファイル変更監視 |
| `daemon-entry.ts` | daemon エントリーポイント |

#### `gateway/api/` — ドメイン別ハンドラー（ES-013 分割）

| ファイル | 担当 API ドメイン |
|---------|----------------|
| `sessions.ts` | `/api/sessions/*` — セッション CRUD |
| `session-runner.ts` | セッション実行（メッセージキュー） |
| `org.ts` | `/api/org/*` — 組織・従業員管理 |
| `cron.ts` | `/api/cron/*` — Cron ジョブ管理 |
| `connectors.ts` | `/api/connectors/*` — コネクター操作 |
| `skills.ts` | `/api/skills/*` — スキル管理 |
| `misc.ts` | `/api/status`, `/api/config` 等 |
| `stt.ts` | `/api/stt/*` — 音声認識 |
| `utils.ts` | 共通ユーティリティ（ボディパース等） |
| `api-types.ts` | リクエスト・レスポンス型（ES-022） |

依存:
- `shared/`（全体）
- `engines/`（Claude, Codex, Gemini）
- `connectors/`（全コネクター）
- `sessions/`（`SessionManager`, `registry`）
- `cron/`（スケジューラー）

---

### `cli/`

**責務:** ユーザー向け CLI コマンド群。`pnpm jinn <command>` のエントリーポイント。

| ファイル | コマンド |
|---------|---------|
| `setup.ts` | `jinn setup` — 初回セットアップ（288行。ES-025 で分割） |
| `setup-ui.ts` | コンソール出力ユーティリティ（ok/warn/fail/info/prompt）（ES-025 追加） |
| `setup-fs.ts` | ファイルシステムユーティリティ（whichBin/ensureDir 等）（ES-025 追加） |
| `setup-context.ts` | プロジェクトコンテキスト検出・デフォルト設定（ES-025 追加） |
| `start.ts` | `jinn start` — daemon 起動 |
| `stop.ts` | `jinn stop` — daemon 停止 |
| `create.ts` | `jinn create` — 組織・従業員作成 |
| `list.ts` | `jinn list` — 一覧表示 |
| `instances.ts` | `jinn instances` — インスタンス一覧 |
| `remove.ts` | `jinn remove` — 削除 |
| `skills.ts` | `jinn skills` — スキル管理 |
| `migrate.ts` | `jinn migrate` — データ移行 |
| `nuke.ts` | `jinn nuke` — 全データ削除 |
| `status.ts` | `jinn status` — 状態確認 |
| `chrome-allow.ts` | Chrome 許可設定 |

依存: 全モジュール（gateway, sessions, engines, connectors, cron, mcp, stt, shared）

---

## packages/web — Web UI

**責務:** ブラウザ向け管理 UI（Next.js App Router）。

- `packages/jimmy` との通信: HTTP API（REST）経由
- 直接 import: なし（`packages/jimmy` の型は API レスポンスとして受け取る）

主な画面: Chat / Sessions / Org / Kanban / Cron / Settings / Skills / Logs
