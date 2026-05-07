# Task: [ES-029] Story 9 — start.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #204 |
| Epic 仕様書 | ES-029 |
| Story | S9 |
| Complexity | S |
| PR | #195 |

## 責務

`start.ts` の `runStart` 関数に対するユニットテストを実装し、`instances.ts` / `fs` / `process` / `startDaemon` / `startForeground` をモックすることで、Gateway 起動の各パス（未setup・マイグレーション警告・daemon・foreground）を外部コマンド実行なしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/start.test.ts`（新規作成）
- `packages/jimmy/src/cli/start.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-083（stop.ts のテスト）: Gateway 停止ロジックのテストは含まない
- TASK-084（status.ts のテスト）: Gateway ステータス表示のテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-52: `runStart({})` を呼び出し `GATEWAY_HOME` が存在しないとき、エラーメッセージが `console.error` で出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-53: `runStart({})` を呼び出し `compareSemver` が負値を返すとき（instance version が古い）、マイグレーション警告が `console.log` で出力されること
- [ ] AC-E029-54: `runStart({ daemon: true })` を呼び出すと `startDaemon` が呼ばれ "Gateway started in background." が `console.log` で出力されること
- [ ] AC-E029-55: `runStart({})` を呼び出すと `startForeground` が呼ばれること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | runStart（未setup・マイグレーション警告・daemon・foreground 各パス）| `vi.mock('../instances')`, `vi.mock('node:fs')`, `vi.spyOn(process, 'exit')` でモック。startDaemon / startForeground もモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 9: start.ts のテスト（AC-E029-52〜55）
- 参照コード: `packages/jimmy/src/cli/start.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: TASK-074（instances.ts の理解のため参照）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-52〜55）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
