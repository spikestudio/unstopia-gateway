# レトロスペクティブ実施手順 — /aidd-phase-closing Step 5

## 概要

Phase 完了時のレトロスペクティブは、プロセス改善の継続的サイクルを維持するためのフレームワーク必須ステップ。Well / Problem / Try の 3 観点で振り返り、改善点を次 Phase に引き継ぐ。

---

## レトロスペクティブの実施

### 入力情報の収集

以下の情報を収集してレトロスペクティブの材料とする。

```bash
# Phase に紐づく feedback Issue を確認
gh issue list --label "feedback" --milestone "$MILESTONE_TITLE" --state all --json number,title,state

# PR の一覧と概要を確認
gh pr list --state merged --search "milestone:$MILESTONE_TITLE" --json number,title,mergedAt | head -20

# Phase 定義書の成功基準と非機能要件を確認
cat "docs/requirements/${PHASE_ID}-*.md" 2>/dev/null | head -100
```

### Well / Problem / Try 分析

以下の 3 観点で AI が分析し、ユーザーに提示して確認・補足を求める。

#### Well（うまくいったこと）

- 成功基準を達成した項目
- スムーズに完了した Epic・Task
- フレームワーク・プロセスで効果的だった点
- チームの協働で良かった点

#### Problem（問題・課題）

- 達成が困難だった成功基準・非機能要件
- 繰り返し発生したエラー・手戻り
- フレームワーク・プロセスで改善が必要な点
- 未解決の feedback Issue
- 想定外のスコープ変更・遅延の原因

#### Try（次に試すこと）

- Problem に対する具体的な改善アクション
- 次 Phase で導入・試したいプロセス・ツール
- フレームワーク更新の提案

---

## 改善 Issue の作成

レトロスペクティブの Try 項目をそれぞれ GitHub Issue として作成する。

### Issue フォーマット

```bash
gh issue create \
  --title "[Retro Phase N] [改善タイトル]" \
  --body "## 背景
[Problem の説明]

## 提案アクション
[Try の具体的な内容]

## 期待する効果
[改善によって何が変わるか]

## 関連 Phase
$PHASE_ID

---
*Phase $PHASE_NUM レトロスペクティブより*" \
  --label "feedback" \
  --milestone "Phase $(($PHASE_NUM + 1)): [次 Phase のタイトル]"
```

### 次 Phase Milestone への紐付け

改善 Issue は次 Phase の Milestone に紐付ける。次 Phase の Milestone がまだ存在しない場合はラベル `feedback` のみを付与し、Milestone への紐付けは次 Phase 開始時に行う。

```bash
# 次 Phase の Milestone を確認
NEXT_PHASE_NUM=$(($PHASE_NUM + 1))
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
NEXT_MILESTONE=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title | startswith(\"Phase $NEXT_PHASE_NUM:\")) | .title")

if [ -z "$NEXT_MILESTONE" ]; then
  echo "INFO: 次 Phase ($NEXT_PHASE_NUM) の Milestone は未作成です。"
  echo "改善 Issue は feedback ラベルのみで作成し、次 Phase 開始時に Milestone を割り当ててください。"
fi
```

### Issue 作成後の報告フォーマット

```
## レトロスペクティブ完了

### Well（うまくいったこと）
- [項目1]
- [項目2]

### Problem（問題・課題）
- [項目1]
- [項目2]

### Try（作成した改善 Issue）
| # | Issue | タイトル |
|---|-------|---------|
| 1 | #NNN | [改善タイトル] |
| 2 | #NNN | [改善タイトル] |
```

---

## 注意事項

- レトロスペクティブは AI が主導して分析するが、最終的な Well/Problem/Try はユーザーと合意してから Issue 化する
- 問題の指摘は「プロセス・フレームワークの改善」に焦点を当てる。個人批判は行わない
- Try が 0 件になることを避ける — 必ず 1 件以上の改善アクションを抽出する
- 作成した改善 Issue は `feedback` ラベルを必ず付与する（`/aidd-feedback-recorder` と同じラベル管理）
