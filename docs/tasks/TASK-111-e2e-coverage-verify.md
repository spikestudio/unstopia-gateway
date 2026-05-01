# Task: [ES-033] E2E 検証 — src/gateway テストカバレッジ 90% 以上確認

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #241 |
| Epic 仕様書 | ES-033 |
| Story | 1.1, 1.2, 1.3, 1.4 |
| Complexity | S |
| PR | #TBD |

## 責務

TASK-107〜110 で追加した全テストが通過することを確認し、`src/gateway`（lifecycle.ts / files.ts / watcher.ts / budgets.ts / costs.ts）の branch カバレッジが 90% 以上に達していることをカバレッジレポートで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/lifecycle.ts`（カバレッジ対象）
- `packages/jimmy/src/gateway/files.ts`（カバレッジ対象）
- `packages/jimmy/src/gateway/watcher.ts`（カバレッジ対象）
- `packages/jimmy/src/gateway/budgets.ts`（カバレッジ対象）
- `packages/jimmy/src/gateway/costs.ts`（カバレッジ対象）

対象外（隣接 Task との境界）:

- テストコードの新規追加: TASK-107〜110 が担当。本 Task では新規テスト作成は行わない
- `server.ts`（0%）: 依存が深く統合テストが必要なため本 Epic スコープ外（AC に含まれない）

## Epic から委ねられた詳細

- カバレッジ計測コマンド: `pnpm test -- --coverage --reporter=verbose` をパッケージルートで実行する
- カバレッジレポートの確認先: `packages/jimmy/coverage/` または stdout の Branch coverage 行を確認する
- 未カバーブランチが残存する場合: 対象 Task（TASK-107〜110）に戻って追加テストを実装する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E033-01: `lifecycle.ts` の branch カバレッジが 90% 以上
- [ ] AC-E033-09: `files.ts` の branch カバレッジが 90% 以上
- [ ] AC-E033-20: `watcher.ts` の branch カバレッジが 90% 以上
- [ ] AC-E033-26: `budgets.ts` の branch カバレッジが 90% 以上
- [ ] AC-E033-27: `costs.ts` の branch カバレッジが 90% 以上
- [ ] `src/gateway` 全体の branch カバレッジが 90% 以上
- [ ] Epic 仕様書の全 AC チェックボックス更新（AC-E033-01〜30）

### 品質面

- [ ] 全テストが通過している（`pnpm test` がグリーン）
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | 全 Task のテストが通過していること | TASK-107〜110 の成果物 |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | `pnpm test -- --coverage` で `src/gateway` 各ファイルのカバレッジを確認 | coverage レポートで branch % を確認 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway（HTTP サーバー・ライフサイクル管理層） |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-033 §E2E 検証計画
- 参照コード: `packages/jimmy/src/gateway/`（全対象ファイル）

**検証コマンド:**

```bash
cd packages/jimmy
pnpm test -- --coverage 2>&1 | grep -A 5 "src/gateway/lifecycle\|src/gateway/files\|src/gateway/watcher\|src/gateway/budgets\|src/gateway/costs"
```

## 依存

- 先行 Task: TASK-107, TASK-108, TASK-109, TASK-110（全実装 Task）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
