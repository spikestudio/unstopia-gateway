# Step 0: 入力受付・コンテキスト自動検出・種別確認 — /aidd-review

`$ARGUMENTS` から `--type` フラグと対象 ID を抽出し、省略された場合はプロジェクト状態からレビュー種別を自動検出する。推定結果をユーザーに確認してから Step 1 へ進む。

## 引数解析

```
$ARGUMENTS の形式例:
  --type epic-spec ES-042
  --type code 123
  ES-042
  （省略）
```

| 引数 | 抽出方法 | 省略時の扱い |
|------|---------|------------|
| `--type` | `--type <値>` を正規表現で抽出 | 自動検出ロジックを実行 |
| 対象 ID | `--type` フラグ以外のトークンを抽出 | 自動推定（後述） |

## 自動検出ロジック

`--type` が省略された場合、以下の順序で評価する。**最初に一致した条件を採用する。**

### 判定順序

| 優先度 | 条件 | 採用種別 | 判定コマンド |
|--------|------|---------|------------|
| 1 | `--type` 指定あり | 指定値をそのまま使用 | — |
| 2 | Phase の全 Epic が完了している | `phase` | `gh api repos/{owner}/{repo}/milestones/{milestone_number} --jq '.open_issues'` |
| 3 | 全 Task 完了（PR あり） | `epic` | `gh issue list --label task --state open --json number,title` + `gh pr list --head $(git branch --show-current) --json number,isDraft` |
| 4 | PR あり・Task 実装中 | `code` | `gh pr list --head $(git branch --show-current) --json number,isDraft` |
| 5 | `/aidd-decompose-epic` 完了直後（G4 通過コメントあり・impl 未着手） | `task-spec` | `gh issue list --label "status:in-progress" --label epic --json number,title,comments` |
| 6 | `/aidd-new-epic` 完了直後（G2 通過コメントあり・decompose 未着手） | `epic-spec` | `gh issue list --label "status:in-progress" --label epic --json number,title,comments` |
| 7 | 判定不可 | — | ユーザーに種別選択を求める |

### 各判定の詳細

#### 優先度 2: Phase 完了判定

```bash
# 現在の Milestone（Phase）を特定し、残 Epic 数を確認
gh api repos/{owner}/{repo}/milestones/{milestone_number} --jq '.open_issues'
```

- `open_issues` が `0` の場合 → `phase` を採用
- Milestone が特定できない場合 → この条件をスキップして次へ

#### 優先度 3: Epic 完了判定（全 Task 完了 + PR あり）

```bash
# 未完了 Task の確認（0 件なら Task 完了）
gh issue list --label task --state open --json number,title

# 現在ブランチの PR 確認
gh pr list --head $(git branch --show-current) --json number,isDraft
```

- 未完了 Task が 0 件 **かつ** PR が存在する → `epic` を採用
- 未完了 Task が存在する場合 → この条件をスキップして次へ

#### 優先度 4: コードレビュー判定（PR あり・Task 実装中）

```bash
# 現在ブランチの PR 確認
gh pr list --head $(git branch --show-current) --json number,isDraft
```

- PR が存在する（draft 含む）→ `code` を採用
- PR が存在しない場合 → この条件をスキップして次へ

#### 優先度 5: Task 定義レビュー判定（G4 通過コメントあり・impl 未着手）

```bash
# 進行中 Epic の Issue とコメントを取得
gh issue list --label "status:in-progress" --label epic --json number,title,comments
```

- `status:in-progress` の Epic Issue のコメントに `/aidd-decompose-epic` の G4 通過コメント（例: `<!-- gate:G4 -->`・`G4 PASS`）が含まれる
- **かつ** 未完了 Task は存在するが PR が未作成（impl 未着手）→ `task-spec` を採用
- 条件を満たさない場合 → この条件をスキップして次へ

#### 優先度 6: Epic 仕様書レビュー判定（G2 通過コメントあり・decompose 未着手）

```bash
# 進行中 Epic の Issue とコメントを取得
gh issue list --label "status:in-progress" --label epic --json number,title,comments
```

- `status:in-progress` の Epic Issue のコメントに `/aidd-new-epic` の G2 通過コメント（例: `<!-- gate:G2 -->`・`G2 PASS`）が含まれる
- **かつ** Task Issue が未作成（decompose 未着手）→ `epic-spec` を採用
- 条件を満たさない場合 → 判定不可（優先度 7）

#### 優先度 7: 判定不可

以下のメッセージを出力してユーザーに種別選択を求める:

```
レビュー種別を自動検出できませんでした。以下の形式で指定してください:
- /aidd-review --type epic-spec ES-NNN   — Epic 仕様書レビュー
- /aidd-review --type task-spec TASK-NNN — Task 定義レビュー
- /aidd-review --type code [PR番号]       — コードレビュー
- /aidd-review --type epic ES-NNN        — Epic 総合レビュー
- /aidd-review --type phase              — Phase 完了レビュー
```

## 対象 ID の自動推定

引数に対象 ID が含まれない場合、種別が確定した後に以下で推定する:

| 種別 | 推定方法 |
|------|---------|
| `epic-spec` | `status:in-progress` の Epic Issue 番号から `ES-NNN` を取得 |
| `task-spec` | `status:in-progress` の Epic に紐づく Task 定義ファイルを取得 |
| `code` | `gh pr list --head $(git branch --show-current)` の PR 番号 |
| `epic` | `status:in-progress` の Epic Issue 番号から `ES-NNN` を取得 |
| `phase` | 現在の Milestone 名から Phase 番号を取得 |

## ユーザー確認フォーマット

推定した種別と対象 ID をユーザーに提示し、確認を得てから Step 1 へ進む:

```
現在の状態: [判定根拠]
レビュー種別: [推定種別]（例: epic — 全 Task 完了・PR #123 あり）

この種別で実行してよいですか？（y / 別の種別を指定）
```

### 確認メッセージの例

```
現在の状態: 全 Task 完了・PR #123 が open（draft 解除済み）
レビュー種別: epic — ES-042「ユーザー認証」（PR #123 あり）

この種別で実行してよいですか？（y / 別の種別を指定）
```

```
現在の状態: G4 通過コメントを確認・PR 未作成（impl 未着手）
レビュー種別: task-spec — ES-042 に紐づく Task 定義群

この種別で実行してよいですか？（y / 別の種別を指定）
```

## `--type` 指定時の検証

`--type` が明示指定された場合でも、以下の最低限の検証を実施する:

| 種別 | 検証内容 |
|------|---------|
| `epic-spec` | 対象 Epic 仕様書ファイル（`docs/requirements/ES-NNN-*.md`）が存在するか |
| `task-spec` | 対象 Task 定義ファイル（`docs/tasks/TASK-NNN-*.md`）が存在するか |
| `code` | 対象 PR が存在するか |
| `epic` | 対象 Epic Issue が存在するか |
| `phase` | 現在の Milestone が存在するか |

検証失敗時はエラーメッセージを出力し、対象を特定する方法を案内する。

## Step 0 完了条件

- レビュー種別が確定している
- 対象 ID が確定している（または `phase` 種別で不要と判断）
- ユーザーが確認メッセージに対して「y」または明示的な承認を返している

以上が満たされた後、Step 1 へ進む。
