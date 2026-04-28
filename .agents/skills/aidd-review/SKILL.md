---
name: aidd-review
description: >
  コンテキストを自動検出し最適なレビュー種別（仕様書・Task定義・コード・Epic・Phase）を選択して実行するオーケストレーター。
  レビューが必要な場面で常にこのスキルを呼び出す。
type: skill
argument-hint: "[--type epic-spec|task-spec|code|epic|phase] [対象ID]"
---

# /aidd-review — 統合レビュースキル（5 種別・並列サブエージェント）

コンテキストを自動検出して最適なレビュー種別を選択し、観点ごとのサブエージェントを並列実行する。検出した問題を critical / non-critical に分類し、1 件ずつユーザーと合意しながら修正を進める。レビューが必要な場面では常にこのスキルを呼び出す。

> **このスキルの目的は「レビュー種別の選択をユーザーに委ねず、コンテキストから最適な種別を自動決定して高品質なレビューを提供すること」。** 種別ごとに特化したサブエージェントを並列起動し、漏れのない多角的な検査を実現する。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| 対象 Epic/Task/PR が存在する | `gh pr list` / `gh issue list` | 対象を作成してから実行してください |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| `--type` | フラグ | 任意 | `epic-spec` / `task-spec` / `code` / `epic` / `phase` のいずれか。省略時は自動検出 |
| 対象 ID | 引数 | 任意 | Epic ID（`ES-NNN`）・Task ID（`TASK-NNN`）・PR 番号など。省略時は自動推定 |

### capability 呼び出し

| capability | Step | 引数 |
|-----------|------|------|
| サブエージェント（種別ごと） | Step 2 | 外部データ（Step 1 で取得済み） |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| レビュー結果 | 端末出力 / PR コメント | 種別に応じて出力先が異なる（`references/step4-completion.md` 参照） |
| gate ラベル | GitHub | `epic` 種別 PASS 時: `gate:reviewed` 付与・draft 解除 |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-review --type phase` | `epic` 種別 PASS 後、Phase の全 Epic 完了時 |
| `/aidd-review --type epic` | `epic` 種別 FAIL 時、修正後に再レビュー |
| `/aidd-phase-closing` | `phase` 種別 PASS 後、G6 通過記録・Milestone クローズ |
| `/aidd-next` | PASS 後、次のアクションが不明な場合 |

## Step 0: 入力受付・コンテキスト自動検出・種別確認

`references/step0-context-detect.md` を読み込んで実行する。

**概要:**

1. `$ARGUMENTS` から `--type` フラグと対象 ID を抽出する
2. `--type` が省略された場合はコンテキストから種別を自動検出する:
   - `status:in-progress` の Epic が存在する → `epic` を候補
   - 現在ブランチが `feature/ES-NNN-slug` → `epic` を候補
   - 開いている PR が存在する → `code` を候補
   - Phase 定義書が存在し全 Epic がクローズ済み → `phase` を候補
   - `docs/requirements/ES-NNN-*.md` が存在するが PR がない → `epic-spec` を候補
   - `docs/tasks/TASK-NNN-*.md` が存在する → `task-spec` を候補
3. 推定結果をユーザーに確認してから進行する
4. **推定失敗時:**

```
レビュー種別を自動検出できませんでした。以下の形式で指定してください:
- /aidd-review --type epic-spec ES-NNN   — Epic 仕様書レビュー
- /aidd-review --type task-spec TASK-NNN — Task 定義レビュー
- /aidd-review --type code [PR番号]       — コードレビュー
- /aidd-review --type epic ES-NNN        — Epic 総合レビュー
- /aidd-review --type phase              — Phase 完了レビュー
```

## Step 1: 外部データ一括取得

`references/step1-data-fetch.md` を読み込んで実行する。

**概要:** 種別に応じた外部データを一括取得する。**外部 I/O は このステップで 1 回のみ実行する。** サブエージェントが独立にデータを取得することを禁止する。取得したデータをサブエージェントへの引数として渡す。

## Step 2: 種別ごとのサブエージェント並列起動

`references/step2-review-[type].md` を読み込んで実行する（`[type]` は Step 0 で確定した種別）。

**概要:** 種別に特化した観点（複数）のサブエージェントを並列起動し、独立したレビューを実施する。各サブエージェントは Step 1 で取得済みのデータを入力として受け取る。

| 種別 | 参照ファイル | 並列エージェント |
|------|------------|----------------|
| `epic-spec` | `references/step2-review-epic-spec.md` | 仕様完全性・ストーリー整合・AC 品質 |
| `task-spec` | `references/step2-review-task-spec.md` | Task 分解妥当性・AC 充足・実装可能性 |
| `code` | `references/step2-review-code.md` | CLAUDE.md 準拠・規約準拠・バグ・セキュリティ |
| `epic` | `references/step2-review-epic.md` | ビジネス要件・ドキュメント・コード |
| `phase` | `references/step2-review-phase.md` | 全 Epic 完了・成功基準・マスタドキュメント |

## Step 3: critical/non-critical 分類 → 1 件ずつ合意・修正

`references/step3-agree-fix.md` を読み込んで実行する。

**概要:** Step 2 の全サブエージェント結果を集約し、critical / non-critical に分類して 1 件ずつユーザーと合意しながら修正を進める。critical から処理を開始し、全件完了後に non-critical へ進む。

## Step 4: 完了処理

`references/step4-completion.md` を読み込んで実行する。

**概要:** 種別・PASS/FAIL に応じた完了処理（ラベル付与・PR コメント記録・Gate 制御）を実行する。

## 重要なルール

- **SKILL.md 内に手順を複製しない** — 各 Step の詳細手順は必ず `references/` を読んで実行する。SKILL.md 内に手順を書かない
- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う** — 優先順序 1〜5 に該当する問題の見送り・後回しを推奨しない
- **見送りには理由必須** — ユーザーが問題を見送る場合、理由なしの見送りは不可。コードコメントまたは ADR に理由を記録する
- ユーザー確認なしの自動実行禁止（Step 0 のコンテキスト自動検出を除く）
