# G6 通過記録手順 — /aidd-phase-closing Step 1・Step 2

## 前提確認

### Phase ID の特定

引数で `PD-NNN` が指定された場合はそれを使用する。指定がなければ以下の手順で自動推定する。

```bash
# オープンな Milestone を列挙して Phase を特定
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/$REPO/milestones" --jq '.[] | select(.state == "open") | {number: .number, title: .title}'
```

複数の Phase が open の場合はユーザーに選択を促す。特定した Phase ID を `$PHASE_ID` として以降の処理で使用する。

### `/aidd-review phase` PASS 記録の確認

Phase Issue または Milestone の直近コメントに `✅ G6` または `PASS` の記録が存在することを確認する。

```bash
# Phase に紐づく最終 Epic の直近コメントを確認
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PHASE_NUM=$(echo "$PHASE_ID" | sed 's/PD-0*//')
MILESTONE_TITLE=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title | startswith(\"Phase $PHASE_NUM:\")) | .title")
LAST_EPIC=$(gh issue list --label "epic" --state closed --milestone "$MILESTONE_TITLE" --json number --jq '.[0].number')
gh issue view "$LAST_EPIC" --comments | tail -30
```

PASS 記録が見つからない場合:

```
❌ 前提条件未達: /aidd-review phase の PASS 記録が確認できません。
先に `/aidd-review phase $PHASE_ID` を実行して Phase 完了検証を通過してください。
```

### 全 Epic 完了確認

```bash
# Phase に紐づくオープンな Epic Issue が 0 件であることを確認
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PHASE_NUM=$(echo "$PHASE_ID" | sed 's/PD-0*//')
MILESTONE_TITLE=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title | startswith(\"Phase $PHASE_NUM:\")) | .title")
gh issue list --label "epic" --state open --milestone "$MILESTONE_TITLE"
```

オープンな Epic Issue が残っている場合:

```
❌ 前提条件未達: 未完了の Epic Issue が存在します。
先に上記の Epic を `/aidd-review epic` で完了させてください。
```

---

## G6 通過コメント記録

### Epic Issue への通過コメント記録

Phase の最終 Epic Issue に G6 通過コメントを記録する。

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PHASE_NUM=$(echo "$PHASE_ID" | sed 's/PD-0*//')
MILESTONE_TITLE=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title | startswith(\"Phase $PHASE_NUM:\")) | .title")
LAST_EPIC=$(gh issue list --label "epic" --state closed --milestone "$MILESTONE_TITLE" --json number --jq '.[0].number')

gh issue comment "$LAST_EPIC" --body "✅ G6 通過 ($(date '+%Y-%m-%d'))

Phase 完了検証が PASS しました。Phase 完了処理に移行します。"
```

### Milestone への通過コメント記録

Milestone に直接コメントを付与することはできないため、Milestone に紐づく Phase Issue（または最終 Epic Issue）にコメントを追記する。

```bash
# Phase Issue（PD-NNN に対応する Issue）を特定してコメント
PHASE_ISSUE=$(gh issue list --search "$PHASE_ID" --json number --jq '.[0].number')
if [ -n "$PHASE_ISSUE" ]; then
  gh issue comment "$PHASE_ISSUE" --body "✅ G6 通過 ($(date '+%Y-%m-%d'))

Phase $PHASE_NUM のレビューが PASS しました。完了処理を実行します。"
fi
```
