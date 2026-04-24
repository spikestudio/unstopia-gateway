# Epic 完了形式チェック — 詳細手順

Epic の全 Task・PR・feedback が完了状態にあるかを形式的に検証する。3 観点チェック（Step 1）の前提条件として実行する。

> **位置づけ:** /aidd-epic-review Step 0-2 の前提条件チェックの一部。旧 /aidd-wrapup の Epic 完了チェック責務を吸収したもの。

## 入力

| 項目 | 取得元 | 説明 |
|------|--------|------|
| Epic Issue | `gh issue view <Epic番号>` | Epic の状態 |
| Task Issues | `gh issue list --label task --state all` | Epic に紐づく全 Task の状態 |
| PR | `gh pr list --state all --head feature/ES-NNN-slug` | Epic ブランチの PR 状態 |
| feedback Issues | `gh issue list --label feedback --state open` | 未対応 feedback |

## チェック手順

### 1. 全 Task Issue クローズ確認

Epic に紐づく全 Task Issue が closed であることを確認する。

```bash
# Epic に紐づく Task Issue を検索（Task 定義の Epic 仕様書フィールドで紐付け）
gh issue list --label task --state open --json number,title --jq '.[] | select(.title | test("ES-NNN"))'
```

| 条件 | 判定 |
|------|------|
| オープンな Task Issue が 0 件 | OK |
| オープンな Task Issue が 1 件以上 | NG — 未完了 Task を一覧表示 |

### 2. 全 PR マージ確認

Epic ブランチの PR が存在し、マージ可能な状態であることを確認する。

| 条件 | 判定 |
|------|------|
| Epic ブランチの PR が存在する | OK |
| PR が存在しない | NG — PR を作成してください |

### 3. feedback Issue 確認

Epic に関連する未対応の feedback Issue がないことを確認する。

| 条件 | 判定 |
|------|------|
| 未対応 feedback が 0 件 | OK |
| 未対応 feedback が 1 件以上 | 警告 — 一覧表示し、対応要否をユーザーに確認 |

### 4. PR body の Closes 突合確認

`list-epic-tasks.sh` で取得した Sub-issues リストと、PR body に記載された `Closes #NNN` を突合し、漏れがないことを確認する。あわせて、親 Epic を示す `Epic: #NNN` が存在することも確認する。

```bash
# Sub-issue 番号リストを取得
TASK_NUMBERS=$(bash "${SKILL_DIR}/references/list-epic-tasks.sh" <Epic Issue番号>)

# PR body を取得
PR_BODY=$(gh pr view <PR番号> --json body --jq '.body')

# Epic 行の存在確認
echo "${PR_BODY}" | grep -qiE "^[[:space:]]*Epic:[[:space:]]+#<Epic Issue番号>"

# 漏れチェック: Sub-issue ごとに PR body に "Closes #NNN" が含まれるか確認
MISSING=()
while IFS= read -r num; do
  [ -z "${num}" ] && continue
  if ! echo "${PR_BODY}" | grep -qiE "closes[[:space:]]+#${num}"; then
    MISSING+=("${num}")
  fi
done <<< "${TASK_NUMBERS}"
```

| 条件 | 判定 |
|------|------|
| PR body に `Epic: #<Epic Issue番号>` が存在する | OK |
| `Epic: #<Epic Issue番号>` が存在しない | NG — 親 Epic Issue 番号を追記 |
| 全 Sub-issue が PR body に `Closes #NNN` として記載されている | OK |
| 1件以上の Sub-issue が PR body に記載されていない | NG — 漏れている Issue 番号を一覧表示 |
| Sub-issue が 0 件 | OK（チェックスキップ） |

NG の場合は PR body を更新して `Closes #NNN` を追記するよう案内する。

## 出力

```
## Epic 完了形式チェック: ES-NNN

| チェック | 結果 |
|---------|------|
| 全 Task Issue クローズ | ✅ / ❌（N 件未完了） |
| PR 存在 | ✅ / ❌ |
| PR body Closes 突合 | ✅ / ❌（漏れ: #NNN, #MMM） |
| feedback 未対応 | ✅（0 件）/ ⚠️（N 件） |
```

NG がある場合は 3 観点チェック（Step 1）に進まず、先に解消すべき項目を案内する。
