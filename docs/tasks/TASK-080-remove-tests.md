# Task: [ES-029] Story 7 — remove.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #202 |
| Epic 仕様書 | ES-029 |
| Story | S7 |
| Complexity | S |
| PR | #195 |

## 責務

`remove.ts` の `runRemove` 関数に対するユニットテストを実装し、`instances.ts` / `fs` / `process` をモックすることで、インスタンス削除の各バリデーションパス（保護・未発見・実行中・正常・force削除）を外部依存なしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/remove.test.ts`（新規作成）
- `packages/jimmy/src/cli/remove.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-079（list.ts のテスト）: 一覧表示ロジックのテストは含まない
- TASK-081（nuke.ts のテスト）: 完全削除ロジックのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-42: `runRemove("gateway", {})` を呼び出すと `console.error` で保護エラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-43: `runRemove("nonexistent", {})` を呼び出すと `console.error` で未発見エラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-44: `runRemove("atlas", {})` を呼び出し PID ファイルが存在し `process.kill(pid, 0)` が成功するとき、`console.error` で実行中エラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-45: `runRemove("atlas", {})` を呼び出しバリデーションが全て通るとき、インスタンスがレジストリから削除され成功メッセージが `console.log` で出力されること
- [ ] AC-E029-46: `runRemove("atlas", { force: true })` を呼び出すとき、`fs.rmSync` でホームディレクトリが削除されること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | runRemove（保護・未発見・実行中・正常・force 各パス）| `vi.mock('../instances')`, `vi.mock('node:fs')`, `vi.spyOn(process, 'exit')`, `vi.spyOn(process, 'kill')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 7: remove.ts のテスト（AC-E029-42〜46）
- 参照コード: `packages/jimmy/src/cli/remove.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: TASK-074（instances.ts の理解のため参照）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-42〜46）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
