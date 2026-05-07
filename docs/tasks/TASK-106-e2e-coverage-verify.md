# Task: [ES-032] E2E 検証 — src/gateway/api カバレッジ 90% 以上確認

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #234 |
| Epic 仕様書 | ES-032 |
| Story | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 |
| Complexity | S |
| PR | #226 |

## 責務

TASK-099〜105 完了後に `pnpm test --coverage` を実行し、全ファイルの branch カバレッジが 90% 以上であることを確認する。未達のファイルがある場合は補完テストを追加してカバレッジ基準を満たす。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/`（全テストファイル確認）
- カバレッジレポート（stdout）

対象外（隣接 Task との境界）:

- 実装コードの変更（テスト追加のみ）

## Epic から委ねられた詳細

- カバレッジ基準: 各対象ファイル（misc.ts / connectors.ts / org.ts / sessions.ts / cron.ts / utils.ts）で branch 90% 以上
- 全体 src/gateway/api 合計でも 90% 以上を達成すること
- api-types.ts は型定義ファイルのため、カバレッジ対象外（0% でも許容）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E032-01: `misc.ts` branch カバレッジ 90% 以上
- [ ] AC-E032-13: `connectors.ts` branch カバレッジ 90% 以上
- [ ] AC-E032-20: `org.ts` branch カバレッジ 90% 以上
- [ ] AC-E032-26: `sessions.ts` branch カバレッジ 90% 以上
- [ ] AC-E032-33: `cron.ts` branch カバレッジ 90% 以上
- [ ] AC-E032-36: `utils.ts` branch カバレッジ 90% 以上
- [ ] src/gateway/api 全体 branch カバレッジ 90% 以上
- [ ] Epic 仕様書の全 AC（AC-E032-01〜40）チェックボックス更新

### 品質面

- [ ] `pnpm test` が全テスト PASS している
- [ ] CI パイプラインがグリーン
- [ ] カバレッジレポートのスクリーンショット or 出力をコミットコメントに添付

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | 全テストファイルのパス確認 | |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | `pnpm test --coverage` でカバレッジ基準確認 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway/api（HTTP ルーティング層） |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-032 §E2E 検証計画
- カバレッジコマンド: `cd packages/jimmy && pnpm test --coverage 2>&1 | grep "src/gateway/api"`

**カバレッジ基準達成のための補完手順:**

1. `pnpm test --coverage` を実行
2. `src/gateway/api` 以下の各ファイルの branch カバレッジを確認
3. 90% 未達のファイルがある場合:
   - coverage report の `Uncovered Line #s` を参照
   - 対応する test ファイルに補完テストを追加
   - 再度 `pnpm test --coverage` で確認

## 依存

- 先行 Task: TASK-099, TASK-100, TASK-101, TASK-102, TASK-103, TASK-104, TASK-105

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] Epic から委ねられた詳細が転記されている
