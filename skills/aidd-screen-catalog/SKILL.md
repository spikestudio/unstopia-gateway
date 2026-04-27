---
name: aidd-screen-catalog
description: >
  /aidd-screen-plan が生成した画面一覧ファイル群を Phase 横断で集約し、アプリ全体の画面カタログを生成する。
  Phase 完了後（/aidd-review phase 前）に実行する。
type: skill
argument-hint: "[docs/design/ ディレクトリパス（省略可）]"
---

# /aidd-screen-catalog — Phase 横断 画面カタログ生成

`/aidd-screen-plan` が生成した `docs/design/screen-list-*.md` ファイル群を Phase 横断で集約し、アプリ全体の画面カタログ（`docs/design/screen-catalog.md`）を生成するスキル。

> **このスキルの目的は「Phase をまたいだ全画面の一覧を一か所で把握できるようにし、MVPスコープの確認・Epic ごとの担当画面の確認を可能にする」こと。**

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| 画面一覧ドキュメントが1件以上作成済み | `docs/design/screen-list-*.md` が存在する | `/aidd-screen-plan` を先に実行 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| docs/design/ パス | 引数 | 任意 | 省略時は `docs/design/` を自動使用 |

### capability 呼び出し

| capability | Step | 引数 |
|-----------|------|------|
| （なし） | — | — |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| 画面カタログ | Markdown | `docs/design/screen-catalog.md` |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-review --type phase` | カタログ生成後、Phase 完了検証に進む場合 |

## Step 0: 引数受付・screen-list 収集

`docs/design/screen-list-*.md` ファイルを全件収集し、存在確認・重複 SCR-ID の検出を行う。

詳細手順は `references/step0-input.md` を参照して実行する。

## Step 1: 集約・カタログ生成

収集した全 screen-list から SCR-ID を集約し、以下の3つのビューを含む `docs/design/screen-catalog.md` を生成する。

**生成するビュー:**

1. **全画面一覧**（SCR-ID 昇順）— 全 SCR-ID・画面名・種別・優先度・MVPスコープ・担当 Epic（AC-E055-01, AC-E055-02）
2. **Epic 別ビュー**— 担当 Epic ごとにグループ化した画面一覧（AC-E055-03）
3. **MVP 画面一覧**— MVPスコープ `in` のみを抽出したセクション（AC-E055-04）

ユーザーの明示的な承認を得てからファイルに書き出す。

詳細手順は `references/step1-catalog.md` を参照して実行する。

## Step 2: ブリーフィング・完了

`references/briefing-spec.md` に従ってブリーフィングを実行する。

**重点項目:**

- 収集した screen-list ファイル数と総 SCR-ID 数
- MVP スコープ内の画面数
- Epic ごとの画面数内訳
- 重複 SCR-ID の有無

---

## 重要なルール

- **日本語で対話する**
- **FRAMEWORK.md の意思決定基準に従う**
- **SCR-ID 重複を警告する** — 重複があっても停止せずに除外して続行する
- **ブリーフィング省略禁止** — Step 2 完了時に `references/briefing-spec.md` に従ったブリーフィングを必ず実行する
- **各ステップの詳細手順は `references/` を読んで実行する**
