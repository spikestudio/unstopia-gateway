# ディレクトリ構造

技術スタック: TypeScript 5.8 / Node.js 22 / pnpm monorepo + Turborepo

## プロジェクトルート

```
unstopia-gateway/
├── packages/
│   ├── jimmy/                  # コアデーモン (Node.js ESM)
│   │   ├── bin/                # CLI エントリポイント (jimmy.ts)
│   │   ├── src/
│   │   │   ├── engines/        # AI エンジンアダプター (claude.ts / codex.ts / gemini.ts)
│   │   │   ├── connectors/     # プラットフォームコネクター
│   │   │   │   ├── slack/      # コネクターごとにサブディレクトリ
│   │   │   │   ├── discord/
│   │   │   │   ├── telegram/
│   │   │   │   └── whatsapp/
│   │   │   ├── sessions/       # セッション管理・SQLite
│   │   │   ├── gateway/        # ゲートウェイコア・HTTP API
│   │   │   ├── mcp/            # MCP サーバー管理
│   │   │   ├── cron/           # Cron スケジューラ
│   │   │   ├── stt/            # Speech-to-Text
│   │   │   ├── cli/            # CLI コマンド定義
│   │   │   └── shared/         # 共通型・ユーティリティ・ロガー
│   │   ├── template/           # ~/.jinn/ 初期テンプレートファイル
│   │   └── __tests__/          # ユニットテスト (各 src/ サブディレクトリと対応)
│   └── web/                    # Next.js Web UI
│       └── app/                # App Router ページ・コンポーネント
├── docs/
│   ├── requirements/           # Phase 定義書・要件定義
│   ├── architecture/adr/       # Architecture Decision Records
│   ├── tasks/                  # Task 定義書
│   ├── conventions/            # 規約ドキュメント (このディレクトリ)
│   └── research/               # 技術調査レポート
├── aidd-framework/             # フレームワーク本体 ← 直接編集禁止
├── e2e/                        # Playwright E2E テスト
├── .claude/agents/             # AI エージェントペルソナ
└── .github/
    ├── workflows/              # GitHub Actions
    └── ISSUE_TEMPLATE/         # Issue テンプレート
```

## 新規ファイルの配置判断基準

| 判断基準 | 配置先 |
|---------|--------|
| AI エンジンの新規追加 | `packages/jimmy/src/engines/<name>.ts` |
| プラットフォームコネクターの新規追加 | `packages/jimmy/src/connectors/<name>/` |
| 複数モジュールで使う型・インターフェース | `packages/jimmy/src/shared/types.ts` |
| 単一モジュール内でしか使わない型 | そのモジュールのファイル内に定義 |
| HTTP API ハンドラ | `packages/jimmy/src/gateway/` |
| ユニットテスト | `packages/jimmy/src/__tests__/` または対象ファイルと同ディレクトリの `__tests__/` |
| E2E テスト | `e2e/` |
| Web UI のページ | `packages/web/app/` |
| Phase 定義・仕様書 | `docs/requirements/` |
| ADR | `docs/architecture/adr/` |

## 禁止される配置パターン

```ts
// 誤: shared/ に特定モジュール専用の実装を置く
// packages/jimmy/src/shared/slack-helpers.ts  ← slack/ 配下に置くべき

// 誤: engines/ にエンジン以外のロジックを置く
// packages/jimmy/src/engines/session-utils.ts  ← sessions/ 配下に置くべき

// 誤: aidd-framework/ を直接編集する
// aidd-framework/FRAMEWORK.md を直接書き換える  ← /aidd-setup fw で上書きされる
```

## 強度

- 新規エンジン・コネクターの配置先: MUST
- `shared/` への配置判断: MUST（単一モジュール専用は shared/ 禁止）
- `aidd-framework/` の編集禁止: MUST
