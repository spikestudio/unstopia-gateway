# Task: [ES-029] Story 6 — list.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #201 |
| Epic 仕様書 | ES-029 |
| Story | S6 |
| Complexity | S |
| PR | #195 |

## 責務

`list.ts` の `runList` 関数に対するユニットテストを実装し、`instances.ts` / `fs` / `process.kill` をモックすることで、インスタンス一覧表示とプロセス生死確認ロジック（空・stopped・running・stale PID）の各パスを外部依存なしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/list.test.ts`（新規作成）
- `packages/jimmy/src/cli/list.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-074（instances.ts のテスト）: インスタンスレジストリ単体テストは含まない
- TASK-080（remove.ts のテスト）: インスタンス削除ロジックのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-38: `runList()` を呼び出しインスタンスが0件のとき、"No instances found" を含むメッセージが `console.log` で出力されること
- [ ] AC-E029-39: `runList()` を呼び出し PID ファイルが存在せず、インスタンスが1件あるとき、`stopped` 状態で一覧が `console.log` で出力されること
- [ ] AC-E029-40: `runList()` を呼び出し PID ファイルが存在し `process.kill(pid, 0)` が成功するとき、`running` 状態で一覧が出力されること
- [ ] AC-E029-41: `runList()` を呼び出し PID ファイルが存在し `process.kill(pid, 0)` が例外をスローするとき、`stopped` 状態で一覧が出力されること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | runList（空・stopped・running・stale PID 各パス）| `vi.mock('../instances')`, `vi.mock('node:fs')`, `vi.spyOn(process, 'kill')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 6: list.ts のテスト（AC-E029-38〜41）
- 参照コード: `packages/jimmy/src/cli/list.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: TASK-074（instances.ts の理解のため参照）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-38〜41）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
