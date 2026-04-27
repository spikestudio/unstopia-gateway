# Task: [ES-019] Story 19.1+19.2 — E2E 検証（pnpm build && pnpm test 全 PASS）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #126 |
| Epic 仕様書 | ES-019 |
| Story | 19.1, 19.2 |
| Complexity | S |
| PR | #TBD |

## 責務

TASK-036・TASK-037 完了後に `pnpm build && pnpm test` を実行し、全テスト PASS と既存ストリーミング動作の維持（リグレッションなし）を確認する。Epic 仕様書の全 AC チェックボックスを更新して Epic を完了させる。

## スコープ

対象ファイル:

- なし（新規ファイル作成なし・コード変更なし）
- Epic 仕様書 `docs/requirements/ES-019-claude-streaming-state-machine.md`（AC チェックボックス更新）

対象外（隣接 Task との境界）:

- TASK-036: `ClaudeStreamProcessor` クラス実装（完了後にこの Task を実施）
- TASK-037: 単体テスト追加（完了後にこの Task を実施）

## Epic から委ねられた詳細

- 該当なし

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E019-04: 開発者が `pnpm build && pnpm test` を実行すると、全テストが PASS し、既存のストリーミング動作が維持されている（リグレッションなし）
- [ ] Epic 仕様書の全 AC チェックボックスを更新（AC-E019-01〜10）

### 品質面

- [ ] `pnpm build` PASS
- [ ] `pnpm test` 全 PASS（既存63件 + TASK-037 追加分）
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS（biome 警告・エラーゼロ）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| E2E テスト | AC-E019-04 | `pnpm build && pnpm test` で全 PASS を実測確認 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC | — |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-019 §E2E 検証計画

## 依存

- 先行 Task: TASK-036, TASK-037

## 引き渡し前チェック

- [x] 完了条件が全て検証可能な形で記述されている（実測コマンド明記）
- [x] 先行 Task が完了していることを確認してから着手する
