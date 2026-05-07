---
name: aidd-phase-closing
description: >
  /aidd-review phase PASS 後に実行する Phase 完了処理専用スキル。
  G6 通過記録・Milestone クローズ・Epic Issue クローズ・Phase 定義書ステータス更新・
  レトロスペクティブを担う。Phase レビュー PASS 後に常にこのスキルを呼び出す。
type: skill
argument-hint: "[Phase ID (例: PD-005)]"
---

# /aidd-phase-closing — Phase 完了処理（G6 通過記録・クローズ・レトロスペクティブ）

`/aidd-review phase` PASS 後に実行する Phase 完了処理専用スキル。G6 通過記録・Milestone クローズ・Epic Issue クローズ・Phase 定義書ステータス更新・レトロスペクティブを担う。

> **このスキルの目的は「Phase レビュー PASS 後の完了処理を確実に完遂する」こと。** レビュー検証は `/aidd-review` に委ねる。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| `/aidd-review phase` が PASS 済み | PASS 記録コメントの存在 | `/aidd-review phase PD-NNN` を先に実行してください |
| Phase の全 Epic が完了済み | 全 Epic Issue が closed | 未完了 Epic を先に完了させてください |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| Phase ID | 引数 | 任意 | `PD-NNN` 形式。指定なしなら自動推定 |

### capability 呼び出し

該当なし

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| 完了処理結果 | 対話出力 | G6 通過記録・クローズ処理・レトロスペクティブの完了報告 |
| レトロスペクティブ | 対話出力 | Well/Problem/Try + 改善 Issue 一覧 |
| ブリーフィング | 対話出力 | `references/briefing-spec.md` に従った完了報告 |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-next` | 全処理完了後、次 Phase の計画に進む |

## Step 1: 前提確認

引数から Phase ID（`PD-NNN` 形式）を取得する。指定がなければオープンな Milestone から自動推定し、ユーザーに確認する。取得した Phase ID は `$PHASE_ID` として以降のステップで参照する。

詳細手順は `references/step1-gate-record.md` の「前提確認」セクションを参照。

### 確認する前提

1. `/aidd-review phase` の PASS 記録コメントが対象 Phase の Issue または Milestone に存在すること
2. Phase に紐づく全 Epic Issue が closed であること（`gh issue list --label epic --state open --milestone "Phase N"` で 0 件）
3. Phase 定義書（`docs/requirements/PD-NNN-*.md`）が存在すること

前提が満たされない場合はエラーを出力し、対応方法を案内して処理を中断する。

## Step 2: G6 通過コメント記録

`references/step1-gate-record.md` の手順に従い、G6 通過を記録する。

- Phase の最終 Epic Issue に G6 通過コメントを記録（`✅ G6 通過 (日付)`）
- Milestone に通過コメントを記録

ユーザーに確認を得てから実行する。

## Step 3: 全 Epic Issue クローズ・Phase 定義書更新

`references/step2-close-issues.md` の手順に従い、以下を実行する。

1. Phase に紐づく全 Epic Issue を closed に変更（既に closed の場合はスキップ）
2. Phase 定義書（`docs/requirements/PD-NNN-*.md`）のステータスを「完了」に更新

ユーザーに確認を得てから実行する。

## Step 4: Milestone クローズ

`references/step2-close-issues.md` の「Milestone クローズ」セクションの手順に従い、Milestone を closed に変更する。

ユーザーに確認を得てから実行する。

## Step 5: レトロスペクティブ実施

`references/step3-retrospective.md` の手順に従い、Phase のレトロスペクティブを実施する。

- Well / Problem / Try の 3 観点で振り返る
- 改善 Issue を `feedback` ラベル付きで作成（自動実行）
- 次 Phase の Milestone に紐付け

レトロスペクティブ結果をユーザーに提示し、改善 Issue の内容を確認してから作成する。

## Step 6: ブリーフィング

`references/briefing-spec.md` の仕様に従い、完了処理ブリーフィングを実行する。

- 完了した処理の一覧
- 作成した改善 Issue の一覧
- 次のアクション案内

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う** — 問題の後回しを推奨しない
- 各処理ステップはユーザーの確認を得てから実行する — 理由: 意図しない変更を防ぐ
- G6 通過記録は `/aidd-next` に委ねない — 理由: 完了処理の確実な完遂が責務
- レトロスペクティブは省略しない — 理由: 改善の継続的サイクルがフレームワークの核心
- 改善 Issue は必ず `feedback` ラベルを付けて作成する — 理由: トラッキング可能にするため
- 成果物生成・実装完了時にコミットを自動実行する。push と PR 作成はユーザーの確認を待つ
