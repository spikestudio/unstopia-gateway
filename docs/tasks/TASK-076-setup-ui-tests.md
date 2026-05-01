# Task: [ES-029] Story 3 — setup-ui.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #198 |
| Epic 仕様書 | ES-029 |
| Story | S3 |
| Complexity | S |
| PR | #195 |

## 責務

`setup-ui.ts` の全エクスポート関数（ok / warn / fail / info / prompt）に対するユニットテストを実装し、`console.log` / `readline` をモックすることで外部 I/O 依存なしに動作を検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/setup-ui.test.ts`（新規作成）
- `packages/jimmy/src/cli/setup-ui.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-075（setup-fs.ts のテスト）: ファイルシステム操作ユーティリティのテストは含まない
- TASK-077（setup-context.ts のテスト）: コンテキスト検出ロジックのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-23: `ok("message")` を呼び出すと `console.log` がグリーン `[ok]` プレフィックス付きのメッセージで呼ばれること
- [ ] AC-E029-24: `warn("message")` を呼び出すと `console.log` がイエロー `[warn]` プレフィックス付きのメッセージで呼ばれること
- [ ] AC-E029-25: `fail("message")` を呼び出すと `console.log` がレッド `[missing]` プレフィックス付きのメッセージで呼ばれること
- [ ] AC-E029-26: `info("message")` を呼び出すと `console.log` が DIM スタイルのメッセージで呼ばれること
- [ ] AC-E029-27: `prompt("question", "default")` を呼び出すと `readline.createInterface` が作成され、ユーザーが Enter を押した場合（空入力）デフォルト値を返すこと
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | ok / warn / fail / info / prompt | `vi.spyOn(console, 'log')`, `vi.mock('node:readline')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 3: setup-ui.ts のテスト（AC-E029-23〜27）
- 参照コード: `packages/jimmy/src/cli/setup-ui.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: なし（独立実装可能）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-23〜27）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
