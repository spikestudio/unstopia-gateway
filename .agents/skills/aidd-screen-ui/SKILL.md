---
name: aidd-screen-ui
description: >
  /aidd-screen-spec が生成した画面仕様書を入力として、spikestudio UIKit のコンポーネント選定・レスポンシブレイアウト設計・アノテーション付き設計ドキュメント生成・G3 レビューゲートを実行する。
  画面 UI 設計を行いたい場合に常にこのスキルを呼び出す。
type: skill
argument-hint: "[screen-spec ディレクトリパス (例: docs/design/screen-spec-epic-slug/)]"
---

# /aidd-screen-ui — UIKit コンポーネント選定・モック・G3ゲート

`/aidd-screen-spec` が生成した画面仕様書（`docs/design/screen-spec-[slug]/`）を入力として、spikestudio UIKit のコンポーネント選定・レスポンシブレイアウト設計・アノテーション付き設計ドキュメント生成・G3 レビューゲートを実行するスキル。

> **このスキルの目的は「画面仕様書から実際の UIKit コンポーネントが対話的に選定され、アノテーション付き設計ドキュメントを生成し、G3 レビューゲートで設計品質を確保する」こと。**

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| 画面仕様書が作成済み | `docs/design/screen-spec-*/` の存在確認 | `/aidd-screen-spec` を先に実行 |
| `@spikestudio/uikit` がインストール済み | `node_modules/@spikestudio/uikit/catalog.json` の存在確認 | `npm install @spikestudio/uikit` を実行（ADR-012 参照） |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| screen-spec ディレクトリパス | 引数 | 任意 | 指定なしなら未処理の画面仕様書ディレクトリを自動推定 |

### capability 呼び出し

| capability | Step | 引数 |
|-----------|------|------|
| /aidd-research | Step 1 | UIKit コンポーネント仕様の補完（必要時のみ） |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| アノテーション付き設計ドキュメント | Markdown | `docs/design/screen-ui-[slug]/[SCR-ID]-[screen-slug].md`（画面単位） |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-decompose-epic` | G3 PASS 後、Task 分解に進む場合 |
| `/aidd-next` | G3 マイルストーン判定 |

## Step 0: 引数受付・catalog.json 読み込み・screen-spec 確認

`$ARGUMENTS` から screen-spec ディレクトリパスを取得する。指定がなければ `docs/design/screen-spec-*/` を列挙してユーザーに選択を求める。`@spikestudio/uikit` のインストール確認と catalog.json の読み込みを行う。

詳細手順は `references/step0-input.md` を参照して実行する。

## Step 1: UIKit コンポーネント選定

画面仕様書の各 SCR-ID に対して、`@spikestudio/uikit/catalog.json` を参照しながら各 UI 要素のコンポーネント候補を提示し、利用者が選択・変更できる対話フローを実行する。UIKit に対応するコンポーネントが存在しない場合は「カスタム実装」として記録し続行する。

**対応 AC:** AC-E054-01, AC-E054-02, AC-E054-03

詳細手順は `references/step1-component.md` を参照して実行する。

## Step 2: レスポンシブレイアウト設計

選定したコンポーネントを使い、sm（モバイル）・md（タブレット）・lg（デスクトップ）の 3 ブレークポイントでのレイアウト構成を対話的に定義する。シンプルな画面では「レスポンシブ対応不要」として省略できる。

**対応 AC:** AC-E054-04, AC-E054-05, AC-E054-06

詳細手順は `references/step2-layout.md` を参照して実行する。

## Step 3: アノテーション付き設計ドキュメント生成

`references/ui-component-template.md` に従って `docs/design/screen-ui-[slug]/[SCR-ID]-[screen-slug].md` を生成する。コンポーネント名・Props・バリアント・`@spikestudio/uikit` のインポートパスをアノテーションとして記録する。

**対応 AC:** AC-E054-07, AC-E054-08, AC-E054-09

詳細手順は `references/step3-annotation.md` を参照して実行する。

## Step 4: G3 レビューゲート・反復フロー

G3 Section 2（画面設計承認）のチェックリストを提示し、PO/TL がレビューを実施する。レビュー指摘を対話的に記録し、全指摘が「対応済み」または「対応不要」になったら G3 PASS として承認フローに進む。

**G3 Section 2 チェックリスト:**

- [ ] 全画面の UIKit コンポーネントが選定されている（または「カスタム実装」として記録されている）
- [ ] レスポンシブレイアウトが定義されている（または「対応不要」として明記されている）
- [ ] アノテーション（コンポーネント名・Props・インポートパス）が付与されている

**対応 AC:** AC-E054-10, AC-E054-11, AC-E054-12, AC-E054-13

詳細手順は `references/step4-review.md` を参照して実行する。

## Step 5: ブリーフィング・完了

`references/briefing-spec.md` に従ってブリーフィングを実行する。

**重点項目:**

- 生成した設計ドキュメント数と対象 SCR-ID 一覧
- コンポーネント選定サマリー（UIKit 選定数・カスタム実装数）
- レスポンシブ対応サマリー（対応あり・対応不要）
- G3 レビューの指摘対応サマリー
- 後続スキルへの接続確認（`/aidd-decompose-epic` or `/aidd-next`）

詳細手順は `references/briefing-spec.md` を参照して実行する。

---

## 重要なルール

- **日本語で対話する** — フレームワーク全体の対話言語が日本語であるため
- **FRAMEWORK.md の意思決定基準に従う**
- **各ステップでユーザーの確認を得てから次に進む** — 自動的に全ステップを実行しない
- **ユーザーの明示的な承認なしに次ステップへ遷移しない** — 「OK」「進めて」「承認」等の明確な意思表示が必要
- **UIKit 未対応要素でエラー停止しない** — 「カスタム実装」として記録し続行する
- **catalog.json を必ず参照する** — コンポーネント候補は記憶や推測ではなく `@spikestudio/uikit/catalog.json` から取得する（ADR-012）
- **ブリーフィング省略禁止** — Step 4 完了時に `references/briefing-spec.md` に従ったブリーフィングを必ず実行する
- **各ステップの詳細手順は `references/` を読んで実行する** — SKILL.md 内に手順を複製しない
