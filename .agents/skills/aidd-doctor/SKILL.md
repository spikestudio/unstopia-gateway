---
name: aidd-doctor
description: >
  プロジェクトの健康診断を実行する。フレームワーク導入・初期化・開発環境・ローカルCIフック・ブランチ保護・スキル健全性の設定状況を検出し、
  未完了の項目には対応スキルの実行を案内する。
  プロジェクトのセットアップ状況を確認したい場合に常にこのスキルを呼び出す。
type: skill
---

# /aidd-doctor — プロジェクト健康診断

プロジェクトのセットアップ状況を自動検出し、未完了の項目を特定して対応アクションを案内する。診断は読み取り専用で、ファイルの作成・変更は行わない。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| Git リポジトリが初期化済み | `.git/` の存在確認 | `git init` を実行 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| （なし） | — | — | 引数不要。プロジェクトルートを自動検出 |

### capability 呼び出し

該当なし

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| 診断レポート | 対話出力 | カテゴリ別の ✅/⚠️/❌ 判定と推奨アクション一覧 |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-setup fw` | フレームワーク導入が ❌ の場合 |
| `/aidd-setup project` | プロジェクト憲章が ❌ の場合 |
| `/aidd-setup env` | 開発環境が ❌ の場合 |
| `/aidd-setup ci` | ローカル CI フックが ❌ の場合 |
| `/aidd-setup branch-protection` | ブランチ保護が ❌ の場合 |

## Step 1: 入力受付

引数不要。プロジェクトルートを自動検出し、診断を開始する。

## Step 2: 診断実行

以下の 10 カテゴリを順に診断する。

### 2-1: フレームワーク導入

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| `aidd-framework/FRAMEWORK.md` | ファイル存在確認 | Yes |
| `aidd-framework/checklists/` | ディレクトリ存在確認 | Yes |
| `aidd-framework/templates/` | ディレクトリ存在確認 | Yes |
| `aidd-framework/guides/` | ディレクトリ存在確認 | Yes |
| AI エージェント指示ファイルにフレームワーク参照 | `CLAUDE.md` または `AGENTS.md` 内に `aidd-framework` への参照があるか | Yes |
| `.github/ISSUE_TEMPLATE/` | ディレクトリ存在確認 | Yes |

**バージョン乖離チェック:**

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| `.aidd-fw-version` の存在 | ファイル存在確認 | No |
| バージョン乖離 | `.aidd-fw-version` の内容と `gh release list --repo [owner]/[repo] --limit 1 --json tagName --jq '.[0].tagName'` の比較 | No |

乖離が検出された場合: `⚠️ フレームワーク更新が利用可能です（インストール済み: X.X.X, 最新: Y.Y.Y）。/aidd-update-framework を実行してください。` と表示する。
`.aidd-fw-version` が存在しない場合: `⚠️ インストール済みバージョンが不明です（.aidd-fw-version が見つかりません）。/aidd-update-framework を実行してインストール済みバージョンを記録することをお勧めします。` と表示する。

### 2-2: プロジェクト憲章（G0）

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| `docs/PROJECT-CHARTER.md` | ファイル存在確認 | Yes |
| `docs/glossary.md` | ファイル存在確認 | Yes |
| GitHub Labels | `gh label list` で `epic`, `task`, `feedback`, `blocked` の存在確認 | Yes |
| GitHub Labels（`status:in-progress`） | `gh label list` で存在確認 | No |

### 2-3: 技術基盤定義（G0）

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| 規約ドキュメント | `docs/conventions/` 内のファイル数を確認 | Yes |

### 2-4: 開発環境

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| `.mise.toml` | ファイル存在確認 | Yes |
| `.envrc` | ファイル存在確認 | Yes |
| `.env.example` | ファイル存在確認 | Yes |
| `.gitignore` に `.env` | ファイル内容確認 | Yes |
| `Taskfile.yml` | ファイル存在確認 | Yes |
| `compose.yaml` | ファイル存在確認 | No |
| mise, direnv, task コマンド | `--version` で確認 | Yes |
| Docker コマンド | `docker --version` | No |

### 2-5: ローカル環境動作確認

`/aidd-setup env` 完了後にローカルで開発・テストが実行できる状態かを確認する。

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| `dev` タスク定義 | `task --list 2>/dev/null \| grep -qE '^\* dev[ :]'` | Yes |
| `test` タスク定義 | `task --list 2>/dev/null \| grep -qE '^\* test[ :]'` | No |

- `dev` タスクが未定義の場合: ❌（`Taskfile.yml` に `dev` タスクを追加してください）
- `test` タスクが未定義の場合: ⚠️（テストランナーが未設定の可能性があります）

> **Note:** 実際の起動確認（`task dev` の実行）は診断スコープ外。動作確認が必要な場合は `aidd-framework/guides/local-verification.md` を参照。

### 2-6: ローカル CI フック

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| `lefthook.yml` | ファイル存在確認 | Yes |
| lefthook コマンド | `lefthook --version` | Yes |
| `.git/hooks/pre-commit` | ファイル存在確認 | Yes |
| `.git/hooks/pre-push` | ファイル存在確認 | Yes |

### 2-7: ブランチ保護

```bash
gh api repos/{owner}/{repo}/branches/{default_branch}/protection
```

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| ブランチ保護ルール | API レスポンスが 200 | Yes |
| PR 必須 | `required_pull_request_reviews` が存在 | Yes |
| CI ステータスチェック必須 | `required_status_checks` が存在 | Yes |
| force push 禁止 | `allow_force_pushes.enabled` が false | Yes |

API エラー時はスキップし、Settings で手動確認を案内する。

### 2-8: 廃止アーティファクト検出

フレームワーク更新によって廃止されたファイル・設定の残存を検出する。残存している場合は ⚠️ として `/aidd-setup fw` の実行を案内する。

| チェック項目 | 検出方法 | 対処 |
|------------|---------|------|
| `docs/PROJECT-STATUS.md` | ファイル存在確認 | `/aidd-setup fw` が削除を案内（cat-fw.md Step 5） |

### 2-9: スキルパイプライン健全性

CLAUDE.md のスキルパイプラインに記載された全スキルの `SKILL.md` が存在し、frontmatter（name, description）が有効であることを確認する。

### 2-10: スクリプト基盤

| チェック項目 | 検出方法 | 必須 |
|------------|---------|------|
| suppress パターン定義の存在 | `grep -o 'suppress-patterns-start: [^>]*' docs/conventions/prohibitions.md \| head -1` で 1 件以上抽出できること | Yes |

検証コマンド例:

```bash
grep -o 'suppress-patterns-start: [^>]*' docs/conventions/prohibitions.md | head -1
```

抽出結果が空の場合は ❌（`docs/conventions/prohibitions.md` の suppress パターンマーカーが欠落している）として報告する。

## Step 3: 完了処理

診断結果をカテゴリ別に表示し、❌/⚠️ のカテゴリに対して推奨アクションを案内する。

### ステータスアイコン

| アイコン | 意味 | 条件 |
|---------|------|------|
| ✅ | 完了 | 必須項目が全て OK |
| ⚠️ | 注意 | 必須 OK だがオプション項目に欠落 |
| ❌ | 要対応 | 必須項目に欠落がある |

### アクション案内の順序（依存関係順）

1. `/aidd-setup fw`（最優先 — 廃止アーティファクト残存時も同じ）
2. `/aidd-setup project`
3. `/aidd-setup env`（完了後、2-5 のローカル環境動作確認を再チェックすること）
4. `/aidd-setup ci`
5. `/aidd-setup branch-protection`

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う** — 問題の後回しを推奨しない
- 診断は読み取り専用 — ファイルの作成・変更は行わない。理由: 診断と修正の責務を分離し、意図しない変更を防ぐ
- 各チェック項目の成功・失敗を個別に表示する — 理由: 何が欠けているか明確にする
- ❌ のカテゴリには必ず対応スキル名を案内する — 理由: 次のアクションが分かる
- 必須でない項目の欠落で ❌ にしない（⚠️ で表示）— 理由: 過剰な警告は信頼を損なう
- GitHub API やコマンドが失敗した場合はスキップし手動確認を案内する — 理由: 権限不足等で診断が中断しない
- 成果物生成・実装完了時にコミットを自動実行する。ユーザーの指摘反映後・ステップ承認後などの状態遷移ごとにもコミットする。push と PR 作成はユーザーの確認を待つ
