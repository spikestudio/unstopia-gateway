# Task: [ES-018] Story 18.1+18.2 — E2E 検証（全 PASS + カバレッジ 40% 確認）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #121 |
| Epic 仕様書 | ES-018 |
| Story | 18.1, 18.2 |
| Complexity | S |
| PR | #118 |

## 責務

TASK-033・TASK-034 完了後に `pnpm test --coverage` を実行し、全テスト PASS と branch カバレッジ 40% 以上を確認する。

## スコープ

対象ファイル:

- なし（新規ファイル作成なし・コード変更なし）

対象外（隣接 Task との境界）:

- TASK-033: context.ts テスト実装（完了後にこの Task を実施）
- TASK-034: engine-runner.ts テスト実装（完了後にこの Task を実施）

## Epic から委ねられた詳細

- 該当なし

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E018-11: `pnpm test` が全 PASS する
- [ ] AC-E018-12: 全体 branch カバレッジが 40% 以上になる
- [ ] Epic 仕様書の全 AC チェックボックスを更新

### 品質面

- [ ] `pnpm build` PASS
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS（biome 警告・エラーゼロ）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| E2E テスト | pnpm test --coverage | branch カバレッジ 40% を実測で確認 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC | — |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-018 §E2E 検証計画

## 依存

- 先行 Task: TASK-033, TASK-034

## 引き渡し前チェック

- [x] 完了条件が全て検証可能な形で記述されている（実測コマンド明記）
- [x] 先行 Task が完了していることを確認してから着手する
