# Task: [ES-029] Story 8 — nuke.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #203 |
| Epic 仕様書 | ES-029 |
| Story | S8 |
| Complexity | M |
| PR | #195 |

## 責務

`nuke.ts` の `runNuke` 関数に対するユニットテストを実装し、`instances.ts` / `fs` / `readline` / `process` をモックすることで、完全削除操作の各パス（空リスト・保護・未発見・確認一致・確認不一致）を外部依存なしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/nuke.test.ts`（新規作成）
- `packages/jimmy/src/cli/nuke.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-080（remove.ts のテスト）: 個別削除ロジックのテストは含まない
- TASK-082（start.ts のテスト）: Gateway 起動ロジックのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-47: `runNuke()` を呼び出し削除可能なインスタンスが0件のとき、"No removable instances" を含むメッセージが `console.log` で出力されること
- [ ] AC-E029-48: `runNuke("gateway")` を呼び出すと `console.error` で保護エラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-49: `runNuke("nonexistent")` を呼び出すと `console.error` で未発見エラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-50: `runNuke("atlas")` を呼び出し `readline` モックで確認文字列が一致するとき、インスタンスがレジストリから削除され `fs.rmSync` で削除されること
- [ ] AC-E029-51: `runNuke("atlas")` を呼び出し `readline` モックで確認文字列が不一致のとき、"Aborted" メッセージが `console.log` で出力され削除が行われないこと
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | runNuke（空・保護・未発見・確認一致・確認不一致 各パス）| `vi.mock('../instances')`, `vi.mock('node:fs')`, `vi.mock('node:readline')`, `vi.spyOn(process, 'exit')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 8: nuke.ts のテスト（AC-E029-47〜51）
- 参照コード: `packages/jimmy/src/cli/nuke.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（readline モックパターン参照）

## 依存

- 先行 Task: TASK-074（instances.ts の理解のため参照）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-47〜51）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
