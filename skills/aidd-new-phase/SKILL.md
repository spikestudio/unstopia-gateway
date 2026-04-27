---
name: aidd-new-phase
description: >
  実現したい機能意図の一覧を入力として、Phase 定義書（機能意図一覧・Epic マッピング・Won't Have の3セクション）を生成する。
  2ステップ（機能意図列挙→Epic マッピング）で素早く完了する。30分以内が目標。
  ユーザーが新しい Phase を定義したい場合は常にこのスキルを呼び出す。
type: skill
context: fork
argument-hint: "<Phase名>"
---

# /aidd-new-phase — Phase 定義（機能意図起点・軽量版）

> ⚠️ **Phase 12 で軽量化（ADR-013）。** 旧フォーマット（16セクション・4ステップ）から3セクション・2ステップに変更。ストーリー定義・ドメイン分析は `/aidd-new-epic` で行う。

実現したい機能意図（やりたいことの一覧）を入力として、「機能意図一覧 + Epic マッピング + Won't Have」の3セクション構成の Phase 定義書を30分以内で生成する。

> **このスキルの目的は「このマイルストーンで何を実現するか（機能一覧）と、どの Epic に割り付けるか（Epic マッピング）を素早く合意する」こと。** 詳細な要件定義は `/aidd-new-epic` で行う。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| プロジェクト初期化済み | GitHub リポジトリの設定確認（Labels 等） | `/aidd-setup project` を先に実行 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| Phase 名 | 引数 | 任意 | 指定なしならユーザーに聞く |
| 機能意図 | 対話入力 | 必須 | 「〇〇できる」「〇〇を改善したい」の粒度で箇条書き |

### capability 呼び出し

| capability | Step | 引数 |
|-----------|------|------|
| （なし） | — | — |

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| Phase 定義書 | ファイル | `docs/requirements/PD-NNN-slug.md`（3セクション構成） |
| GitHub Phase 定義書 Issue | GitHub | chore ラベル、Milestone 紐付け |
| GitHub Milestone | GitHub | `Phase N: [Phase名]` |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-new-epic` | Phase 承認後（各 Epic のストーリー+AC を定義） |

## Step 0: 入力受付・セットアップ

`$ARGUMENTS` から Phase 名を取得する。指定がなければユーザーに聞く。

1. Phase 名が未指定の場合はユーザーに聞く
2. `docs/requirements/PD-*.md` をスキャンして次の番号を決定
3. [gitflow ガイド](../../aidd-framework/guides/gitflow.md)に従い、`docs/PD-NNN-slug` ブランチを作成する（ユーザーの明示的な承認を得てから実行）
4. GitHub Milestone `Phase N: [Phase名]` を作成
5. GitHub Phase 定義書 Issue を作成する

   ```bash
   gh issue create \
     --title "docs: PD-NNN [Phase名] Phase定義書" \
     --label "chore" \
     --milestone "Phase N: [Phase名]" \
     --body "Phase 定義書（docs/requirements/PD-NNN-slug.md）の作成"
   ```

6. `references/phase-definition-template.md` をコピーして `docs/requirements/PD-NNN-slug.md` を作成

## Step 1: 機能意図列挙 + Epic マッピング

### 1-1. 機能意図の収集

ユーザーに「このPhaseで実現したい機能・改善を箇条書きで教えてください」と聞く。

**入力例:**

```
- ユーザーが広告枠を登録できる
- 配信レポートを確認できる
- 管理者がユーザーを管理できる
- 通知を送れる
```

受け取った機能意図をそのまま Phase 定義書の「実現したいこと」セクションに記載する。
**AI によるストーリー補完は行わない**（Epic で定義する）。

### 1-2. Epic マッピング

機能意図を Epic に割り付ける対話を行う。

1. AI が機能意図を分析し、Epic 分割案を提示する（「〇〇機能」「△△機能」等の粒度）
2. ユーザーが確認・修正する
3. 各 Epic に MUST / WON'T の優先度を設定する

**【必須】1 Epic = 1 機能の原則（#1040）:**

Epic の粒度は「1つの明確な機能単位」でなければならない。複数機能を1 Epic に束ねることを禁止する。

| 判定 | 例 |
|------|-----|
| ✅ OK | E1: `/aidd-inception-mock` スキル新設 |
| ✅ OK | E2: `/aidd-inception-api-spec` スキル新設 |
| ❌ NG | E1: 「Inception スキル群新設」（5スキルを1 Epicに詰め込み） |

Epic 分割案を提示する際は必ずこの原則でセルフチェックを行う。**複数機能が1 Epic に混入している場合は分割してから提示する。ユーザーへの確認不要（自動分割）。**

**提示フォーマット:**

```
機能意図から以下の Epic 構成を提案します:

| # | Epic 名 | 対応する機能意図 | 優先度 |
|---|---------|---------------|--------|
| E1 | ユーザー管理 Epic | ・ユーザーが広告枠を登録できる | MUST |
| E2 | レポート Epic | ・配信レポートを確認できる | MUST |
| E3 | 通知 Epic | ・通知を送れる | MUST |

Won't Have（このPhaseではやらない）:
- [候補があれば提示]

この構成でよいですか？
```

### 1-3. Won't Have の確認

「このPhaseでは意図的に対応しないことはありますか？」と聞き、Won't Have を記録する。

### 1-4. Phase 定義書への書き出し

確定した内容を `docs/requirements/PD-NNN-slug.md` に書き出す。

ユーザーの明示的な承認を得てからファイルに書き込む。

## 完了処理

ユーザーの承認後、以下を順に実行する:

**1. Phase 定義書のステータスを「承認済み」に更新してコミット:**

```bash
git add docs/requirements/PD-NNN-slug.md
git commit -m "docs: PD-NNN Phase定義書作成"
git push -u origin docs/PD-NNN-slug
```

**2. PR を作成:**

`.github/PULL_REQUEST_TEMPLATE.md` を Read し、各セクションを埋めた body で PR を作成する。

```bash
gh pr create --title "docs: PD-NNN [Phase名] Phase定義書" --body "[テンプレートを読み込んで生成した body]"
```

**3. G1 通過を PR にコメントして記録:**

```bash
gh pr comment <PR番号> --body "✅ G1 通過 ($(date '+%Y-%m-%d'))

Phase 定義書が承認されました。Epic 定義に進んでください。"
```

**4. Gate ラベル付与・CI 待機・マージ:**

```bash
gh pr edit <PR番号> --add-label "gate:reviewed"
gh pr checks <PR番号> --watch
gh pr merge <PR番号> --squash --delete-branch
```

**完了メッセージ:**

```
Phase 定義書が完成しました:
- ドキュメント: docs/requirements/PD-NNN-slug.md（ステータス: 承認済み）
- GitHub Milestone: Phase N: [Phase名]（G1 通過記録済み）
- Epic 数: N 件

次のステップ:
→ `/aidd-new-epic [Epic1名]` で最初の Epic を定義
```

## ゲート制御ルール

1. **Step 0 の承認なしに Step 1 を開始してはならない**（ブランチ名・Phase 番号の確認）
2. **Step 1-4 の機能意図・Epic マッピングはユーザーの承認を得てから確定する**
3. **回答 ≠ 承認。** 次ステップへの遷移には「OK」「進めて」「承認」等の明確な意思表示が必要

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う**
- **ストーリー補完を行わない** — 詳細な要件定義は `/aidd-new-epic` に委譲する
- **30分以内を目標とする** — 機能意図の列挙と Epic マッピングのみで完了する
- **ユーザーの明示的な承認なしに次ステップへ遷移しない**
- 成果物生成・実装完了時にコミットを自動実行する。push と PR 作成はユーザーの確認を待つ
