#!/usr/bin/env bash
# list-epic-tasks.sh — Epic の Sub-issue 番号を1行ずつ出力する
# 使用例: bash "${SKILL_DIR}/references/list-epic-tasks.sh" <Epic Issue番号>
# 出力例:
#   577
#   578
#   579

set -euo pipefail

EPIC_NUMBER="${1:?Epic Issue番号を引数で指定してください（例: 42）}"

# リポジトリ情報を動的取得
REPO_JSON=$(gh repo view --json owner,name)
OWNER=$(echo "${REPO_JSON}" | jq -r '.owner.login')
REPO=$(echo "${REPO_JSON}" | jq -r '.name')

# Epic Issue の node_id を取得
NODE_ID=$(gh issue view "${EPIC_NUMBER}" --repo "${OWNER}/${REPO}" --json id --jq '.id')

# GraphQL で Sub-issues を取得
RESPONSE=$(gh api graphql -f query='
  query($nodeId: ID!) {
    node(id: $nodeId) {
      ... on Issue {
        subIssues(first: 100) {
          nodes {
            number
          }
        }
      }
    }
  }
' -f nodeId="${NODE_ID}")

# Sub-issue 番号を1行ずつ出力（0件の場合は空出力）
echo "${RESPONSE}" | jq -r '.data.node.subIssues.nodes[].number' 2>/dev/null || true
