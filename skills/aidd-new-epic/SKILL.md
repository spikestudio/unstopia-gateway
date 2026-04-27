---
name: aidd-new-epic
description: >
  Phase定義書の機能意図（やりたいこと）を受け取り、ストーリー詳細化・AC導出をEpic内で完結させる。
  2ステップ（ストーリー詳細化→AC導出）で段階的に進め、各ステップでブリーフィング→承認ゲートを設ける。
  Epicの定義・設計を行いたい場合は常にこのスキルを呼び出す。
type: skill
context: fork
argument-hint: "<Epic名>"
---

# /aidd-new-epic — Epic 定義（ストーリー詳細化 + AC 導出）

Phase 定義書の機能意図（「〇〇できる」の粒度）を受け取り、ストーリー詳細化 → AC 導出までを Epic 内で完結させる。各ステップ完了時にブリーフィング→承認ゲートを設け、スキップを構造的に防止する。

> **Phase 12 で変更（ADR-013 連動）:** Phase 定義書にストーリーが含まれなくなったため、ストーリー定義責務を Epic に移管。Step 0 で機能意図からストーリーを詳細化する。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| Phase 定義書が承認済み | `gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/milestones` で対応する Milestone が存在する | `/aidd-new-phase` を先に実行 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| Epic 名 | 引数 | 任意 | 指定なしならユーザーに聞く |

### capability 呼び出し

| capability | Step | 引数 |
|-----------|------|------|
| /aidd-research | Step 1 | 業界/ドメイン調査（必要時のみ） |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| Epic 仕様書 | ファイル | `docs/requirements/ES-NNN-slug.md` |
| GitHub Issue | GitHub | epic ラベル、Milestone 紐付け |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-epic-design ES-NNN` | G2 通過後、ドメイン設計・インターフェース設計（G3）に進む |
| `/aidd-decompose-epic` | `/aidd-epic-design`（G3）完了後、Task 分解に進む |
| `/aidd-new-epic` | 次の Epic を先に定義する場合 |

## Step 0: 入力受付・機能意図取得・ストーリー詳細化

`$ARGUMENTS` から Epic 名を取得する。指定がなければユーザーに聞く。

### 0-1. 基本セットアップ

1. Phase の自動推定（オープンな Milestone を基準に特定する）
2. Phase 定義書の「Epic マッピング」から対象 Epic に対応する機能意図を取得する
   - 機能意図が見つからない場合はエラーメッセージ + `/aidd-new-phase` の実行を案内して停止する
3. `docs/requirements/ES-*.md` をスキャンし次の番号を決定
4. [gitflow ガイド](../../aidd-framework/guides/gitflow.md)に従い、`feature/ES-NNN-slug` ブランチとワークツリーを作成する。**実行前に以下の確認をユーザーに行うこと（#907）:**

   ```
   新規ワークツリーを作成しようとしています:
     ブランチ名: feature/ES-NNN-slug
     起点: main
     理由: ES-NNN の実装ワークツリー

   作成してよいですか？
   ```

   承認後に実行する:

   ```bash
   task wt:create BRANCH=feature/ES-NNN-slug
   ```

   **このワークツリーを Epic 完了（PR マージ）まで維持する。** 途中での破棄・再作成・他ブランチへの切り替えは禁止。

5. `references/epic-spec-template.md` をコピーして `docs/requirements/ES-NNN-slug.md` を作成
6. GitHub Issue を作成（epic ラベル、Milestone 紐付け）
7. ドキュメントの Issue フィールドに番号を記入
8. GitHub Issue に `status:in-progress` ラベルを付与する

### 0-2. ストーリー詳細化

取得した機能意図からユーザーストーリーを詳細化する。

詳細手順は `references/step0-story-elaboration.md` を参照して実行する。

**成果物:** 確定したストーリー一覧（S1〜Sn）、ペルソナ一覧

ユーザーの明示的な承認を得てから Step 1 に進む。

## Step 1: AC 導出

> **前提: Step 0（ストーリー詳細化）の承認が完了していること。**

`references/step1-ac.md` を読み込んで実行する。

**概要:** Step 0 で詳細化したストーリーから AC を導出し、Epic 仕様書ドラフトを生成する。AC 品質基準（テスト可能・境界明確・独立・完全・観測可能・E2E 検証可能）を検証する。

**成果物:** Epic 仕様書ドラフト（`docs/requirements/ES-NNN-slug.md`）

**capability 呼び出し:**

- `/aidd-research` — 業界/ドメイン調査（必要時のみ）
- セルフレビュー反復ループ — `ac, coverage` 観点（aidd-framework/references/self-review-loop.md 参照）

**追加レビュー観点:**

| 観点 | チェック内容 |
|------|------------|
| AC←ストーリーのトレーサビリティ | 全ストーリーに対して AC が導出されているか |
| AC の品質 | 6 基準を満たしているか |
| AC に複合条件がないか | 「かつ/または」を含む AC は分割する |
| 1 ストーリーの AC 数 | 8 を超えていないか |
| Phase 定義書との乖離 | ストーリー概要から逸脱していないか |

**完了時:** `references/briefing-spec.md` に従ってブリーフィングを実行し、承認を得る。

**ブリーフィング重点:**

| 重点項目 | 説明内容 |
|---------|---------|
| ストーリーの背景と意義 | 各ストーリーが解決する課題を説明する |
| 導出した AC | ストーリーからどのように AC を導出したか |
| AI 補完の AC | AI が追加した AC を一覧で提示し、追加理由を説明する |
| エッジケースの判断 | AC に含めた/含めなかった判断理由 |

> Step 1 の承認 = G2（Epic 承認）相当。

## 完了処理

> **タイミング**: Step 1（G2）の最終ブリーフィングをユーザーが承認した直後に実行する。

```
Epic 定義が完成しました（G2 承認）:
- ドキュメント: docs/requirements/ES-NNN-slug.md
- GitHub Issue: #XX (epic ラベル, [Phase名] Milestone)
- Phase 内進捗: Epic N/M 完了
```

**Epic 仕様書のセルフレビューと確定コミット（#1094）:**

> **注意**: draft PR 作成・`/aidd-decompose-epic` 案内の前に必ずセルフレビューと確定コミットを行うこと。

セルフレビュー観点（spec-consistency）:

- 全 AC に AC-ID が付与されているか
- ストーリートレース（`← Sn`）が全 AC にあるか
- AI 補完 AC に理由が明記されているか
- 完全性チェックリストが全て `[x]` か

指摘があれば修正してから確定コミットを行う:

```bash
git add docs/requirements/ES-NNN-slug.md
git commit -m "feat: ES-NNN [Epic名] — 確定版"
```

**draft PR を作成（確定コミット後）:**

```bash
git push -u origin feature/ES-NNN-slug
```

`.github/PULL_REQUEST_TEMPLATE.md` を Read し、各セクションを埋めた body で draft PR を作成する:

- `## 概要`: `🚧 作業中（Epic 仕様書承認済み、Task 実装中）` + Epic 仕様書パス・Phase 情報
- `## 関連 Issue`: `Closes #<Epic Issue番号>`

```bash
gh pr create \
  --draft \
  --title "[WIP] feat: ES-NNN [Epic名]" \
  --body "[テンプレートを読み込んで生成した body]"
```

draft PR は `/aidd-review epic` PASS 後に自動的に draft 解除される。

```
次のステップ（条件に応じて選択）:
→ ドメイン設計に進む: `/aidd-epic-design ES-NNN` で ES-NNN のドメイン設計を実行（G3 へ）
→ 次の Epic を先に定義する: `/aidd-new-epic [次の Epic名]`（Epic N+1/M）
→ 全 Epic 定義済み: `/aidd-next` で現在地を確認
```

## ゲート制御ルール

**各ステップ間の承認ゲートは構造的に必須である。以下のルールに例外はない。**

1. **Step 0 の承認なしに Step 1 を開始してはならない。** 承認なしに次ステップを進めようとした場合、「Step 0 の承認が必要です」と表示しスキルを停止する。
2. **ブリーフィングなしに承認を求めてはならない。** 各ステップ完了時に `references/briefing-spec.md` に従ったブリーフィングを必ず実行する。1-2 行のサマリーのみでの承認要求は禁止。
3. **回答 ≠ 承認。** ユーザーの問いかけへの回答は回答内容の反映のみに留める。次ステップへの遷移には「OK」「進めて」「承認」等の明確な承認表現が必要。

## 重要なルール

- **収束フェーズ**: このスキルは収束フェーズに属する。Inception 道具箱（`/aidd-mob`・`/aidd-inception`）の成果物がある場合は 0-2-0 精緻化から開始し、重複排除・抜け補完・表現精鋭化を行う
- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う** — 優先順序 1〜5 に該当する問題の見送り・後回しを推奨しない
- **ブリーフィング省略禁止** — 各ステップ完了時に `references/briefing-spec.md` に従ったブリーフィングを必ず実行する
- AC の品質基準を妥協しない。AI が補完した AC は必ず人間に提示し、承認を得る
- 業務ルールは推測で埋めない。不明な点は人間に質問する
- 成果物生成・実装完了時にコミットを自動実行する。ユーザーの指摘反映後・ステップ承認後などの状態遷移ごとにもコミットする。push はユーザーの確認を待つ。draft PR は Step 1 承認後に自動作成する。
- 各ステップの詳細手順は `references/` を読んで実行する。SKILL.md 内に手順を複製しない
- ドメインモデル・インターフェース設計は `/aidd-epic-design` スキルで実行する（このスキルのスコープ外）
