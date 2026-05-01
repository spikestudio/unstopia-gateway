# Task: [ES-029] Story 13 — skills.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #208 |
| Epic 仕様書 | ES-029 |
| Story | S13 |
| Complexity | M |
| PR | #195 |

## 責務

`skills.ts` の全エクスポート関数（readManifest / writeManifest / upsertManifest / removeFromManifest / snapshotDirs / diffSnapshots / extractSkillName / findExistingSkill / skillsFind / skillsAdd / skillsRemove / skillsList / skillsUpdate / skillsRestore）に対するユニットテストを実装し、`fs` / `child_process` をモックすることで外部コマンド依存なしに動作を検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/skills.test.ts`（新規作成）
- `packages/jimmy/src/cli/skills.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-085（migrate.ts 追加テスト）: マイグレーションロジックのテストは含まない
- TASK-087（chrome-allow.ts のテスト）: Extension DB 操作のテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-67: `readManifest()` を呼び出し `SKILLS_JSON` が存在しないとき、空配列 `[]` を返すこと
- [ ] AC-E029-68: `readManifest()` を呼び出し不正な JSON を読んだとき、空配列 `[]` を返すこと
- [ ] AC-E029-69: `writeManifest(entries)` を呼び出すと `fs.writeFileSync` が JSON 文字列で呼ばれること
- [ ] AC-E029-70: `upsertManifest("foo", "owner/repo")` を呼び出し "foo" が存在しないとき、エントリが追加されること
- [ ] AC-E029-71: `upsertManifest("foo", "owner/repo")` を呼び出し "foo" が既に存在するとき、エントリが更新されること
- [ ] AC-E029-72: `removeFromManifest("foo")` を呼び出し存在するとき `true` を返しエントリが削除されること
- [ ] AC-E029-73: `removeFromManifest("nonexistent")` を呼び出すとき `false` を返すこと
- [ ] AC-E029-74: `extractSkillName("owner/repo@skill-name")` を呼び出すと `"skill-name"` を返すこと
- [ ] AC-E029-75: `extractSkillName("owner/repo")` を呼び出すと `"repo"` を返すこと
- [ ] AC-E029-76: `skillsRemove("foo")` を呼び出しスキールが存在するとき、`fs.rmSync` で削除され成功メッセージが出力されること
- [ ] AC-E029-77: `skillsRemove("nonexistent")` を呼び出すとき、`console.error` でエラーが出力されること
- [ ] AC-E029-78: `skillsList()` を呼び出しスキルが0件のとき、"No skills installed." が `console.log` で出力されること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | readManifest / writeManifest / upsertManifest / removeFromManifest / extractSkillName / skillsRemove / skillsList | `vi.mock('node:fs')`, `vi.mock('node:child_process')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 13: skills.ts のテスト（AC-E029-67〜78）
- 参照コード: `packages/jimmy/src/cli/skills.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: なし（独立実装可能）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-67〜78）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
