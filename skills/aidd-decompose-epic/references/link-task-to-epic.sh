#!/usr/bin/env bash
set -euo pipefail

# Usage: link-task-to-epic.sh <epic-issue-number> <task-issue-number>
# Links a Task Issue as a Sub-issue of an Epic Issue via GitHub GraphQL API.

EPIC_NUMBER="${1:?第1引数に Epic Issue 番号を指定してください}"
TASK_NUMBER="${2:?第2引数に Task Issue 番号を指定してください}"

# リポジトリ情報を動的取得
REPO_JSON=$(gh repo view --json owner,name)
OWNER=$(echo "$REPO_JSON" | jq -r '.owner.login')
REPO=$(echo "$REPO_JSON" | jq -r '.name')

# 各 Issue の node_id を取得
EPIC_ID=$(gh issue view "$EPIC_NUMBER" --repo "$OWNER/$REPO" --json id --jq '.id')
TASK_ID=$(gh issue view "$TASK_NUMBER" --repo "$OWNER/$REPO" --json id --jq '.id')

# addSubIssue ミューテーションで Task を Epic の Sub-issue に追加
gh api graphql -f query="
  mutation {
    addSubIssue(input: {
      issueId: \"$EPIC_ID\",
      subIssueId: \"$TASK_ID\"
    }) {
      issue {
        number
        title
      }
      subIssue {
        number
        title
      }
    }
  }
"

echo "Task #${TASK_NUMBER} を Epic #${EPIC_NUMBER} の Sub-issue として登録しました。"
