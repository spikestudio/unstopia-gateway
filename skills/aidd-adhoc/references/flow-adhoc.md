# adhoc 統合フロー（fix / hotfix / chore 共通）

種別（fix / hotfix / chore）に関わらず同一のフルスペックで実施する。
緊急度や規模の違いはフロー内の各ステップの深度で調整する。

## フロー

```
Issue 作成 → ブランチ作成（確認ゲート） → [EnterPlanMode] → 調査・方針策定
  → [ExitPlanMode: 方針承認] → 実装 → セルフレビュー → 実行時検証
  → ドキュメント更新確認 → PR 作成 → PR レビュー → マージ後 Issue クローズ
```

## ステップ詳細

### 1. Issue 作成

種別に応じたラベルと内容で Issue を作成する:

```bash
# fix
gh issue create \
  --title "fix: [バグの概要]" \
  --label "task,fix" \
  --body "## バグの概要\n[概要]\n\n## 再現手順\n[手順]\n\n## 期待動作\n[期待]\n\n## 実際の動作\n[実際]"

# hotfix
gh issue create \
  --title "hotfix: [バグの概要]" \
  --label "task,hotfix" \
  --body "## 緊急度\n[高/中]\n\n## 影響範囲\n[影響を受けるユーザー/機能]\n\n## バグの概要\n[概要]\n\n## 再現手順\n[手順]"

# chore
gh issue create \
  --title "chore: [作業の概要]" \
  --label "chore" \
  --body "## 作業内容\n[概要]"
```

### 2. ブランチ作成（確認ゲート必須）

Issue 作成後、以下の確認をユーザーに行ってから実行する（#907）:

```
新規ブランチを作成しようとしています:
  ブランチ名: <種別>/<ISSUE-NNN-slug>
  起点: main
  理由: <Issue タイトル>

作成してよいですか？
```

承認後に実行する:

```bash
git checkout -b <種別>/ISSUE-NNN-slug main
gh issue edit <Issue番号> --add-label "status:in-progress"
```

### 3. 計画フェーズ開始（EnterPlanMode）

ブランチ作成後、実装開始前に `EnterPlanMode` を呼び出す。
計画フェーズ中はファイル書き込み・シェル実行が抑止され、調査と方針策定に集中できる。

### 4. 調査・方針策定

作業内容に応じて以下を実施する:

| 種別 | 調査内容 |
|------|---------|
| fix / hotfix | エラーログ・スタックトレース確認、関連コード読み込み、再現条件特定、影響範囲把握 |
| chore | 変更対象の現状確認、変更範囲の特定、副作用のリスク洗い出し |

調査結果をもとに実装方針を策定する:

- 対象ファイルと変更概要
- 完了条件（fix/hotfix はバグが再現しないこと + テスト）
- テスト方針

### 5. 方針承認（ExitPlanMode）

`ExitPlanMode` を呼び出し、以下を提示してユーザーの承認を得る:

- 調査結果（原因または変更理由）
- 実装方針（対象ファイル・変更概要）
- テスト計画

承認後に実装フェーズへ進む。

### 6. 実装

fix / hotfix の場合は**テストファーストで実装する**:

1. バグの再現条件をテストケース化（失敗することを確認）
2. 修正コードを実装してテストを通す
3. 既存テストの通過確認

chore の場合も**変更が既存機能に影響する場合はテストを追加する**（後付けは漏れの原因）。

### 7. セルフレビュー

セルフレビュー反復ループを実施する（`aidd-framework/references/self-review-loop.md` 参照）。

| 観点 | チェック |
|------|---------|
| 正確性 | 意図した変更のみが含まれているか（過剰実装・スコープ逸脱がないか） |
| 影響範囲 | 変更が他の機能に副作用を与えていないか |
| テスト | 変更に対応するテストが追加されているか |
| 規約 | 規約に準拠しているか |
| suppress | lint suppress が追加されていないか |

### 8. 実行時検証

セルフレビュー完了後、**ローカル環境で**変更内容に応じた実行時検証を実施する（ローカルファースト原則: `aidd-framework/guides/local-verification.md`）。

`skills/aidd-epic-review/references/check-code.md` の「7. 実行時検証」セクションに従い、変更ファイルのパターンから Tier を判定して対応する検証を実施する。検証が失敗した場合は PR を作成せず、失敗内容を解消してから再検証する。

### 9. ドキュメント更新確認

スキルに同梱の `references/scan-docs.sh` を実行し、変更内容と照合して更新が必要なドキュメントを特定・更新・コミットする。

```bash
bash "${SKILL_DIR}/references/scan-docs.sh"
```

> `SKILL_DIR` = スキル起動時に "Base directory for this skill:" として提供されるパス。

スキャン結果を確認し、更新が必要なドキュメントがあれば修正してコミットする。

### 10. PR 作成

`.github/PULL_REQUEST_TEMPLATE.md` を Read し、各セクションを埋めた body で PR を作成する:

```bash
git push -u origin <種別>/ISSUE-NNN-slug
gh pr create --title "<種別>: [概要]" --body "[テンプレートを読み込んで生成した body]"
```

### 11. PR レビュー（必須）

`references/review-checklist.md` を読み込んでレビューを実行する。

PASS 後に以下を実行し、ユーザーに merge の指示を求める:

```bash
gh pr edit <PR番号> --add-label "gate:reviewed"
gh issue edit <Issue番号> --remove-label "status:in-progress"
```

### 12. マージ後の Issue クローズ

ユーザーから「merge」の指示を受けてマージした後、関連 Issue が残っている場合は明示的にクローズする（#918）:

```bash
gh issue close <Issue番号> --comment "PR #<PR番号> でマージ済み。"
```

`Related #N` で参照した Issue は PR マージで自動クローズされないため必ず手動でクローズする。

## 成果物

| 成果物 | 必須 |
|--------|------|
| GitHub Issue | 必須 |
| Task 定義 | 任意（調査結果を Issue コメントに記載する形でも可） |
| 実装コード | 必須 |
| テスト | fix/hotfix: 必須。chore: 影響がある場合は必須 |
| PR | 必須 |

## 注意事項

- 作業が大規模になった場合（10 ファイル超 or 200 行超の変更）、Epic 化を検討する
- hotfix は速度が命だが、最小限の修正に徹すること。リファクタリングや改善は含めない
- hotfix 後、根本原因の深掘りが必要な場合は別途 fix Issue を作成する
