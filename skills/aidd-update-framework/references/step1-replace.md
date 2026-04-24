# Step 1: 全置き換え対象の更新（詳細手順）

## PLUGIN_DIR の特定

```bash
PLUGIN_DIR="${HOME}/.claude/plugins/marketplaces/aidd-fw"
```

## 全置き換え実行

以下を順番に実行する。

### 1. aidd-framework/ の全置き換え

```bash
rm -rf aidd-framework/
cp -r "${PLUGIN_DIR}/aidd-framework/" aidd-framework/
```

### 2. .agents/skills/ の全置き換え

> **注意:** コピー元は PLUGIN_DIR の `skills/` ディレクトリ（`aidd-setup/references/cat-fw.md` の手順と同じ）。
> PLUGIN_DIR の `.agents/skills/` は `.gitkeep` のみのため使用しない。

```bash
rm -rf .agents/skills/
mkdir -p .agents/skills
cp -r "${PLUGIN_DIR}/skills/." .agents/skills/
```

### 3. .github/ISSUE_TEMPLATE/ の全置き換え

```bash
ISSUE_TEMPLATE_SRC="${PLUGIN_DIR}/skills/aidd-setup/references/github/ISSUE_TEMPLATE"
if [ -d "${ISSUE_TEMPLATE_SRC}" ]; then
  rm -rf .github/ISSUE_TEMPLATE/
  mkdir -p .github/ISSUE_TEMPLATE
  cp -r "${ISSUE_TEMPLATE_SRC}/." .github/ISSUE_TEMPLATE/
fi
```

### 5. .github/workflows/merge-guard.yml の全置き換え

```bash
MERGE_GUARD_SRC="${PLUGIN_DIR}/skills/aidd-setup/references/merge-guard.yml"
if [ -f "${MERGE_GUARD_SRC}" ]; then
  mkdir -p .github/workflows
  cp "${MERGE_GUARD_SRC}" .github/workflows/merge-guard.yml
fi
```

### 6. GitHub Labels 冪等再作成

```bash
gh label create "status:in-progress" --color "#0E8A16" --description "作業進行中" --force
gh label create "gate:reviewed"      --color "#1D76DB" --description "AI PR review passed" --force
gh label create "gate:briefed"       --color "#D4C5F9" --description "Briefing completed" --force
gh label create "gate:approved"      --color "#2EA44F" --description "Human approved merge" --force
gh label create "epic"               --color "#0075ca" --description "Epic 仕様書に対応する Issue" --force
gh label create "task"               --color "#008672" --description "Task 定義に対応する Issue" --force
gh label create "feedback"           --color "#e4e669" --description "実装中の訂正・仕様変更・規約追記" --force
gh label create "blocked"            --color "#d73a4a" --description "ブロックされている Issue" --force
```

## 完了確認

各ファイルが最新化されたことをユーザーに報告する。
