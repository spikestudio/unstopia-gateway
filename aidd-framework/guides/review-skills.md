# レビュースキル: /aidd-review 統合ガイド

## 概要

すべてのレビューは `/aidd-review [--type 種別] [対象ID]` から実行する。
コンテキストを自動検出し、最適な種別を選択する。

## 5 種別

| 種別 | コマンド | タイミング | ゲート |
|------|---------|----------|--------|
| **epic-spec** | `/aidd-review --type epic-spec` | `/aidd-new-epic`（G2）完了後 | — |
| **task-spec** | `/aidd-review --type task-spec` | `/aidd-decompose-epic`（G4）完了後 | — |
| **code** | `/aidd-review --type code` | `/aidd-impl` 完了後（PR あり・Task 実装中） | — |
| **epic** | `/aidd-review --type epic` | 全 Task 完了後（G5 前） | G5（gate:reviewed） |
| **phase** | `/aidd-review --type phase` | Phase 全 Epic 完了後（G6 前） | G6 前提 |

## コンテキスト自動検出

引数なしで実行すると、ブランチ・Issue 状態から種別を自動推定しユーザーに確認する:

```bash
/aidd-review        # 自動検出
/aidd-review --type epic ES-072  # 明示指定
```

## サブエージェント並列設計

各種別で観点ごとのサブエージェントを並列起動し、全件を critical/non-critical に分類する。
HIGH SIGNAL フィルタリングは行わず、全問題を 1 件ずつユーザーと合意・修正する。

| 種別 | サブエージェント数 | モデル |
|------|---------------|--------|
| code | 4（規約・バグ・セキュリティ・負債） | Sonnet×2 / Opus×2 |
| epic | 3（ビジネス・ドキュメント・コード） | Sonnet×2 / Opus×1 |
| phase | 3（成功基準・ドキュメント・非機能）| Sonnet×2 / Opus×1 |
| epic-spec | 3（AC品質・トレーサビリティ・設計整合） | Sonnet×2 / Opus×1 |
| task-spec | 3（カバレッジ・スコープ・実装可能性） | Sonnet×2 / Opus×1 |

## Phase 完了処理

`/aidd-review phase` PASS 後、`/aidd-phase-closing` を実行して G6 通過記録・Milestone クローズ・レトロスペクティブを行う。

## 廃止されたスキル

以下のスキルは廃止され、`/aidd-review` に統合された。

| 旧スキル | 移植先 |
|---------|--------|
| `/aidd-impl-review` | `/aidd-review code` |
| `/aidd-epic-review` | `/aidd-review epic` |
| `/aidd-phase-review` | `/aidd-review phase`（レビュー）+ `/aidd-phase-closing`（完了処理） |
