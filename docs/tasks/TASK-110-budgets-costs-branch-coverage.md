# Task: [ES-033] Story 1.4 — budgets.ts / costs.ts 未カバーブランチ補完

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #240 |
| Epic 仕様書 | ES-033 |
| Story | 1.4 |
| Complexity | S |
| PR | #TBD |

## 責務

`budgets.ts` の `warning` / `paused` ステータス分岐と `costs.ts` の `getCostsByEmployee("week")` 未カバーブランチにテストを追加し、両ファイルの branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/__tests__/budgets.test.ts`（既存ファイルに追記）
- `packages/jimmy/src/gateway/__tests__/costs.test.ts`（既存ファイルに追記）
- `packages/jimmy/src/gateway/budgets.ts`（読み取りのみ、変更なし・61 行）
- `packages/jimmy/src/gateway/costs.ts`（読み取りのみ、変更なし・71 行）

対象外（隣接 Task との境界）:

- lifecycle.ts / files.ts / watcher.ts のテスト: TASK-107〜109 が担当
- 既存テストのカバー済みパス（`ok` ステータス / `getCostsByEmployee("month")` / `getCostSummary` の全 period）は変更しない

## Epic から委ねられた詳細

- `getBudgetStatus()` で `percent >= 100` の `paused` 分岐（AC-E033-28）: 実際の DB セッションを挿入せず、`db.prepare(...).get()` の戻り値をモックして `spend > limit` の状態を再現する。現在の `budgets.test.ts` は `GATEWAY_HOME` を tmpdir に向けた実 SQLite を使用しているため、セッションを INSERT するか、`initDb` をモックするかを選択する
- `getBudgetStatus()` で `percent >= 80 && percent < 100` の `warning` 分岐（AC-E033-29）: 同様に spend = limit * 0.85 相当の状態でテストする
- `getCostsByEmployee("week")` の cutoff（AC-E033-30）: `week` ブランチは `d.setDate(d.getDate() - 7)` を使うため `period: "week"` を引数として渡すだけで分岐はカバーされる

**推奨アプローチ（budgets.test.ts）:**

既存テストは実 SQLite を使用しているため、セッション INSERT + `getBudgetStatus` 呼び出しの方が実 DB モックより整合性が高い。`sessions` テーブルに直接 INSERT してから `getBudgetStatus` を呼ぶ方法を推奨する:

```typescript
import { initDb } from "../../sessions/registry.js";
// sessions テーブルに spend = limit * 1.1 相当のセッションを INSERT
const db = initDb();
db.prepare(`INSERT INTO sessions (id, employee, created_at, total_cost) VALUES (?, ?, ?, ?)`).run(...);
```

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E033-26: `budgets.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E033-27: `costs.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E033-28: `getBudgetStatus()` で `percent >= 100` の場合に `status: "paused"` を返す
- [ ] AC-E033-29: `getBudgetStatus()` で `percent >= 80 && percent < 100` の場合に `status: "warning"` を返す
- [ ] AC-E033-30: `getCostsByEmployee()` で `period: "week"` を指定した場合に正しい cutoff 日付で集計される
- [ ] Epic 仕様書の AC-E033-26〜30 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `getBudgetStatus` の `warning` / `paused` 分岐 / `getCostsByEmployee("week")` の cutoff 計算 | 実 SQLite（tmpdir）または `initDb` モックで spend を制御 |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: DB 関数の単体テスト。E2E は TASK-111 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway（HTTP サーバー・ライフサイクル管理層） |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-033 §Story 1.4 AC-E033-26〜30
- 参照コード: `packages/jimmy/src/gateway/budgets.ts` §getBudgetStatus（29〜31 行目: paused/warning/ok 分岐）
- 参照コード: `packages/jimmy/src/gateway/costs.ts` §getCostsByEmployee（50〜71 行目: week/month 分岐）
- 参照コード: `packages/jimmy/src/gateway/__tests__/budgets.test.ts`（既存テスト・GATEWAY_HOME 設定方法）
- 参照コード: `packages/jimmy/src/gateway/__tests__/costs.test.ts`（既存テスト）

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
