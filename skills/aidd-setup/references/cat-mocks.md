# カテゴリ: mocks（モック環境構築）

mocks/ ディレクトリに自己完結のモック環境（React + Next.js + shadcn/ui + Storybook）を構築する。

> テーマは `ui/globals.css` で定義（Catalyst-like 単一テーマ、ADR-006 参照）。
> モック構築の手順は `aidd-framework/guides/mock-development.md` を参照。
> テンプレートカタログは `ui/catalog.json` を参照。

## 前提条件

- Node.js がインストール済み（`node --version`）
- パッケージマネージャーがインストール済み（`pnpm --version` 等）

## 手順

### 1. 環境確認

```bash
node --version
pnpm --version || npm --version || yarn --version
ls mocks/ 2>/dev/null
```

mocks/ が既に存在する場合は上書きせず、差分を確認して不足部分のみ追加を提案する。

### 2. React (Next.js) + shadcn/ui 環境構築

1. `mocks/` ディレクトリに Next.js プロジェクトを初期化
   - TypeScript, Tailwind CSS, ESLint, App Router
   - dev ポートは 3001（本番の 3000 と被らない）
2. 追加パッケージ: next-themes, lucide-react
3. `app/layout.tsx`: ThemeProvider 設定（next-themes）
4. `app/page.tsx`: インデックスページ（モック案内）
5. テーマ適用: `mocks/app/globals.css` に `@import "@repo/ui/globals.css"`（Catalyst-like 単一テーマ、ADR-006）
6. shadcn/ui 初期化 + 基本コンポーネント一括インストール:
   - フォーム: button, input, label, select, textarea, checkbox, radio-group, switch
   - レイアウト: card, separator, tabs, sheet, sidebar
   - データ表示: table, badge, avatar, skeleton
   - フィードバック: dialog, alert-dialog, sonner, tooltip
   - ナビゲーション: navigation-menu, breadcrumb, dropdown-menu

### 3. FW コンポーネントのコピー + Storybook 初期化

**FW コンポーネントのコピー:**

プラグインディレクトリから:

- `layouts/*.tsx` → `mocks/templates/layouts/`
- `pages/*.tsx` → `mocks/templates/pages/`
- `composites/*.tsx` → `mocks/templates/composites/`
- `catalog.json` → `mocks/templates/catalog.json`

**Storybook セットアップ:**

1. Storybook 初期化（`storybook@latest init`）
2. addon-themes インストール
3. `.storybook/main.ts`: stories パス設定
4. `.storybook/preview.ts`: テーマ切替（ライト/ダーク）+ globals.css 読み込み
5. Stories 自動生成:
   - レイアウト: デフォルト表示の Story
   - ページ: catalog.json の states 配列から各状態の Story
   - コンポーネント: バリアントごとの Story
6. `package.json` に storybook, build-storybook スクリプト追加

**デザインシステム定義テンプレートの配置:**

- `${PLUGIN_DIR}/skills/aidd-setup/references/design/ui-component-arch.md` → `docs/design/design-system.md`
- `${PLUGIN_DIR}/skills/aidd-setup/references/design/ui-visual-tokens.md` → `docs/conventions/ui-visual-tokens.md`
- `${PLUGIN_DIR}/skills/aidd-setup/references/design/ui-patterns.md` → `docs/conventions/ui-patterns.md`

### 4. .gitignore 更新

以下が含まれていなければ追加:

- `mocks/node_modules/`
- `mocks/.next/`
- `mocks/storybook-static/`

### 5. 動作確認

```bash
cd mocks && pnpm dev        # http://localhost:3001
cd mocks && pnpm storybook  # http://localhost:6006
```

| 項目 | 確認内容 |
|------|---------|
| Next.js 起動 | `http://localhost:3001` でモックインデックスページが表示される |
| Storybook 起動 | `http://localhost:6006` で Storybook が表示される |
| テーマ適用 | プリセットの色がコンポーネントに反映されている |
| ダークモード | Storybook のテーマ切替でライト/ダークが正しく切り替わる |
| テンプレート Stories | layouts / pages / composites の Stories が全て表示される |
| コンポーネントファイル | mocks/templates/ に全コンポーネントがコピーされている |

### 6. モック共有方法の決定

| # | 方法 | 特徴 |
|---|------|------|
| 1 | Vercel Preview（推奨） | PR ごとにプレビュー URL 自動生成。顧客が操作可能 |
| 2 | Cloudflare Pages | Vercel が使えない場合。無料枠が広い |
| 3 | GitHub Pages | 静的エクスポートで十分な場合 |
| 4 | スクリーンショット + 動画 | ホスティング不要。最低限の共有 |

## 完了条件

- `mocks/` ディレクトリに Next.js + shadcn/ui + Storybook 環境が構築されている
- テーマプリセットが適用されている
- FW コンポーネントが `mocks/templates/` にコピーされている
- Stories が自動生成されている
- `docs/design/design-system.md` が配置されている
- Next.js（localhost:3001）と Storybook（localhost:6006）が起動する
- ダークモード切替が動作する
- モック共有方法が決定されている
