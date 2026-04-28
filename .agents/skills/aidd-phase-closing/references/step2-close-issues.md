# Epic Issue クローズ・Phase 定義書更新・Milestone クローズ手順 — /aidd-phase-closing Step 3・Step 4

## Epic Issue クローズ

### 対象 Issue の列挙

Phase に紐づく全 Epic Issue（closed を含む）を列挙し、未 close のものを抽出する。

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PHASE_NUM=$(echo "$PHASE_ID" | sed 's/PD-0*//')
MILESTONE_TITLE=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title | startswith(\"Phase $PHASE_NUM:\")) | .title")

# すべての Epic Issue（open/closed 両方）を確認
gh issue list --label "epic" --milestone "$MILESTONE_TITLE" --state all --json number,title,state
```

### Issue クローズ実行

open 状態の Epic Issue が残っている場合のみ実行する。

```bash
# open な Epic Issue を取得してクローズ
OPEN_EPICS=$(gh issue list --label "epic" --milestone "$MILESTONE_TITLE" --state open --json number --jq '.[].number')
for issue_num in $OPEN_EPICS; do
  gh issue close "$issue_num" --comment "Phase $PHASE_NUM 完了処理によりクローズ。"
  echo "Closed: #$issue_num"
done
```

---

## Phase 定義書ステータス更新

### 対象ファイルの特定

```bash
# Phase 定義書を特定
PHASE_DOC=$(ls docs/requirements/${PHASE_ID}-*.md 2>/dev/null | head -1)
if [ -z "$PHASE_DOC" ]; then
  echo "WARNING: Phase 定義書が見つかりません: docs/requirements/${PHASE_ID}-*.md"
else
  echo "Phase 定義書: $PHASE_DOC"
fi
```

### ステータス更新

Phase 定義書のステータスフィールドを「完了」に更新する。定義書の冒頭または frontmatter にステータス記載がある場合はそれを更新する。

更新例（ファイルフォーマットに応じて対応方法を変える）:

- frontmatter に `status:` フィールドがある場合: `status: 完了` に変更
- 本文に `**ステータス**:` 記載がある場合: `**ステータス**: 完了` に変更
- ステータス記載がない場合: ファイル冒頭に以下を追記

```markdown
> **ステータス**: 完了（G6 通過: YYYY-MM-DD）
```

コミットメッセージ例:

```
docs: PD-NNN Phase 定義書ステータスを「完了」に更新
```

---

## Milestone クローズ

### Milestone 番号の特定

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PHASE_NUM=$(echo "$PHASE_ID" | sed 's/PD-0*//')
MILESTONE_TITLE=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title | startswith(\"Phase $PHASE_NUM:\")) | .title")
MILESTONE_NUM=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title == \"$MILESTONE_TITLE\") | .number")

echo "Milestone: $MILESTONE_TITLE (#$MILESTONE_NUM)"
```

### Milestone クローズ実行

```bash
# Milestone を closed に変更（G6 = Phase 完了を表す）
gh api "repos/$REPO/milestones/$MILESTONE_NUM" -X PATCH -f state=closed
echo "✅ Milestone '$MILESTONE_TITLE' をクローズしました"
```

クローズ完了後にユーザーに確認を報告する:

```
✅ Milestone クローズ完了
- Milestone: Phase N: [タイトル]
- クローズ日: YYYY-MM-DD
```
