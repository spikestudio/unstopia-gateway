# adhoc PR レビューチェックリスト

adhoc 作業（fix/hotfix/chore）の PR マージ前レビュー。種別に応じた観点でコードを確認し、`gate:reviewed` ラベルを付与する。

## 入力

| 項目 | 取得方法 |
|------|---------|
| PR 差分 | `gh pr diff <PR番号>` |
| 変更ファイル一覧 | `gh pr view <PR番号> --json files` |
| 規約ドキュメント | `docs/conventions/` |

## 種別ごとのチェック観点

### fix（バグ修正）

| 観点 | チェック内容 |
|------|------------|
| 修正の正確性 | 根本原因を修正しているか（対症療法ではないか） |
| 副作用 | 修正が他の機能・テストに影響していないか |
| テスト | リグレッションテストが追加されているか |
| ドキュメント整合 | 修正内容が仕様書・ADR と矛盾していないか |
| 規約準拠 | `skills/aidd-epic-review/references/check-code.md` に従って確認 |

### hotfix（緊急修正）

> **速度優先のため、ビジネス要件チェックとドキュメントチェックは省略する。**

| 観点 | チェック内容 |
|------|------------|
| 修正の最小性 | バグ修正以外の変更を含んでいないか |
| 副作用 | 修正が他の機能に影響していないか（特にリグレッション） |
| テスト | リグレッションテストが追加されているか |
| 規約準拠 | `skills/aidd-epic-review/references/check-code.md` の主要観点のみ確認 |

### chore（雑務）

| 観点 | チェック内容 |
|------|------------|
| スコープ最小性 | 雑務の範囲を超えた変更が含まれていないか |
| 副作用 | 既存機能への影響がないか（特に deps 更新時の破壊的変更） |
| テスト | 既存テストが全 PASS しているか |
| 規約準拠 | `skills/aidd-epic-review/references/check-code.md` に従って確認 |

## 問題発見時の処理

問題を発見した場合は `/aidd-epic-review/references/fix-flow.md` に従って修正し、再チェックする（最大 3 ラウンド）。

## 完了処理（gate ラベル付与）

チェックが全て PASS したら以下を実行する:

```bash
# gate:reviewed ラベルを付与
gh pr edit <PR番号> --add-label "gate:reviewed"

# PR コメントにレビュー完了を記録
gh pr comment <PR番号> --body "<!-- merge-guard:reviewed timestamp:$(date -u +%Y-%m-%dT%H:%M:%SZ) -->
## ✅ adhoc PR Review PASS

| 種別 | [fix/hotfix/chore] |
|------|-------------------|
| チェック観点 | [適用した観点] |
| 問題件数 | 0 件 |"
```

FAIL の場合は修正後に再チェックを実施する。
