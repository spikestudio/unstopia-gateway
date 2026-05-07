# Task: [ES-029] Story 12 — migrate.ts 追加テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #207 |
| Epic 仕様書 | ES-029 |
| Story | S12 |
| Complexity | M |
| PR | #195 |

## 責務

`migrate.ts` の既存テスト（`migrate.test.ts`）が未カバーのブランチ（check フラグ・auto マイグレーション・複数バージョン・up-to-date）に対する追加テストを実装する。既存テストファイルへの追記として実装する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/migrate.test.ts`（既存ファイルへ追記）
- `packages/jimmy/src/cli/migrate.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- 既存テスト（migrate.test.ts の現行テスト）: 既存のテストケースを削除・変更しない
- TASK-086（skills.ts のテスト）: スキル管理ロジックのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-63: `runMigrate({ check: true })` を呼び出し pending マイグレーションが存在するとき、`execFileSync` が呼ばれず "Run jinn migrate" を含むメッセージが `console.log` で出力されること
- [ ] AC-E029-64: `runMigrate({})` を呼び出し pending マイグレーションが0件のとき、バージョンスタンプが更新され "Up to date" または "No migration scripts" のメッセージが `console.log` で出力されること
- [ ] AC-E029-65: `runMigrate({ auto: true })` を呼び出すと `execFileSync` が呼ばれず auto マイグレーションが実行されること
- [ ] AC-E029-66: `runMigrate({})` を呼び出し `compareSemver` が 0 以上を返すとき（既に最新）、"Up to date." が `console.log` で出力されること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している（既存テストも引き続き通過していること）
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | runMigrate（check・auto・up-to-date・no-scripts 各パス）| 既存 `migrate.test.ts` の末尾に追記。モックパターンは既存ファイルに合わせる |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 12: migrate.ts 追加テスト（AC-E029-63〜66）
- 参照コード: `packages/jimmy/src/cli/migrate.ts`
- 参照テスト: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（既存ファイルに追記するため必ず全文読むこと）

## 依存

- 先行 Task: なし（既存 migrate.test.ts が存在するため独立実装可能）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-63〜66）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
