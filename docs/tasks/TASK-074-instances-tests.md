# Task: [ES-029] Story 1 — instances.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #196 |
| Epic 仕様書 | ES-029 |
| Story | S1 |
| Complexity | M |
| PR | #195 |

## 責務

`instances.ts` の全エクスポート関数（loadInstances / saveInstances / nextAvailablePort / ensureDefaultInstance / findInstance）に対するユニットテストを実装し、`fs` モジュールをモックすることで外部ファイルシステム依存なしに動作を検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/instances.test.ts`（新規作成）
- `packages/jimmy/src/cli/instances.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-075（setup-fs.ts のテスト）: ファイルシステムユーティリティのテストは含まない
- TASK-078（create.ts のテスト）: instances.ts を利用する上位モジュールのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-01: `loadInstances()` を呼び出し `fs.existsSync` が `false` を返すとき、空配列 `[]` を返すこと
- [ ] AC-E029-02: `loadInstances()` を呼び出し `fs.readFileSync` が有効な JSON 配列を返すとき、パースされた `Instance[]` を返すこと
- [ ] AC-E029-03: `loadInstances()` を呼び出し `fs.readFileSync` が不正な JSON を返すとき、空配列 `[]` を返すこと
- [ ] AC-E029-04: `saveInstances(instances)` を呼び出すと `fs.mkdirSync` と `fs.writeFileSync` が適切な引数で呼ばれること
- [ ] AC-E029-05: `nextAvailablePort([])` を呼び出すと `7777` を返すこと
- [ ] AC-E029-06: `nextAvailablePort([{port: 7777, ...}])` を呼び出すと `7778` を返すこと
- [ ] AC-E029-07: `ensureDefaultInstance()` を呼び出し既に "jinn" インスタンスが存在するとき、`saveInstances` が呼ばれないこと
- [ ] AC-E029-08: `ensureDefaultInstance()` を呼び出し "jinn" が存在しないとき、"jinn" インスタンスを先頭に追加して `saveInstances` が呼ばれること
- [ ] AC-E029-09: `findInstance("jinn")` を呼び出し該当するインスタンスが存在するとき、そのインスタンスオブジェクトを返すこと
- [ ] AC-E029-10: `findInstance("nonexistent")` を呼び出したとき、`undefined` を返すこと
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | loadInstances / saveInstances / nextAvailablePort / ensureDefaultInstance / findInstance | `vi.mock('node:fs')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 1: instances.ts のテスト（AC-E029-01〜10）
- 参照コード: `packages/jimmy/src/cli/instances.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: なし（独立実装可能）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-01〜10）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
