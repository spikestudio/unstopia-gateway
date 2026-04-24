# Step 1: PR 適格性チェック — 詳細手順

Haiku エージェントで PR の適格性を確認する。不適格な場合はスキルを停止する。

## PR 特定（Step 0 より）

```bash
# 引数なしの場合: 現在ブランチの PR を自動取得
gh pr list --head "$(git branch --show-current)" --json number,title,state,isDraft --jq '.[0]'
```

PR が見つからない場合はユーザーに番号の入力を求める。

## 適格性チェック

Haiku エージェントに以下を確認させる:

```bash
gh pr view <PR番号> --json state,isDraft,title,author,comments
```

以下のいずれかに該当する場合は **停止** し、理由を端末に表示する:

| 除外条件 | 判定方法 |
|---------|---------|
| クローズ済み | `state == "CLOSED"` |
| draft PR | `isDraft == true` |
| 自動生成 PR | タイトルに "dependabot" "renovate" "auto" 等が含まれる、または author が bot |
| Claude がすでにコメントを残している（`--comment` 指定時のみ） | `comments` の中に Claude による本レビューのコメントが存在する |

**不適格時の出力例:**

```
このPRはレビュー対象外です（理由: draft PR）。
draft を解除してから再度実行してください。
```

## 適格確認後

適格と判定された場合、以下を取得して Step 2 に渡す:

```bash
# CLAUDE.md ファイルのパス一覧取得（Haiku エージェントで実行）
gh pr view <PR番号> --json files --jq '.files[].path' | xargs -I{} dirname {} | sort -u | \
  xargs -I{} find {} -name "CLAUDE.md" -maxdepth 0 2>/dev/null
# + ルート CLAUDE.md

# PR サマリー取得
gh pr view <PR番号> --json title,body,additions,deletions,files

# PR diff 取得
gh pr diff <PR番号>
```
