---
name: aidd-publish
description: >
  プラグインのリリースを実行する。plugin.json のバージョン bump、git tag、GitHub Release を自動で行う。
  プラグインをリリースする場合に常にこのスキルを呼び出す。
type: skill
argument-hint: "[major|minor|patch]"
---

# /aidd-publish — プラグインリリース

plugin.json のバージョン bump、PR 作成、タグ、GitHub Release 作成を一括で行う。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| ワーキングツリーがクリーンであること | `git status --porcelain` が空 | 未コミットの変更をコミットまたはスタッシュする |
| main ブランチであること | `git branch --show-current` | `git checkout main` を実行 |
| リモートと同期していること | `git fetch origin && git diff HEAD..origin/main --quiet` | `git pull origin main` を実行 |
| リリース前品質チェックが通過すること | markdownlint, frontmatter, ビルド等 | 各チェックのエラーを修正する |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| bump レベル | 引数（`major` / `minor` / `patch`） | 任意 | 指定なしなら Conventional Commits から自動判定 |

### capability 呼び出し

該当なし — レビュー/リサーチ不要

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| plugin.json 更新 | ファイル | `.claude-plugin/plugin.json` の version フィールドを更新 |
| git tag | git | `v{next_version}` タグを作成・プッシュ |
| GitHub Release | GitHub | Release Notes 付きの GitHub Release を作成 |
| PR | GitHub | `release/v{next_version}` ブランチの PR を作成・マージ |

### 後続スキル

| スキル | 条件 |
|--------|------|
| （なし） | リリース完了で終了 |

## Step 1: 前提チェックとリリース準備

### 前提チェック

以下を全て確認し、満たさない場合はエラーを表示して中断する:

1. **ワーキングツリーがクリーンであること**: `git status --porcelain` が空であること
2. **main ブランチにいない場合は `git checkout main` する**
3. **リモートと同期していること**: `git fetch origin && git diff HEAD..origin/main --quiet`

### リリース前品質チェック

<!-- レビュー指摘: リリース前の品質確認（ビルド通過等）が手動で、チェック漏れが発生していた -->

前提チェック通過後、リリースプロセスに入る前に以下の品質チェックを実施する。**いずれかが FAIL の場合、リリースを中断する。**

| チェック項目 | コマンド | FAIL 条件 |
|------------|---------|----------|
| markdownlint | `npx markdownlint-cli2 "skills/**/*.md" "docs/**/*.md"` | エラーが 1 件以上 |
| スキル frontmatter | 全 `skills/*/SKILL.md` に `name`, `description` が存在 | 欠落あり |
| Storybook ビルド | `task ui:build-storybook` （`ui/` が存在する場合のみ） | ビルドエラー |
| TypeScript ビルド | `task build` （Taskfile に build タスクがある場合のみ） | コンパイルエラー |
| オープン feedback Issue | `gh issue list --label feedback --state open` | 未クローズの feedback がある場合は警告（ブロックはしない） |

チェック結果をユーザーに提示する:

```
## リリース前品質チェック
- [PASS] markdownlint: エラー 0 件
- [PASS] スキル frontmatter: 全 N スキル OK
- [PASS] Storybook ビルド: 成功
- [PASS] TypeScript ビルド: 成功
- [WARN] feedback Issue: 2 件オープン (#xx, #yy)

品質チェック通過。リリースプロセスに進みます。
```

### 現在バージョンの取得

`.claude-plugin/plugin.json` の `version` フィールドを読み取る。

### 変更一覧の取得

```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD --oneline
```

タグが存在しない場合は全コミットを対象とする。

### bump レベルの決定

引数が指定されている場合はそれを使用する（`major`、`minor`、`patch`）。

引数なしの場合、変更一覧から Conventional Commits のプレフィックスで自動判定する:

| 条件 | bump レベル |
|------|-----------|
| コミットメッセージに `BREAKING CHANGE` または `!:` が含まれる | `major` |
| `feat:` または `feat(` で始まるコミットがある | `minor` |
| 上記以外（`fix:`, `chore:`, `docs:`, `refactor:` 等のみ） | `patch` |

### ユーザー確認

以下をユーザーに表示し、確認を取る:

```
リリース内容:
- 現在バージョン: {current_version}
- 次バージョン: {next_version} ({bump_level})
- 変更コミット数: {count}

変更一覧:
{commit_list}

このバージョンでリリースしますか？
```

## Step 2: リリース実行

### リリースブランチの作成と plugin.json の更新

```bash
git checkout -b release/v{next_version}
```

`.claude-plugin/plugin.json` の `version` フィールドを新バージョンに更新する。

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: release v{next_version}"
git push -u origin release/v{next_version}
```

### PR 作成とマージ

```bash
gh pr create --title "chore: release v{next_version}" --body "Release v{next_version}"
gh pr merge --squash
```

マージ後、main に戻る:

```bash
git checkout main
git pull origin main
```

### タグと GitHub Release 作成

変更一覧をもとに、Release Notes の本文を作成する:

1. **BREAKING CHANGE の検出**: コミットメッセージに `BREAKING CHANGE` または `!:` が含まれる場合、`## ⚠️ Breaking Changes` セクションを作成し、影響と移行手順を記載する
2. **変更カテゴリの整理**: `feat:`, `fix:`, `chore:`, `docs:` 等のプレフィックスでグルーピングする
3. Release Notes の内容をユーザーに提示し、確認を取る

```bash
git tag v{next_version}
git push origin v{next_version}
gh release create v{next_version} --title "v{next_version}" --notes "{release_notes}"
```

## Step 3: 完了処理

```
リリース完了:
- バージョン: v{next_version}
- タグ: v{next_version}
- GitHub Release: {release_url}

プラグイン利用者はセッション内で以下を実行して更新できます:
  /plugin marketplace update aidd-fw
  /plugin update aidd-fw
  /reload-plugins
```

## 重要なルール

- **日本語で対話する** — フレームワーク全体の対話言語が日本語であるため
- **FRAMEWORK.md の意思決定基準に従う**
- コミットはユーザーの判断に委ねる — コミット内容の責任はユーザーにあるため
- **リリース前に必ずユーザーの確認を取る** — バージョン番号と変更一覧の最終確認は人間が行う必要があるため
