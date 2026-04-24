---
name: aidd-status
description: >
  Phase・Epic・Task の進捗状況をツリー構造で表示する。GitHub Issues のみをベースに状態を取得し、
  Phase → Epic → Task のツリーとゲート通過状況を提示する。
  進捗を確認したい場合に常にこのスキルを呼び出す。
type: skill
argument-hint: "[--phase N | --epic ES-NNN]"
---

# /aidd-status — 進捗ツリー表示

Phase / Epic / Task の進捗をツリー構造で表示する。GitHub Issues（ラベル・PR 状態・コメント）のみをベースに状態を構築する。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| aidd-fw がインストール済み | `aidd-framework/` の存在確認 | `/aidd-setup fw` を先に実行 |
| GitHub リポジトリが設定済み | `gh repo view` で確認 | `/aidd-setup project` を先に実行 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| `--phase N` | 引数 | 任意 | 指定 Phase に絞り込んで表示 |
| `--epic ES-NNN` | 引数 | 任意 | 指定 Epic に絞り込んで表示 |
| （引数なし） | — | — | プロジェクト全体の進捗を表示 |

### capability 呼び出し

該当なし

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| 進捗ツリー | 対話出力 | Phase → Epic → Task のツリー構造表示 |
| ゲート通過状況 | 対話出力 | G2/G3/G4/G5 の通過状況（✅ / —） |
| サマリー | 対話出力 | Epic/Task 完了数、オープン PR 数、feedback 数 |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-next` | 次のアクションを確認したい場合 |

## Step 1: データ取得

以下のコマンドを並列実行して JSON データを取得する:

```bash
# Epic 一覧（milestone 付き）
gh issue list --label epic --state all --json number,title,state,milestone,labels --limit 200

# Task 一覧
gh issue list --label task --state all --json number,title,state,labels --limit 500

# PR 一覧
gh pr list --state all --json number,title,state,headRefName,labels,body --limit 200

# feedback 一覧（未対応のみ）
gh issue list --label feedback --state open --json number,title --limit 100
```

引数で絞り込みが指定されている場合は、取得後にフィルタリングする。

## Step 2: ゲート通過状況の判別

各 Epic Issue のコメントと関連 PR のラベルを確認してゲート通過状況を判定する。

### ゲート判別方法

| ゲート | 判別条件 |
|--------|---------|
| G2 | Epic Issue コメントに `✅ G2 通過` が存在する |
| G3 | Epic Issue コメントに `✅ G3` が存在する（G2 と統合の場合は G2 通過と同時に通過扱い） |
| G4 | Epic Issue コメントに `✅ G4 通過` が存在する |
| G5 | 対応 PR に `gate:reviewed` ラベルが付与されている、または Epic Issue コメントに `✅ G5 通過` が存在する |

各 Epic のコメント取得:

```bash
gh issue view <number> --json comments --jq '.comments[].body'
```

## Step 3: ツリー構築・出力

### Epic と Task の親子関係の構築

- Epic: `epic` ラベルを持つ Issue
- Task: `task` ラベルを持ち、Epic Issue の Sub-issue として紐付いている Issue
- Task の Epic への紐付け: Epic Issue の `subIssues` を最優先で使う。旧データのみタイトルや本文の `ES-NNN` / `Part of #NNN` を補助的に使う

### Milestone（Phase）のグルーピング

- Phase: Milestone を最上位ノードとして扱う（`Phase N: [Phase名]` 形式）
- Epic: Milestone 配下の `epic` ラベル Issue を対応する Phase 配下に表示する
- Milestone が `Enhancement` または設定なし: スタンドアロン Enhancement として表示

### 出力フォーマット

```
## プロジェクト状態

### Phase: [Phase名] (#PPP, Milestone)
  Epic #NNN: [Epic名] — open/closed
    ゲート: G2 ✅ G3 ✅ G4 ✅ G5 —
    PR: #MMM (open/merged)
    Tasks:
      #AAA TASK-xxx — closed ✅
      #BBB TASK-yyy — open (in-progress)
      #CCC TASK-zzz — open

### スタンドアロン Enhancement
  Epic #PPP: [Epic名] — closed ✅

### 未対応 feedback
  #QQQ: [feedback タイトル]

---
サマリー: Epic N/M 完了 | Task N/M 完了 | オープン PR N 件 | 未対応 feedback N 件
```

### 表示ルール

- closed の Epic/Task には ✅ を付ける
- `status:in-progress` ラベルの Task には `(in-progress)` を付ける
- PR が存在する Epic にはその PR 番号と状態を表示する
- ゲート未通過は `—`、通過済みは `✅` で表示する
- feedback が 0 件の場合は「未対応 feedback」セクションを省略する

### Worktree 確認

アクティブな worktree と対応する PR の状態を表示する。マージ済み PR のブランチに対応する worktree が残っていれば削除を提案する。worktree が main のみの場合はこのセクションを省略する。

```bash
git worktree list
```

## 重要なルール

- 日本語で出力する
- **FRAMEWORK.md の意思決定基準に従う** — 問題の後回しを推奨しない
- 表示は読み取り専用 — 状態の自動修正は行わない。修正アクションを提案のみ行う。理由: 意図しない状態変更を防ぐ
- ツリーは視覚的に見やすく整形する — 理由: 一目で全体像を把握できることが目的
- Issue が存在しない Phase/Epic は表示しない — Issues ベースで構築するため
- ゲート判別のためのコメント取得は Epic ごとに実行する（並列化可能）
