# Task: [ES-032] Story 1.1 — misc.ts Goals / Costs / Budgets API テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #228 |
| Epic 仕様書 | ES-032 |
| Story | 1.1 |
| Complexity | M |
| PR | #226 |

## 責務

`src/gateway/api/misc.ts` の Goals（CRUD + tree）/ Costs（summary / by-employee）/ Budgets（CRUD + override + events）の各 HTTP ハンドラーに対するユニットテストを追加する。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/misc.test.ts`（TASK-099 で作成済みのファイルを拡張）
- `packages/jimmy/src/gateway/api/misc.ts`（読み取りのみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-099: status / instances / config / logs / activity / onboarding のテスト（先行 Task）

## Epic から委ねられた詳細

- Goals / Costs / Budgets はいずれも動的 import（`await import("../goals.js")` 等）を使用しているため、`vi.doMock` または `vi.mock` を使ってモックする
- `initDb` はモック化し、実際の DB 接続は行わない
- `GET /api/costs/summary` の `period` クエリパラメータ検証：`day` / `week` / `month` の 3 値以外は `month` にフォールバックする分岐をテストする

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E032-10: `GET /api/goals` / `POST /api/goals` / `GET /api/goals/:id` / `PUT /api/goals/:id` / `DELETE /api/goals/:id` / `GET /api/goals/tree` が正常系・異常系でそれぞれ期待する HTTP ステータスとレスポンスを返すことが検証される
- [ ] AC-E032-11: `GET /api/costs/summary` / `GET /api/costs/by-employee` が `period` クエリパラメータ（day / week / month）を正しく処理することが検証される
- [ ] AC-E032-12: `GET /api/budgets` / `PUT /api/budgets` / `POST /api/budgets/:employee/override` / `GET /api/budgets/events` が正常系で期待するレスポンスを返すことが検証される
- [ ] AC-E032-01: `misc.ts` の branch カバレッジが 90% 以上に達する（TASK-099 + 本 Task の合計）
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E032-01〜12 を [x] にする）

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | handleMiscRequest の Goals / Costs / Budgets ルート分岐 | 動的 import はすべてモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: HTTP ハンドラーの単体テストのみ。E2E は TASK-106 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway/api（HTTP ルーティング層） |
| サブドメイン種別 | 支援 — 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-032 §Story 1.1 AC-E032-10〜12
- 参照コード: `packages/jimmy/src/gateway/api/misc.ts` §GET /api/goals〜
- 参照コード: `packages/jimmy/src/gateway/api/__tests__/misc.test.ts`（TASK-099 で作成）

**動的 import のモック方法:**

vitest では `vi.mock('../goals.js', () => ({ listGoals: vi.fn(), ... }))` をファイル先頭で宣言する。

## 依存

- 先行 Task: TASK-099（misc.test.ts の基本構造が存在すること）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] Epic から委ねられた詳細が転記されている
