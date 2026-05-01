# Task: [ES-034] Story 2 — SlackConnector 分岐カバレッジ向上（index.ts）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #246 |
| Epic 仕様書 | ES-034 |
| Story | 2 |
| Complexity | S |
| PR | #TBD |

## 責務

`SlackConnector`（`packages/jimmy/src/connectors/slack/index.ts`）の未カバー分岐（addReaction/removeReaction の messageTs なし・例外ハンドリング・setTypingStatus）をユニットテストで網羅し、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/connectors/slack/__tests__/index.test.ts`（既存ファイルに追記）

対象外（隣接 Task との境界）:

- TASK-115: `slack/format.ts` のテストは別 Task
- TASK-112: DiscordConnector のテストは別 Task

## Epic から委ねられた詳細

- `@slack/bolt` の App をモック化すること（既存テストパターンを踏襲）
- `setTypingStatus` の実装を確認し、Slack Bolt がネイティブ typing API を持たない場合は AC-E034-14 を実装に合わせて調整すること（Epic 未決定事項 #2）
- `biome-ignore` コメントによる静的解析抑制は禁止

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E034-12**: `addReaction`/`removeReaction` が、messageTs がない場合は何もせず返る
- [ ] **AC-E034-13**: `addReaction`/`removeReaction` が、API 呼び出しで例外が発生した場合に警告ログを出力して処理を続行する
- [ ] **AC-E034-14**: `setTypingStatus` が、Slack API（`chat.scheduleMessage` または typing API）を通じて typing 状態を設定する（実装確認後に調整可）
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | SlackConnector の addReaction/removeReaction messageTs なし分岐・例外ハンドリング・setTypingStatus | `vi.mock("@slack/bolt")` で App をモック化 |
| ドメインロジックテスト | 該当なし | ドメインロジック変更なし |
| 統合テスト | 該当なし | 外部 SDK モック化のため不要 |
| E2E テスト | AC-E034-12〜14 | vitest ユニットテストで代替。実 Slack 接続なし |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（設計ステップスキップ: 既存コードのテスト追加のみ） |
| サブドメイン種別 | 汎用 — 連携設計 + E2E 中心 |

- 参照 Epic 仕様書: ES-034 §Story 2: Slack コネクターのカバレッジ向上
- 参照設計: `docs/requirements/ES-034-connectors-test-coverage.md` §Story 2、§エラーケース（Slack: reaction API エラー）、§未決定事項 #2
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/connectors/slack/index.ts`（411 行・実装本体）
  - `packages/jimmy/src/connectors/slack/__tests__/index.test.ts`（563 行・既存テスト）

## 依存

- 先行 Task: なし（TASK-112, TASK-113 と並行実装可能）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（E2E シナリオ）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なしを含む）
