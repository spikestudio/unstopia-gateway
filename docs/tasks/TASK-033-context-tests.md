# Task: [ES-018] Story 18.1 — context.ts buildContext テスト追加

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #119 |
| Epic 仕様書 | ES-018 |
| Story | 18.1 |
| Complexity | M |
| PR | #118 |

## 責務

`sessions/context.ts` の `buildContext` 関数に対するユニットテストを追加する。

## スコープ

対象ファイル:

- `packages/jimmy/src/sessions/__tests__/context.test.ts`（新規作成）

対象外（隣接 Task との境界）:

- TASK-034: engine-runner.ts のテストは対象外

## Epic から委ねられた詳細

- fs モジュールのモック方針: `vi.mock("node:fs")` で分離（tempdir 使用は不要）
- `buildOrgContext` は `fs.readdirSync` を呼ぶため、`vi.mock("node:fs")` で空リストを返すよう設定する
- `gateway/org` と `gateway/services` も `vi.mock` で分離する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E018-01: `buildContext` に employee なし・config なしの最小引数を渡すと `## Current session` セクションを含む文字列が返される
- [ ] AC-E018-02: `buildContext` に employee ありの引数を渡すと `# You are` で始まるアイデンティティセクションが含まれる
- [ ] AC-E018-03: `buildContext` に config.context.maxChars を小さい値（例: 100）で渡すと返却文字列が maxChars 以内に収まる
- [ ] AC-E018-04: `buildContext` に language が "English" 以外の config を渡すと「When following skill instructions」セクションが含まれる
- [ ] AC-E018-05: `buildContext` に channelName を渡すと `- Channel: #<channelName>` の形式で出力される
- [ ] AC-E018-06: `buildContext` に source="slack" かつ channel が "D" 始まりを渡すと「Direct Message」と出力される
- [ ] AC-E018-07: `buildContext` に thread を渡すと `- Thread: <thread>` が含まれる
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `buildContext` 関数（sessions/context.ts エクスポート関数） | vi.mock で fs / gateway/org / gateway/services を分離 |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 純粋関数テスト追加のみ | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | — （テスト追加のみ）|
| サブドメイン種別 | 支援（テスト追加、標準パターン）|

- 参照 Epic 仕様書: ES-018 Story 18.1 §受入基準
- 参照コード:
  - `packages/jimmy/src/sessions/context.ts`（825行・テスト対象）
  - `packages/jimmy/src/sessions/__tests__/engine-runner-utils.test.ts`（モック参考パターン）

## 依存

- 先行 Task: なし

## 引き渡し前チェック

- [x] 完了条件が全て検証可能な形で記述されている
- [x] 対応する Epic AC（AC-E018-01〜07）が特定され完了条件と対応づけられている
- [x] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [x] コンテキスト量が複雑度 M の目安に収まっている
- [x] 先行 Task は不要（独立実装可能）
- [x] Epic から委ねられた詳細（fsモック方針）が転記されている
