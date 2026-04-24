---
name: aidd-phase-review
description: >
  Phase 完了時に成功基準・全 Epic 完了・マスタドキュメント最新化・非機能要件を検証し、PASS なら G6 通過記録まで実行する。
  Phase の全 Epic が完了した後、G6 マイルストーン判定に進む前に常にこのスキルを呼び出す。
type: skill
argument-hint: "[Phase ID (例: PD-005)]"
---

# /aidd-phase-review — Phase 完了検証（G6 通過記録）

Phase の全 Epic 完了後に、成功基準の達成状況を検証し、PASS なら G6 通過コメントを記録して Phase Issue を close する。

> **このスキルの目的は「Phase のビジネス成果基準を満たしているかを検証し、PASS なら G6 通過記録まで完遂する」こと。** G6 通過記録は `/aidd-next` に委ねない。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| Phase の全 Epic が完了済み | 全 Epic Issue が closed | `/aidd-epic-review` で残 Epic を完了してください |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| Phase ID | 引数 | 任意 | `PD-NNN` 形式。指定なしなら自動推定 |

### capability 呼び出し

該当なし

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| 検証結果 | 対話出力 | 成功基準・Epic 完了・マスタドキュメント・非機能要件の検証結果 |
| 未達項目リスト | 対話出力 | 具体的な対応アクション付き |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-next` | 未達項目 0 件の場合、G6 マイルストーン判定に進む |

## Step 1: 入力受付

引数から Phase ID（`PD-NNN` 形式）を取得する。指定がなければオープンな Milestone から自動推定し、ユーザーに確認する。取得した Phase ID は `$PHASE_ID` として以降のステップで参照する。

以下を読み込む:

| 入力 | 取得元 | 用途 |
|------|--------|------|
| Phase 定義書 | `docs/requirements/PD-NNN-*.md` | 成功基準・ストーリー一覧 |
| 全 Epic 仕様書 | `docs/requirements/ES-*.md`（Phase に紐づくもの） | 各 Epic の完了状況 |
| Milestone | `gh api repos/{owner}/{repo}/milestones` | Issue の完了状況 |
| feedback Issues | `gh issue list --label feedback --state open` | 未対応 feedback |
| マスタドキュメント | 技術スタック・アーキテクチャ概要等 | 最新化チェック |

## Step 2: 検証実行

[milestones.md](../../aidd-framework/process/milestones.md) の G6 確認事項に基づき、以下を検証する。

### 2-1. 全 Epic 完了確認

Phase に紐づく全 Epic Issue が closed であることを確認する（`gh issue list --label epic --state closed --milestone "Phase N"`）。

### 2-2. 成功基準検証

Phase 定義書の成功基準を 1 件ずつ確認し、達成状況を集約する。**全件を全文で表示する（省略禁止）。**

```
| 基準 | 内容（全文・省略禁止） | 達成状況 |
|------|---------------------|---------|
| 基準-1 | [Phase 定義書の成功基準の全文をそのまま転記。要約・省略不可] | ✅ / ❌ |
```

### 2-3. 非機能要件の目標値達成確認

Phase 定義書の非機能要件に目標値が定義されている場合、達成状況を確認する。

### 2-4. マスタドキュメント最新化チェック

以下のマスタドキュメントが Phase の成果を反映して最新化されているか確認する:

- 技術スタック（`docs/architecture/tech-stack.md`）
- アーキテクチャ概要（`docs/architecture/architecture-overview.md`）
- DB 設計（該当する場合）
- ドメイン成果物（`docs/domain/`）

### 2-5. feedback Issue 確認

全 feedback Issue がクローズまたは判断済み（対応済み / 次 Phase 送り / 見送り）であることを確認する。

### 2-6. レトロスペクティブ確認

プロセスの振り返りが実施されているか確認する（人間に確認）。

## Step 3: 結果提示

検証結果を以下のフォーマットで提示する:

```
## Phase 完了検証: PD-NNN [Phase名]

### 全 Epic 完了
| Epic | 名称 | ステータス |
|------|------|----------|
| ES-NNN | [名称] | ✅ 完了 / ❌ 未完了 |

### 成功基準
| 基準 | 内容 | 達成状況 |
|------|------|---------|

### 非機能要件
| 項目 | 目標値 | 達成状況 |
|------|--------|---------|

### マスタドキュメント
| ドキュメント | 最新化 |
|------------|--------|

### feedback
| 件数 | 状態 |
|------|------|

### レトロスペクティブ
[実施済み / 未実施]

---
未達項目: N 件
```

### Phase 実働確認（ローカルファースト原則）

全チェック項目を PASS した後、Phase の主要ユースケースをローカル環境で通し確認する。
詳細フローは `aidd-framework/guides/local-verification.md` §3 を参照。

**実行前にユーザーの承認を得る（時間がかかるため）:**

```
フルスタックを起動し、以下のユースケースを確認します。進めてよいですか？

起動: task infra:up + task dev
確認するユースケース（Phase 定義書の主要ユースケースから取得）:
- [Phase 定義書の主要ユースケース一覧]
```

承認後、AI が実行:

1. `task infra:up`（データストア起動）
2. `task dev`（アプリ起動・確認）
3. 各ユースケースを API/agent-browser で実行

結果レポートを提示し、ユーザーの確認を得てから PASS/FAIL 判定に進む。

結果に応じて以下を実行する:

**PASS（未達 0 件）の場合 — G6 通過記録を行う（#727）:**

```bash
# Step 1 で特定した Phase ID（例: PD-005）から Phase 番号を抽出して Milestone を特定
# 複数 Phase が open でも正しい Milestone を選択できる
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PHASE_NUM=$(echo "$PHASE_ID" | sed 's/PD-0*//')  # PD-005 → 5
MILESTONE_TITLE=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title | startswith(\"Phase $PHASE_NUM:\")) | .title")
MILESTONE_NUM=$(gh api "repos/$REPO/milestones" --jq ".[] | select(.title == \"$MILESTONE_TITLE\") | .number")

# 現 Phase の最終 Epic Issue に G6 通過コメントを記録
# （Epic Issue は --milestone で Milestone に紐付く。PR は Milestone なしのため Issue を使用）
LAST_EPIC=$(gh issue list --label "epic" --state closed --milestone "$MILESTONE_TITLE" --json number --jq '.[0].number')
gh issue comment "$LAST_EPIC" --body "✅ G6 通過 ($(date '+%Y-%m-%d'))

Phase 完了検証が PASS しました。次 Phase の定義に進んでください。"

# Milestone を close（G6 = Phase 完了）
gh api "repos/$REPO/milestones/$MILESTONE_NUM" -X PATCH -f state=closed
```

```
次のステップ:
→ PASS: G6 通過記録完了。`/aidd-next` で次 Phase の計画へ
→ 未達 N 件（FAIL）: 各未達項目の対応アクションを実行し、再度 `/aidd-phase-review PD-NNN` で検証
```

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う** — 問題の後回しを推奨しない
- 全成功基準を漏れなく検証する — 理由: 1 つでも漏れると Phase 完了が不完全になる
- 未達項目は具体的な対応アクションとともに提示する — 理由: 「何をすればよいか」を明確にする
- マスタドキュメントの最新化漏れを検出する — 理由: 旧情報が次 Phase に持ち越されるのを防ぐ
- 検証は読み取り専用。修正が必要な場合はユーザーに提案し承認を得てから実行する — 理由: 意図しない変更を防ぐ
- 成果物生成・実装完了時にコミットを自動実行する。ユーザーの指摘反映後・ステップ承認後などの状態遷移ごとにもコミットする。push と PR 作成はユーザーの確認を待つ
