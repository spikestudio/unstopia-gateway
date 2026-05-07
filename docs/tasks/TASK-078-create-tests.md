# Task: [ES-029] Story 5 — create.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #200 |
| Epic 仕様書 | ES-029 |
| Story | S5 |
| Complexity | M |
| PR | #195 |

## 責務

`create.ts` の `runCreate` 関数に対するユニットテストを実装し、`instances.ts` / `fs` / `child_process` / `process.exit` をモックすることで、インスタンス作成の各バリデーションパス（名前不正・予約名・重複・ホームディレクトリ衝突・正常系）を外部コマンド実行なしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/create.test.ts`（新規作成）
- `packages/jimmy/src/cli/create.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-074（instances.ts のテスト）: インスタンスレジストリ単体テストは含まない
- TASK-079（list.ts のテスト）: 一覧表示ロジックのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-33: `runCreate("INVALID")` を呼び出すと `console.error` で名前バリデーションエラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-34: `runCreate("gateway")` を呼び出すと `console.error` で "gateway" 予約名エラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-35: `runCreate("existing")` を呼び出し同名インスタンスが存在するとき、`console.error` で重複エラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-36: `runCreate("atlas")` を呼び出し `fs.existsSync(home)` が `true` を返すとき、`console.error` でホームディレクトリ重複エラーが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-37: `runCreate("atlas")` を呼び出しバリデーションが全て通るとき、`execFileSync` で setup が呼ばれ、インスタンスがレジストリに保存され、成功メッセージが `console.log` で出力されること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | runCreate（バリデーション各パス）| `vi.mock('../instances')`, `vi.mock('node:fs')`, `vi.mock('node:child_process')`, `vi.spyOn(process, 'exit')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 5: create.ts のテスト（AC-E029-33〜37）
- 参照コード: `packages/jimmy/src/cli/create.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: TASK-074（instances.ts の理解のため参照）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-33〜37）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
