# Task: [ES-029] Story 2 — setup-fs.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #197 |
| Epic 仕様書 | ES-029 |
| Story | S2 |
| Complexity | M |
| PR | #195 |

## 責務

`setup-fs.ts` の全エクスポート関数（whichBin / runVersion / ensureDir / ensureFile / applyTemplateReplacements / copyTemplateDir）に対するユニットテストを実装し、`fs` / `child_process` をモックすることで外部ファイルシステム依存なしに動作を検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/setup-fs.test.ts`（新規作成）
- `packages/jimmy/src/cli/setup-fs.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-074（instances.ts のテスト）: インスタンスレジストリ操作は含まない
- TASK-076（setup-ui.ts のテスト）: UI 表示ユーティリティのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-11: `whichBin("claude")` を呼び出し `execSync` が成功するとき、トリムされたパス文字列を返すこと
- [ ] AC-E029-12: `whichBin("claude")` を呼び出し `execSync` が例外をスローするとき、`null` を返すこと
- [ ] AC-E029-13: `runVersion("claude")` を呼び出し `execSync` が成功するとき、トリムされたバージョン文字列を返すこと
- [ ] AC-E029-14: `runVersion("claude")` を呼び出し `execSync` が例外をスローするとき、`null` を返すこと
- [ ] AC-E029-15: `ensureDir(dir)` を呼び出し `fs.existsSync` が `true` を返すとき、`false` を返し `fs.mkdirSync` が呼ばれないこと
- [ ] AC-E029-16: `ensureDir(dir)` を呼び出し `fs.existsSync` が `false` を返すとき、`true` を返し `fs.mkdirSync` が呼ばれること
- [ ] AC-E029-17: `ensureFile(filePath, content)` を呼び出し `fs.existsSync` が `true` を返すとき、`false` を返し `fs.writeFileSync` が呼ばれないこと
- [ ] AC-E029-18: `ensureFile(filePath, content)` を呼び出し `fs.existsSync` が `false` を返すとき、`true` を返し `fs.mkdirSync` と `fs.writeFileSync` が呼ばれること
- [ ] AC-E029-19: `applyTemplateReplacements("hello {{name}}", {"{{name}}": "world"})` を呼び出すと `"hello world"` を返すこと
- [ ] AC-E029-20: `copyTemplateDir(srcDir, destDir)` を呼び出し src が存在しないとき、空配列 `[]` を返すこと
- [ ] AC-E029-21: `copyTemplateDir(srcDir, destDir)` を呼び出し src にファイルが存在し dest に対応ファイルがないとき、コピーされた相対パスの配列を返すこと
- [ ] AC-E029-22: `copyTemplateDir` は `.gitkeep` ファイルをスキップすること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | whichBin / runVersion / ensureDir / ensureFile / applyTemplateReplacements / copyTemplateDir | `vi.mock('node:fs')`, `vi.mock('node:child_process')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 2: setup-fs.ts のテスト（AC-E029-11〜22）
- 参照コード: `packages/jimmy/src/cli/setup-fs.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: なし（独立実装可能）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-11〜22）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
