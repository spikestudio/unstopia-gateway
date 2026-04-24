---
name: aidd-epic-review
description: >
  Epicの全成果物を3観点（ビジネス要件・ドキュメント・コード）で総合チェックし、全問題を修正する。
  Epic総合レビューを行いたい場合は常にこのスキルを呼び出す。
type: skill
argument-hint: "[Epic ID | ES-NNN]"
---

# /aidd-epic-review — Epic 総合レビュー（3 観点チェック → 合意 → 修正）

Epic の全成果物（仕様書・Task 定義・実装コード・ドキュメント）を 3 観点（ビジネス要件・ドキュメント・コード）で総合チェックし、検出した全問題を修正提案付きで提示する。人間と 1 件ずつ合意した上で修正を実行し、完璧な成果物に仕上げる。

> **このスキルの目的は「Epic レベルの品質問題を漏れなく検出し、全て修正する」こと。** PR 差分だけでは見つからない横断的な問題を検出する。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| Epic の PR が存在する | `gh pr list --head feature/ES-NNN-slug` | `/aidd-impl` で実装を完了してください |
| Epic 仕様書が承認済み | Epic Issue が `status:in-progress` ラベル付きでオープンかつ G2 通過コメントが存在する（`gh issue view <Epic番号> --comments`） | `/aidd-new-epic` を先に実行 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| Epic ID | 引数 | 任意 | `ES-NNN` 形式。指定なしなら自動推定 |

### capability 呼び出し

| capability | Step | 引数 |
|-----------|------|------|
| /aidd-research | Step 1 | 技術仕様の確認（必要時のみ） |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| レビュー結果 | PR コメント | PASS/FAIL 記録 + 検出問題一覧 |
| gate:reviewed ラベル | GitHub | PASS 時に付与、FAIL 時に除去 |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-phase-review` | PASS 後、Phase の全 Epic 完了時 |
| `/aidd-next` | PASS 後、次のアクションが不明な場合 |

## Step 0: 入力受付

`$ARGUMENTS` から Epic ID を取得する。指定がなければ自動推定し、推定結果をユーザーに確認してから進行する。

### 0-1. Epic の特定

- **引数あり**（例: `/aidd-epic-review ES-017`）: `docs/requirements/ES-017-*.md` を読み込み
- **引数なし**: `gh issue list --label "status:in-progress"` から Epic を自動推定。現在ブランチが `feature/ES-NNN-slug` の場合はそこから特定。推定結果をユーザーに確認
- **推定失敗時**:

```
レビュー対象の Epic を自動推定できませんでした。以下のいずれかで指定してください:
- `/aidd-epic-review ES-NNN` — Epic ID を指定して実行
```

### 0-2. 前提条件チェック

1. Epic 仕様書（`docs/requirements/ES-NNN-*.md`）の存在確認と、Epic Issue の `status:in-progress` ラベルおよび G2 通過コメントの確認（`gh issue view <Epic番号> --comments`）
2. Epic の PR 存在確認（`gh pr list --head feature/ES-NNN-slug`）
3. 前提条件を満たさない場合はエラーメッセージと案内を表示して停止

### 0-3. Epic 完了形式チェック

`references/check-completion.md` を読み込んで実行する。

- 全 Task Issue クローズ確認
- PR 存在確認
- **PR body の Closes 突合確認** — `list-epic-tasks.sh` で取得した全 Sub-issue が PR body の `Closes #NNN` に含まれているか確認する
- 未対応 feedback Issue 確認

NG がある場合は Step 1（3 観点チェック）に進まず、先に解消すべき項目を案内する。

### 0-4. コンテキスト読み込み

| 入力 | 取得元 | 用途 |
|------|--------|------|
| Epic 仕様書 | `docs/requirements/ES-NNN-*.md` | AC・ストーリー・要件 |
| Task 定義群 | `docs/tasks/TASK-*.md`（Epic に紐づくもの） | AC の分解・実装範囲 |
| PR 差分 | `gh pr diff <番号>` | コード変更の全体像 |
| 変更ファイル | `gh pr view <番号> --json files` | 変更ファイル一覧 |
| 設計成果物 | Epic 仕様書が参照する設計書・ADR | 設計判断の確認 |
| 規約ドキュメント | `docs/conventions/` | 規約準拠チェック |

### 0-5. Epic ブランチへの切り替え

[gitflow ガイド](../../aidd-framework/guides/gitflow.md)に従い、Epic ブランチに切り替える。

```bash
git checkout feature/ES-NNN-slug
git pull --ff-only
```

## Step 1: 説明 + チェック

> **前提: Step 0 が完了していること。**

### 1-1. Epic 成果物の全体像説明

`references/briefing-spec.md` を読み込んで、Epic の成果物の全体像を説明する。

**説明に含める内容:**

- Epic の目的・対応ストーリー
- 変更ファイル一覧と変更量
- AC カバレッジの概要
- 主要な設計判断

### 1-2. 3 観点チェック実行

以下の references を順に読み込んでチェックを実行する:

1. `references/check-business.md` — ビジネス要件チェック（AC 充足判定、ストーリー整合、要件カバレッジ）
2. `references/check-docs.md` — ドキュメントチェック（整合性、論理矛盾、記載漏れ、参照整合）
3. `references/check-code.md` — コードチェック（規約違反、冗長コード、技術的負債、lint suppress 検出）

### 1-3. 問題分類・修正提案

全検出問題に修正の種類を自動分類し、修正提案を付ける。**「修正しない」は選択肢にない。**

**分類判断基準:**

| 種類 | 判断条件 | 修正アクション |
|------|---------|-------------|
| **(a) コード修正** | バグ・規約違反・冗長コード・lint suppress・テスト不足・型不整合 | ソースコードを変更する |
| **(b) ドキュメント修正** | 仕様書とコードの不整合・記載漏れ・コメント不足・参照リンク切れ・ADR 未反映 | ドキュメントファイルを更新する |
| **(c) 設計判断の記録** | 意図的な逸脱・トレードオフ選択・将来の拡張に対する意図的な制約 | コードコメントまたは ADR で理由を明記する |

**分類の優先順序:** 複数の種類に該当する場合は (a) > (b) > (c) の優先順序で主分類を決定し、副分類を括弧で付記する（例: `コード修正（+ ドキュメント修正）`）。

### 1-4. 問題一覧の提示

```
## チェック結果: ES-NNN [Epic名]

### 全体像
[1-1 の説明サマリー]

### 検出問題一覧

| # | 観点 | 問題 | 修正種類 | 修正提案 |
|---|------|------|---------|---------|
| 1 | ビジネス要件 | [問題の概要] | コード修正 | [具体的な修正提案] |
| 2 | ドキュメント | [問題の概要] | ドキュメント修正 | [具体的な修正提案] |
| ... | ... | ... | ... | ... |

問題なし: [問題がない場合は「検出問題なし」と表示]

この内容を確認し、修正に進んでよいですか？
```

**問題が 0 件の場合:** 「検出問題なし」を明示し、Step 3（完了処理）に進む承認を求める。

## Step 2: 合意 + 修正

> **前提: Step 1 の承認が完了していること。**

`references/fix-flow.md` を読み込んで実行する。

**概要:** 検出問題を 1 件ずつ提示し、人間と合意した上で修正を実行する。

**1 件ごとの提示形式:**

```
## 問題 N/M: [問題タイトル]

**問題:** ○○という問題があります。
**影響:** △△
**修正提案:** □□（種類: コード修正 / ドキュメント修正 / 設計判断の記録）

この修正を実行してよいですか？
```

**対話ルール:**

- 人間が合意 → 修正を実行
- 人間が「問題ではない」「別の修正が必要」→ 対話で認識を合わせ、修正方針を確定してから修正を実行
- 最終的に全問題に対して何らかの修正が実行される

## Step 3: 完了処理

> **前提: Step 2 が完了していること（問題 0 件の場合は Step 1 の承認完了）。**

### 3-1. 再チェック

修正による新たな問題がないことを確認する。

- 3 観点チェックを再実行する
- **新たな問題なし** → PASS 判定
- **新たな問題あり** → Step 1-3（問題一覧提示）に戻り、修正ループを繰り返す
- **再チェックループは最大 3 回** — 超過時は「再チェック上限に達しました。残りの問題を確認してください」と人間に判断を委ねる

### 3-2. PASS/FAIL 判定

- **PASS**: 全検出問題に対して修正が完了している
- **FAIL**: 未修正の問題が 1 件以上存在（再チェック上限超過時）

### 3-3. Epic 仕様書の AC チェックボックス更新

PASS 判定後、Epic 仕様書（`docs/requirements/ES-NNN-*.md`）の全 AC チェックボックスを `[x]` に更新する。ユーザーの承認を得てから実行する。

### 3-4. PR 作成 / Closes 補完

PASS 判定後、以下のいずれかを実行する。

`references/list-epic-tasks.sh` で Epic の全 Sub-issue 番号を取得し、PR body に `Epic: #...` と `Closes` を自動生成する:

```bash
# Sub-issue 番号を取得
TASK_NUMBERS=$(bash "${SKILL_DIR}/references/list-epic-tasks.sh" <Epic Issue番号>)

# PR body 行を生成（Epic メタ情報 + 全 Task close）
CLOSES_LINES="Closes #<Epic Issue番号>"
while IFS= read -r num; do
  [ -n "${num}" ] && CLOSES_LINES="${CLOSES_LINES}"$'\n'"Closes #${num}"
done <<< "${TASK_NUMBERS}"

# PR 存在確認
PR_NUMBER=$(gh pr list --head feature/ES-NNN-slug --json number --jq '.[0].number // empty')
```

**draft PR が存在する場合 → draft 解除 + タイトル更新:**

```bash
IS_DRAFT=$(gh pr view "${PR_NUMBER}" --json isDraft --jq '.isDraft' 2>/dev/null || echo "false")

if [ "$IS_DRAFT" = "true" ]; then
  # draft 解除
  gh pr ready "${PR_NUMBER}"
  # タイトルから [WIP] を除去
  CURRENT_TITLE=$(gh pr view "${PR_NUMBER}" --json title --jq '.title')
  NEW_TITLE="${CURRENT_TITLE#\[WIP\] }"
  gh pr edit "${PR_NUMBER}" --title "${NEW_TITLE}"
  echo "✅ draft 解除・[WIP] 除去完了: ${NEW_TITLE}"
fi
```

**PR が未作成の場合 → 作成:**

`.github/PULL_REQUEST_TEMPLATE.md` を Read し、以下を埋めた body で PR を作成する:

- `## 概要`: Epic 名と概要
- `## 関連 Issue`: `${CLOSES_LINES}` の内容（Epic Issue + 全 Task の Closes 行）
- テンプレートの末尾に `## 含まれる Task` セクションを追加し、`${TASK_NUMBERS}` をリスト形式で記載

```bash
gh pr create --title "feat: ES-NNN [Epic名]" --body "[テンプレートを読み込んで生成した body]"
```

**PR が既作成（通常 open）の場合 → `Epic:` / `Closes` 漏れを補完:**

Step 0-3 の Closes 突合確認で漏れが検出されていた場合、PR body を更新して不足している `Closes #NNN` を追記する:

```bash
# 現在の PR body を取得
CURRENT_BODY=$(gh pr view "${PR_NUMBER}" --json body --jq '.body')

# 不足している Epic / Closes 行を末尾に追記
UPDATED_BODY="${CURRENT_BODY}"
if ! echo "${CURRENT_BODY}" | grep -qiE "^[[:space:]]*Epic:[[:space:]]+#<Epic Issue番号>"; then
  UPDATED_BODY="Epic: #<Epic Issue番号>"$'\n\n'"${UPDATED_BODY}"
fi
while IFS= read -r num; do
  if [ -n "${num}" ] && ! echo "${CURRENT_BODY}" | grep -qiE "closes[[:space:]]+#${num}"; then
    UPDATED_BODY="${UPDATED_BODY}"$'\n'"Closes #${num}"
  fi
done <<< "${TASK_NUMBERS}"

gh pr edit "${PR_NUMBER}" --body "${UPDATED_BODY}"
```

**Sub-issue が 0 件の場合:** `CLOSES_LINES` は `Epic: #<Epic Issue番号>` のみになる。

### 3-5. PR コメント記録・Gate ラベル制御

レビュー結果を `merge-guard` パターンの PR コメントとして記録し、Gate ラベルを制御する。

**PASS の場合:**

```bash
gh pr edit <番号> --add-label "gate:reviewed"
# Epic Issue の status:in-progress を除去する（実装フェーズ完了）（#732）
gh issue edit <Epic Issue番号> --remove-label "status:in-progress"
gh pr comment <番号> --body "<!-- merge-guard:reviewed timestamp:$(date -u +%Y-%m-%dT%H:%M:%SZ) -->
## ✅ Gate: Epic Review PASS

| 項目 | 結果 |
|------|------|
| ビジネス要件 | PASS |
| ドキュメント | PASS |
| コード | PASS |
| 検出問題数 | [N] 件（全件修正済み） |
| 再チェック回数 | [M] 回 |

### 検出問題サマリー
| # | 観点 | 問題 | 修正種類 | 結果 |
|---|------|------|---------|------|
| 1 | [観点] | [問題概要] | [種類] | ✅ 修正済み |
| ... | ... | ... | ... | ... |
<!-- /merge-guard:reviewed -->"
```

**FAIL の場合:**

```bash
gh pr edit <番号> --remove-label "gate:reviewed" 2>/dev/null || true
gh pr comment <番号> --body "<!-- merge-guard:epic-review-fail timestamp:$(date -u +%Y-%m-%dT%H:%M:%SZ) -->
## ❌ Gate: Epic Review FAIL

| 項目 | 結果 |
|------|------|
| ビジネス要件 | [PASS/FAIL] |
| ドキュメント | [PASS/FAIL] |
| コード | [PASS/FAIL] |
| 検出問題数 | [N] 件（[M] 件未修正） |
| 再チェック回数 | 3 回（上限到達） |

### 未修正問題
| # | 観点 | 問題 | 修正種類 | 状態 |
|---|------|------|---------|------|
| 1 | [観点] | [問題概要] | [種類] | ❌ 未修正 |
| ... | ... | ... | ... | ... |
<!-- /merge-guard:epic-review-fail -->"
```

### 3-6. 次のステップ案内

```
Epic 総合レビューが完了しました:
- Epic: ES-NNN [Epic名]
- 結果: PASS / FAIL
- 検出問題: N 件（全件修正済み / M 件未修正）

次のステップ:
→ このレビュー PASS = G5 通過。マージ後:
  - Phase の残 Epic がある場合: `/aidd-new-epic` or `/aidd-impl` で次 Epic へ
  - Phase の全 Epic 完了の場合: `/aidd-phase-review` で G6 へ
  - スタンドアロン Enhancement の場合: 完結
  - 迷う場合: `/aidd-next` で確認
```

**CRITICAL: レビュー完了後、AI は merge を実行しない。** 結果を提示した後、必ず以下のメッセージで締めくくる:

```
レビュー結果を提示しました。マージする場合は「merge」と指示してください。
```

**ユーザーが「merge」を指示したとき（メインコンテキストで実行）:**

merge 指示を受け取ったら、`gh pr merge` の前に必ず `git push origin HEAD` を実行してローカルコミットを remote に反映させること。

```bash
# 1. ローカルコミットを remote に push（必須）
git push origin HEAD

# 2. マージ実行
gh pr merge <番号> --squash --delete-branch

# 3. ローカル main に切り替えて最新化（必須）
git checkout main && git pull --ff-only
```

## fork 返却サマリー

fork コンテキストからメインコンテキストへ返すサマリー:

```
## /aidd-epic-review 完了サマリー

- Epic: ES-NNN [Epic名]
- 結果: PASS / FAIL
- 検出問題数: N 件
- 修正済み: M 件
- ビジネス要件: PASS / FAIL
- ドキュメント: PASS / FAIL
- コード: PASS / FAIL
- 次のステップ: [/aidd-next or 残問題の確認]
```

## ゲート制御ルール

**ゲートは構造的に必須である。以下のルールに例外はない。**

1. **Step 0 の前提条件を満たさない場合、スキルを開始してはならない。** Epic の PR が存在しない、または Epic 仕様書が見つからない場合はエラーメッセージを表示して停止する。
2. **Step 1 の承認なしに Step 2 を開始してはならない。** チェック結果の確認・承認を経ずに修正を開始してはならない。承認なしに進もうとした場合、「チェック結果の確認が必要です」と表示しスキルを停止する。
3. **ブリーフィングなしに承認を求めてはならない。** Step 1 完了時に `references/briefing-spec.md` に従った Epic 成果物の全体像説明を必ず実行する。1-2 行のサマリーのみでの承認要求は禁止。
4. **回答 ≠ 承認。** ユーザーの問いかけへの回答は回答内容の反映のみに留める。次ステップへの遷移には「OK」「進めて」「承認」等の明確な承認表現が必要。

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う** — 優先順序 1〜5 に該当する問題の見送り・後回しを推奨しない
- **ブリーフィング省略禁止** — Step 1 で `references/briefing-spec.md` に従った Epic 成果物の全体像説明を必ず実行する
- **検出した問題には全て修正提案を付ける** — コード修正 / ドキュメント修正 / 設計判断の記録のいずれかを提案する
- **問題を検出して「修正しない」という選択肢は提供しない** — 全問題に対して何らかの修正が実行される
- 成果物生成・実装完了時にコミットを自動実行する。ユーザーの指摘反映後・ステップ承認後などの状態遷移ごとにもコミットする。push と PR 作成はユーザーの確認を待つ
- **レビュー完了後に merge を実行しない** — 結果提示後は人間の明示的なマージ指示を待つ
- 各ステップの詳細手順は `references/` を読んで実行する。SKILL.md 内に手順を複製しない
