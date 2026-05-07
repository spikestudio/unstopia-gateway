---
name: aidd-update-framework
description: >
  インストール済みプロジェクトを最新フレームワークバージョンに追従させる。
  バージョン差分の確認・全ファイル更新・CLAUDE.md/AGENTS.md 移行・プロジェクト固有設定差分適用を自律的に完遂する。
  フレームワークを最新版に更新したい場合は常にこのスキルを呼び出す。
type: skill
argument-hint: "[--version <tag>]"
---

# /aidd-update-framework — フレームワーク更新

インストール済みのプロジェクトを最新フレームワークバージョンに追従させる。バージョン差分確認・全置き換え・CLAUDE.md/AGENTS.md 移行・プロジェクト固有設定差分適用を 4 ステップで実行する。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| フレームワーク導入済み | `.aidd-fw-version` 存在確認 | 未存在の場合は全更新モードでフォールバック |

### capability 呼び出し

このスキルは他のスキルを capability として呼び出しません。

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| バージョン | 引数 `--version <tag>` | 任意 | 省略時は最新リリースを自動取得 |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| 更新サマリー | ブリーフィング | 更新内容・移行処理・差分適用結果 |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-doctor` | 更新後の環境確認 |
| `/aidd-next` | 次のアクション提案 |

## Step 0: バージョン確認・差分ゼロ確認

1. `.aidd-fw-version` を読み込む。存在しない場合は全更新モードへフォールバック（バージョン不明として扱う）
2. `$ARGUMENTS` に `--version <tag>` が指定されている場合はそのバージョンをターゲットとする。指定がない場合は `gh release list` で最新バージョンを取得する
3. インストール済み = ターゲットバージョンの場合: 「最新版インストール済みです（バージョン: X.X.X）。更新は不要です。」を通知して正常終了
4. `gh release view <tag>` で Release Notes（Changelog）を取得し、変更内容一覧をユーザーに提示する
5. ユーザーの承認を得てから Step 1 へ進む

## Step 1: 全置き換え対象の更新

> **前提: Step 0 の承認が完了していること。**

`references/step1-replace.md` を読み込んで実行する。

**概要:** フレームワーク管理ファイルをすべて最新版で上書きする。

以下を漏れなく全置き換えする:

- `aidd-framework/` 全削除 → PLUGIN_DIR から全コピー
- `.agents/skills/` PLUGIN_DIR の `skills/` から全コピー（PLUGIN_DIR の `.agents/skills/` は使用しない）
- `aidd-framework/CLAUDE-base.md` PLUGIN_DIR から全置き換え
- （`aidd-framework/AGENTS.md` は廃止。managed セクションのソースは `agents-md.md` を使用）
- `.github/ISSUE_TEMPLATE/*.yml` references/ から全置き換え
- `.github/workflows/merge-guard.yml` references/ から全置き換え
GitHub Labels 冪等再作成（`--force`）:

- status:in-progress, gate:reviewed, gate:briefed, gate:approved
- epic, task, feedback, blocked

## Step 2: CLAUDE.md / AGENTS.md 移行処理

> **前提: Step 1 が完了していること。**

`references/step2-migrate.md` を読み込んで実行する。

**概要:** CLAUDE.md と AGENTS.md に移行処理を行い、フレームワーク管理範囲を最新化する。

**CLAUDE.md の処理:**

- `<!-- aidd-fw:import-start -->` 行が存在する場合 → CLAUDE.md は編集しない（CLAUDE-base.md は Step 1 で更新済み）
- 存在しない場合 → `cat-fw.md §AI エージェント指示ファイルの設計方針` に従い移行処理を実行（テンプレート管理 8 セクションを除去し @import 行を追加）

**AGENTS.md の処理:**

- `<!-- aidd-fw:managed-start -->` マーカーが存在する場合 → managed 範囲を `${PLUGIN_DIR}/skills/aidd-setup/references/agents-md.md` の managed 範囲で全置き換え
- 存在しない場合 → ユーザーに手動確認を求める（自動処理を強行しない）

## Step 3: プロジェクト固有設定の差分適用

> **前提: Step 2 が完了していること。**

`references/step3-diff.md` を読み込んで実行する。

**概要:** 旧バージョンと新バージョンの設定テンプレートを比較し、フレームワークが追加した要素のみを検出してプロジェクト固有カスタマイズを保持しつつ適用する。

**対象ファイルと検出内容:**

| ファイル | テンプレート | 検出内容 |
|---------|------------|---------|
| `CLAUDE.md`（プロジェクト固有部分） | `aidd-setup/references/claude-md.md` | fw が追加した新規セクション |
| `AGENTS.md`（プロジェクト固有部分） | `aidd-setup/references/agents-md.md` | fw が追加した新規セクション |
| `README.md` | `aidd-setup/references/project-readme.md` | fw が追加した新規セクション |
| `.mise.toml` | PLUGIN_DIR | fw が新たに必須とした tools の追加 |
| `lefthook.yml` | PLUGIN_DIR | fw が追加した新規 hooks のマージ |
| `Taskfile.yml` | PLUGIN_DIR | fw が追加したタスクの追加 |
| `.gitignore` | PLUGIN_DIR | fw が追加したパターンの追加 |
| `compose.yaml` | PLUGIN_DIR | fw が追加したサービスの追加 |
| `docs/conventions/` 配下全ファイル | `aidd-setup/references/cat-conventions.md` | fw テンプレートに追加されたセクションの提案 |
| `.github/workflows/ci.yml` | `aidd-setup/references/cat-ci.md` | fw CI テンプレートの更新 |
| branch-protection ルール | `aidd-setup/references/cat-branch-protection.md` | fw 標準に追加されたルールの提示 |

各ファイルの差分をユーザーに提示 → 承認 → 適用。プロジェクト固有カスタマイズは保持する。

## Step 4: .aidd-fw-version 更新・完了処理

> **前提: Step 3 が完了していること。**

0. **カレントブランチを確認する**

   ```bash
   git branch --show-current
   ```

   - `main` の場合: 次のコマンドで専用ブランチを作成してから進む

     ```bash
     git checkout -b chore/fw-update-<新バージョン>
     ```

   - `main` 以外の場合: そのまま手順 1 へ進む

1. `.aidd-fw-version` を新バージョン（gh release で取得した最新バージョン）で更新する

2. 変更ファイルをコミットする

   ```bash
   git add .aidd-fw-version aidd-framework/ .agents/skills/ .github/ .claude/agents/ \
     CLAUDE.md AGENTS.md README.md \
     .mise.toml lefthook.yml Taskfile.yml .gitignore compose.yaml \
     docs/conventions/
   git commit -m "chore: フレームワークを <新バージョン> に更新"
   ```

3. 手順 0 で新ブランチを作成した場合: push と PR 作成を実行する

   ```bash
   git push -u origin HEAD
   gh pr create \
     --title "chore: フレームワークを <新バージョン> に更新" \
     --body "フレームワークを <旧バージョン> → <新バージョン> に更新します。\n\n## 変更内容\n- 全置き換え対象: 更新済み\n- CLAUDE.md: [更新済み / @import 移行済み / 変更なし]\n- AGENTS.md: [managed 範囲更新済み / 手動確認済み]\n- プロジェクト固有設定: [N 件適用]"
   ```

4. 完了サマリーを表示する

```
フレームワークの更新が完了しました:
- 旧バージョン: X.X.X
- 新バージョン: Y.Y.Y
- 全置き換え対象: 更新済み
- CLAUDE.md: [更新済み / @import 移行済み / 変更なし]
- AGENTS.md: [managed 範囲更新済み / 手動確認済み]
- プロジェクト固有設定: [N 件適用]
- PR: [作成済み <URL> / —（既存ブランチ上の場合）]

次のステップ:
→ `/aidd-doctor` で環境確認
→ `/aidd-next` で次のアクション確認
```

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う**
- ユーザー確認なしの自動実行禁止
- ブリーフィング省略禁止
- 各ステップの詳細手順は `references/` を読んで実行する
