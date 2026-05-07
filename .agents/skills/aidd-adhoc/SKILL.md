---
name: aidd-adhoc
type: skill
description: >
  Phase/Epic パイプライン外の単発作業（bugfix・hotfix・後付けTask・雑務）を統一フローで処理する。
  種別に応じてブランチ命名とプロセスの重さを自動調整する。
  バグ修正、緊急修正、後付けTask追加、雑務を行いたい場合は常にこのスキルを呼び出す。
argument-hint: "[種別] [概要]  例: fix ログインエラー / hotfix / chore deps更新"
---

# /aidd-adhoc — 単発作業（bugfix/hotfix/後付け Task/雑務）

Phase/Epic パイプラインに属さない単発作業を、種別に応じた適切なプロセスで処理する。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| プロジェクト初期化済み | GitHub リポジトリの設定確認 | `/aidd-setup project` を先に実行 |
| task 種別の場合: 親 Epic が存在 | `gh issue list --label "epic" --state open` | `/aidd-new-epic` を先に実行、または chore 種別を使用 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| 種別 | 引数の第 1 トークン | 任意 | `fix` / `hotfix` / `task` / `chore`。省略時は自動推定 |
| 概要 | 引数の残り | 任意 | 作業の概要。省略時はユーザーに聞く |

### capability 呼び出し

該当なし

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| Issue | GitHub Issue | fix/hotfix: 必須、task: 必須、chore: 省略可 |
| Task 定義 | ファイル | fix/task: `docs/tasks/TASK-NNN-slug.md`。hotfix/chore: 省略可 |
| 実装コード | ファイル | AC に対応するコード変更 |
| PR | GitHub PR | fix/hotfix/chore: 作成。task: 既存 Epic PR に含まれる |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `references/review-checklist.md` | fix/hotfix/chore: PR 作成後のレビュー（各フロー末尾で実行） |
| `/aidd-impl` | task 種別: 既存 Epic の次の Task へ |

## 種別一覧

| 種別 | 用途 | ブランチ | プロセス | Issue | Task 定義 |
|------|------|---------|---------|-------|----------|
| `fix` | 開発中バグ修正 | `fix/ISSUE-NNN-slug` | 標準（Issue → Task → 実装 → レビュー → PR） | 必須 | 必須 |
| `hotfix` | リリース済み緊急修正 | `hotfix/ISSUE-NNN-slug` | 最短（Issue → 調査 → 修正 → PR） | 必須 | 省略可 |
| `task` | 既存 Epic への後付け Task | Epic ブランチ上 | 軽量（親 Epic → Task → 実装 → コミット） | 必須 | 必須 |
| `chore` | 雑務（deps 更新・CI 修正等） | `chore/slug` | 最短（実装 → コミット → PR） | 省略可 | 省略可 |

## Step 1: 入力受付・種別判定

### 1-1. 種別の特定

**引数あり（例: `/aidd-adhoc fix ログインエラー`）:**

- 第 1 トークンが種別名（fix / hotfix / task / chore）と一致 → その種別で確定
- 一致しない → 引数全体を概要として扱い、種別を自動推定

**引数なし:**

- ユーザーに作業内容を聞き、以下の基準で種別を自動推定:
  - 「バグ」「エラー」「修正」→ fix
  - 「緊急」「本番」「リリース済み」→ hotfix
  - 「追加」「後付け」+ Epic 名言及 → task
  - 「更新」「CI」「deps」「リファクタ」→ chore
- 推定結果をユーザーに確認してから進行

**推定できない場合:**

```
作業種別を自動推定できませんでした。以下から選択してください:
- fix — 開発中に見つかったバグの修正
- hotfix — リリース済みの緊急バグ修正
- task — 既存 Epic への後付け Task 追加
- chore — 依存関係更新・CI 修正等の雑務
```

### 1-1b. Epic 作業中チェック（#906）

種別が fix / chore と推定された場合、ブランチ作成前に `status:in-progress` の Epic が存在するかを確認する:

```bash
gh issue list --label "epic" --label "status:in-progress" --state open --json number,title
```

**Epic 作業中の場合（in-progress Epic が存在する）:**

修正のスコープを確認し、以下のガイドを表示する:

```
現在 Epic #NNN「[Epic名]」が作業中です。
この修正は Epic のスコープ内で解決できますか？

[スコープ内] → 現在の Epic ブランチ（feature/ES-NNN-slug）にコミットを追加します（新規ブランチ不要）
[スコープ外] → /aidd-adhoc の通常フローで別ブランチを作成します
```

ユーザーの回答に応じてフローを分岐する。スコープ内と判断した場合は Epic ブランチに切り替えてコミットを追加し、Step 2 以降はスキップする。

**Epic 作業中でない場合:** そのまま 1-2 へ進む。

### 1-2. Issue 作成（種別に応じて）

> **CRITICAL: ブランチ作成・コード変更より先に Issue を作成する。** Issue 番号がブランチ名に含まれるため、Issue なしでブランチを作ることはできない。

- **fix**: `gh issue create --label "task"` — バグの概要・再現手順・期待動作を記載
- **hotfix**: `gh issue create --label "task"` — 緊急度・影響範囲・再現手順を記載
- **task**: `gh issue create --label "task"` — 親 Epic の Milestone を紐付け
- **chore**: 原則 Issue を作成する。省略する場合は必ずユーザーに確認を取ること（暗黙スキップ禁止）。作成する場合は `--label "chore"`

### 1-3. ブランチ作成

Issue 作成後、発行された Issue 番号を使ってブランチを作成する。**`git checkout -b` 実行前に以下の確認をユーザーに行うこと（#907）:**

```
新規ブランチを作成しようとしています:
  ブランチ名: <種別>/<ISSUE-NNN-slug>
  起点: main
  理由: <Issue タイトル>

作成してよいですか？
```

承認後に実行する:

```bash
# fix（ISSUE-NNN は 1-2 で作成した Issue 番号）
git checkout -b fix/ISSUE-NNN-slug main

# hotfix
git checkout -b hotfix/ISSUE-NNN-slug main

# task（既存 Epic ブランチに切替 — 新規ブランチではないため確認不要）
git checkout feature/ES-NNN-slug
git pull --ff-only

# chore
git checkout -b chore/slug main
```

## Step 2: 種別フロー実行

`references/flow-adhoc.md`（fix / hotfix / chore 共通）または `references/flow-task.md`（task 種別）を読み込んで実行する。

| 種別 | 参照ファイル |
|------|------------|
| fix | `references/flow-adhoc.md` |
| hotfix | `references/flow-adhoc.md` |
| chore | `references/flow-adhoc.md` |
| task | `references/flow-task.md` |

## Step 3: 完了処理

種別に応じた完了処理を実行する:

**fix / hotfix / chore（独立 PR）:**

`.github/PULL_REQUEST_TEMPLATE.md` を Read し、各セクションを埋めた body で PR を作成する。

```bash
git push -u origin <ブランチ名>
gh pr create --title "<type>: <概要>" --body "[テンプレートを読み込んで生成した body]"
```

```
単発作業が完了しました:
- 種別: fix / hotfix / chore
- Issue: #XX
- PR: #YY
- ブランチ: <ブランチ名>

次のステップ:
→ 各フロー末尾の「PR レビュー」ステップで review-checklist.md を実行
→ gate:reviewed 付与後、「merge」でマージ
→ マージ後: `git checkout main && git pull --ff-only` でローカル main を最新化
```

**task（既存 Epic のコミット）:**

```bash
git add [変更ファイル]
git commit -m "feat: TASK-NNN [Task名]"
```

```
後付け Task が完了しました:
- 種別: task
- 親 Epic: ES-NNN
- Task: TASK-NNN (#XX)
- コミット: <ハッシュ>

次のステップ:
→ `/aidd-impl` で次の Task を実装
→ 全 Task 完了なら `/aidd-review epic`
```

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う** — 優先順序 1〜5 に該当する問題の見送り・後回しを推奨しない
- **ブリーフィングは省略禁止** — 実装完了後、`references/briefing-spec.md` に従ったブリーフィングを必ず実行する。省略すると人間がレビューすべき判断ポイントを見落とす
- **種別の自動推定は必ずユーザーに確認する** — 推定結果を確定扱いしない。誤った種別で進むとブランチ命名・プロセスが全て狂う
- **hotfix は最短パスを維持する** — Task 定義の作成を強制しない。緊急性を最優先する
- **task 種別は既存 Epic への後付けに限定する** — 親 Epic がない場合は chore への切り替えを案内する
- **Issue 先行必須** — ブランチ作成・コード変更を開始する前に対応 Issue が必ず存在すること。chore で Issue を省略する場合もユーザーに確認してから進める（暗黙スキップ禁止）
- **PR には必ず Issue 参照を含める** — PR description に `Closes #N`（または `Related #N`）を記載すること。Issue なし PR は作成してはならない
- 成果物生成・実装完了時にコミットを自動実行する。ユーザーの指摘反映後・ステップ承認後などの状態遷移ごとにもコミットする。push と PR 作成はユーザーの確認を待つ
