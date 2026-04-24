---
name: aidd-impl-review
description: >
  実装中の任意タイミングで PR のコードレビューを単体実行する。
  Anthropic 公式 code-review スキルの設計（claude-plugins-official + claude-code-plugins）を統合し、
  4 並列エージェント（Sonnet×2 CLAUDE.md + Opus×2 バグ）+ バリデーション + HIGH SIGNAL フィルタリングで
  高品質なレビューを提供する。`docs/conventions/` の aidd 固有規約も参照対象に含む。
  実装中にコードレビューが欲しい場面で常にこのスキルを呼び出す。
type: skill
context: fork
argument-hint: "[PR番号 or URL] [--comment]  例: /aidd-impl-review 123 --comment"
---

# /aidd-impl-review — コードレビュー単体実行

実装中の PR を多角的にレビューし、HIGH SIGNAL な問題のみを日本語で報告する。

> **このスキルの目的は「Epic 総合レビューを待たずに早期フィードバックを得ること」。** 明らかなバグ・規約違反・ロジックエラーを早期に検出し、手戻りを減らす。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| 対象 PR がオープン | `gh pr list` | PR を作成してから実行 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| PR 番号/URL | 引数 | 任意 | 省略時は現在ブランチの PR を自動推定 |
| `--comment` | フラグ | 任意 | 指定時は GitHub インラインコメントとして投稿。省略時は端末出力のみ |

### capability 呼び出し

| capability | Step | 引数 |
|-----------|------|------|
| haiku agent | Step 1 | PR 適格性チェック |
| sonnet agent | Step 2 | CLAUDE.md・conventions 準拠チェック（×2 並列） |
| opus agent | Step 2 | バグ検出（×2 並列） |
| haiku/sonnet/opus agent | Step 3 | 問題バリデーション（Opus: バグ、Sonnet: 規約違反） |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| 問題一覧 | 端末出力 | 常に出力（`--comment` の有無に関わらず） |
| GitHub インラインコメント | PR コメント | `--comment` 指定時のみ投稿 |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-epic-review` | Epic の全 Task 実装完了時（総合レビュー） |

## Step 0: 入力受付・PR 特定

> **前提: なし。**

`references/step1-eligibility.md` §「PR 特定」を参照して実行する。

1. 引数で PR 番号/URL が指定されている場合はそれを使用する
2. 指定がない場合は `gh pr list --head $(git branch --show-current)` で現在ブランチの PR を取得し、ユーザーに確認する
3. 取得した PR 番号で Step 1 へ進む

## Step 1: PR 適格性チェック

> **前提: Step 0 が完了していること（PR 番号が特定済み）。**

`references/step1-eligibility.md` を読み込んで実行する。

**概要:** Haiku エージェントで PR の適格性を確認する。以下のいずれかに該当する場合は停止する:

- クローズ済み
- draft PR
- 自動生成 PR（依存関係更新・CI 生成等）
- Claude がすでにコメントを残している（`--comment` 指定時のみ確認）

**成果物:** 適格性チェック結果

## Step 2: 並列コードレビュー

> **前提: Step 1 の適格性チェック PASS。**

`references/step2-review.md` を読み込んで実行する。

**概要:** 4 エージェントが並列で独立したレビューを実施する:

| エージェント | モデル | 観点 |
|------------|--------|------|
| Agent #1 | Sonnet | CLAUDE.md 準拠（ルート + 変更ディレクトリ） |
| Agent #2 | Sonnet | `docs/conventions/` 準拠（aidd 固有規約） |
| Agent #3 | Opus | 明らかなバグ（diff のみ。コンテキスト外は見ない） |
| Agent #4 | Opus | セキュリティ・ロジック問題 |

加えて以下の観点も任意で含める:

- git blame/履歴: 変更箇所の歴史的コンテキスト
- 過去 PR コメント: 同ファイルへの過去指摘の確認
- コードコメント整合: 変更と既存コメントの矛盾

**HIGH SIGNAL 原則:** フラグするのは以下のみ。フォールスポジティブは禁止。

- コンパイルエラー・型エラー（linter が検出するものを除く）
- 明確なロジックバグ（特定の入力で確実に失敗する）
- 明確な CLAUDE.md/conventions 違反（ルールを直接引用できる場合のみ）

**成果物:** 問題の一覧（各問題: 説明・観点・フラグ理由）

## Step 3: バリデーション + フィルタリング

> **前提: Step 2 が完了していること。**

`references/step3-validate.md` を読み込んで実行する。

**概要:** Step 2 で検出された各問題に対して、専用バリデーションサブエージェントを並列で起動し、問題が実際に HIGH SIGNAL かを再確認する:

- バグ問題 → Opus で再検証
- CLAUDE.md/conventions 違反 → Sonnet で再検証

バリデーションを通過した問題のみを最終リストとする。

**成果物:** HIGH SIGNAL 確認済み問題一覧

## Step 4: 出力

> **前提: Step 3 が完了していること。**

`references/step4-output.md` を読み込んで実行する。

**概要:**

- **常に**: 端末に問題一覧を日本語で出力（問題なしの場合は「問題なし」を明示）
- **`--comment` あり + 問題あり**: GitHub インラインコメントを投稿
  - 小さな修正（5行以内・単一箇所）: コミット可能な提案ブロックを付与
  - 大きな修正: 問題説明のみ（提案ブロックなし）
- コード引用・ファイルリンクは英語、説明文は日本語

**成果物:** 端末出力 + GitHub インラインコメント（`--comment` 指定時のみ）

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う**
- ユーザー確認なしの自動実行禁止（Step 0 の PR 確認を除く）
- **HIGH SIGNAL 原則を厳守する** — フォールスポジティブを出さない
- 各ステップの詳細手順は `references/` を読んで実行する。SKILL.md 内に手順を複製しない
