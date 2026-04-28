---
name: aidd-adr
description: >
  ADR（Architecture Decision Record）を対話的に作成・採番・保存する。
  設計判断の背景・選択肢・トレードオフ・決定内容・影響範囲を引き出し、
  既存 ADR との矛盾チェックとドキュメント連動まで一貫して実行する。
  重要な設計判断が必要な場面で常にこのスキルを呼び出す。
type: skill
argument-hint: "[--title <タイトル>]  例: /aidd-adr --title 認証方式の選定"
---

# /aidd-adr — ADR 作成・管理

設計判断を対話で引き出し、ADR として採番・保存・整合性チェック・ドキュメント連動までを一気通貫で実行する。

> **このスキルの目的は「設計判断を一貫したフォーマットでドキュメント化し、既存 ADR との整合性を保つ」こと。**

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| `aidd-framework/templates/adr.md` が存在する | ファイル確認 | `/aidd-setup fw` を先に実行 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| タイトル | 引数 `--title <タイトル>` | 任意 | 省略時は Step 0 で決定 |

### capability 呼び出し

| capability | Step | 引数 |
|-----------|------|------|
| /aidd-research | Step 0 | 関連技術仕様・ベストプラクティス（必要時のみ） |
| aidd-architect | Step 1 | 設計判断のトレードオフ分析 |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| ADR ファイル | ファイル | `docs/architecture/adr/ADR-NNN-slug.md` |
| 矛盾チェック結果 | 対話出力 | 既存 ADR との矛盾がある場合のみ |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-new-epic` | ADR が Epic 定義の設計判断に関係する場合 |

## Step 0: 入力受付・ADR タイトル決定

1. 引数 `--title <タイトル>` が指定されている場合はそれをタイトルとして使用する
2. 指定がない場合はユーザーにタイトルを確認する
3. `/aidd-research` の呼び出しが必要な設計判断（技術選定・外部仕様・ベストプラクティスの確認が必要）かをユーザーと判断し、必要な場合は呼び出す

## Step 1: 対話による ADR 内容引き出し

> **前提: Step 0 が完了していること。**

`references/step1-dialogue.md` を読み込んで実行する。

**概要:** `agents/aidd-architect.md` の ADR 問いリスト（5問）に従ってユーザーと対話し、ADR の内容を引き出す。

**成果物:** ADR の下書き（背景・選択肢・トレードオフ・決定内容・影響範囲が揃った状態）

## Step 2: ADR 採番・保存

> **前提: Step 1 の承認が完了していること。**

`references/step2-save.md` を読み込んで実行する。

**概要:** 引き出した内容を `aidd-framework/templates/adr.md` に基づいてフォーマットし、`scripts/next-number.sh ADR` で採番して `docs/architecture/adr/ADR-NNN-slug.md` として保存する。

**成果物:** `docs/architecture/adr/ADR-NNN-slug.md`

## Step 3: 既存 ADR との矛盾チェック

> **前提: Step 2 の保存が完了していること。**

`references/step3-check.md` を読み込んで実行する。

**概要:** `docs/architecture/adr/` 配下の既存 ADR と新規 ADR の内容を比較し、矛盾を重大度（MUST FIX / SHOULD FIX）付きで検出・提示する。

既存 ADR が複数ある場合は **1 メッセージ内で全件を並列起動** して検証する:

```
# docs/architecture/adr/ の各 ADR に対して同時起動
Agent(prompt="ADR-001 と新規ADRの矛盾を検出してください。新規ADR: [内容]。既存ADR: [ADR-001のパス]")
Agent(prompt="ADR-002 と新規ADRの矛盾を検出してください。新規ADR: [内容]。既存ADR: [ADR-002のパス]")
...
```

各 Agent は「矛盾あり（MUST FIX / SHOULD FIX）/ なし」を返す。主スキルが結果を集約して提示する。

**成果物:** 矛盾チェック結果（問題がある場合のみ提示）

## Step 4: 関連ドキュメント連動

> **前提: Step 3 が完了していること（矛盾なし、または MUST FIX を解消済み）。**

`references/step4-linkage.md` を読み込んで実行する。

**概要:** ADR 保存後、関連する Epic 仕様書・マスタドキュメントへの参照追記をユーザーに提案し、承認を得て実行する。

**成果物:** 関連ドキュメントの更新（ユーザーが承認した場合）

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う**
- ユーザー確認なしの自動実行禁止
- ADR の内容は推測で埋めない。不明な点は必ずユーザーに確認する
- 各ステップの詳細手順は `references/` を読んで実行する。SKILL.md 内に手順を複製しない
