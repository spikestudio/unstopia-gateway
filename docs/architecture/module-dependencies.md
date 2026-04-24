# モジュール依存関係

## パッケージ構成

```
unstopia-gateway/
├── packages/jimmy/   # jinn-cli — メイン daemon プロセス（Node.js）
└── packages/web/     # @jinn/web — Web UI（Next.js）
```

`packages/web` は HTTP API 経由で `packages/jimmy` と通信します（直接 import はありません）。

---

## packages/jimmy/src — モジュール依存マップ

凡例: `A → B` = A が B に依存（A が B を import する）。`⟷` = 相互依存（循環）。

```
shared/      (基盤層 — 依存なし)
engines/   → shared/
connectors/→ shared/
mcp/       → shared/
stt/       → shared/
cron/      → shared/, connectors/, sessions/(type) ⟷, gateway/(org) ⟷
sessions/  → shared/, engines/, cron/ ⟷, mcp/, gateway/(budgets) ⟷
gateway/   → shared/, engines/, connectors/, sessions/ ⟷, cron/ ⟷
cli/       → (全モジュール)
```

> **循環依存:** `cron/ ⟷ sessions/`、`cron/ ⟷ gateway/`、`sessions/ ⟷ gateway/` の 3 箇所で相互依存が発生しています。TypeScript の `import type`（型のみの import）を活用して循環を緩和しています。

---

## モジュール別 責務と依存

### `shared/`

**責務:** 全モジュール共通の型定義・ユーティリティ。他の内部モジュールに依存しない基盤層。

| ファイル | 主な提供物 |
|---------|-----------|
| `types.ts` | `Engine`, `Connector`, `Session`, `JinnConfig` 等の中心的な型定義 |
| `config.ts` | `loadConfig()` — 設定ファイルの読み込み |
| `paths.ts` | `JINN_HOME`, `SESSIONS_DB`, `SKILLS_DIR` 等のパス定数 |
| `logger.ts` | `logger`, `configureLogger()` |
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
| `claude.ts` | Claude Code（`@anthropic-ai/sdk` + CLI spawn） |
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
| `whatsapp/` | WhatsApp（Baileys） |
| `cron/` | Cron ジョブからのメッセージ配信 |

依存:
- `shared/types`（`Connector`, `IncomingMessage` インターフェース）
- `shared/logger`
- `shared/paths`

---

### `cron/`

**責務:** Cron ジョブのスケジューリングと実行管理。

| ファイル | 主な機能 |
|---------|---------|
| `scheduler.ts` | ジョブのスケジュール・再起動・停止 |
| `jobs.ts` | 設定ファイルからジョブ定義を読み込む |
| `runner.ts` | ジョブの実行ロジック |

依存:
- `shared/`（types, paths, logger）
- `connectors/cron`（Cron コネクター）— `runner.ts`
- `gateway/org`（`findEmployee`, `scanOrg`）— `runner.ts`
- `sessions/manager`（`SessionManager` type）— `runner.ts`, `scheduler.ts`

> `sessions/` も `cron/` を import するため相互依存があります。

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
| `manager.ts` | `SessionManager` — セッション起動・終了・エンジン呼び出し |
| `registry.ts` | SQLite ベースのセッション永続化 |
| `context.ts` | 会話コンテキストの構築・管理 |
| `callbacks.ts` | Connector へのコールバック処理 |
| `fork.ts` | セッションの分岐（fork） |
| `queue.ts` | メッセージキュー管理 |

依存:
- `shared/`（全体）
- `engines/`（Claude, Codex, Gemini — エンジン選択・実行）
- `gateway/budgets`（予算チェック）
- `cron/`（Cron ジョブの制御）
- `mcp/resolver`（MCP 設定の解決）

> **注意:** `sessions/` と `gateway/` には相互依存があります（`sessions/manager` → `gateway/budgets`、`gateway/server` → `sessions/manager`）。

---

### `gateway/`

**責務:** HTTP API サーバー、組織管理、ライフサイクル制御。daemon のコアレイヤー。

| ファイル | 主な機能 |
|---------|---------|
| `server.ts` | Fastify HTTP サーバー・全 API エンドポイント |
| `api.ts` | API ルート定義 |
| `org.ts` / `org-hierarchy.ts` | 組織・従業員・部署の管理 |
| `lifecycle.ts` | daemon の起動・停止フロー |
| `files.ts` | ファイル操作 API |
| `goals.ts` | ゴール管理 |
| `budgets.ts` | 予算管理（セッションコスト上限） |
| `costs.ts` | コスト計算 |
| `services.ts` | サービス管理 |
| `watcher.ts` | ファイル変更監視 |
| `daemon-entry.ts` | daemon エントリーポイント |

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
| `setup.ts` | `jinn setup` — 初回セットアップ |
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
