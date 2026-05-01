# Task: [ES-034] Story 4 — TelegramConnector 分岐カバレッジ向上（index.ts）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #249 |
| Epic 仕様書 | ES-034 |
| Story | 4 |
| Complexity | S |
| PR | #TBD |

## 責務

`TelegramConnector`（`packages/jimmy/src/connectors/telegram/index.ts`）の未カバー分岐（テキストなしメッセージの caption 処理・添付ファイル処理・setTypingStatus）をユニットテストで網羅し、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/connectors/telegram/__tests__/connector.test.ts`（既存ファイルに追記）

対象外（隣接 Task との境界）:

- TASK-112〜116: Discord/Slack/WhatsApp のテストは別 Task
- TASK-117 は telegram/index.ts のみに集中する

## Epic から委ねられた詳細

- `node-telegram-bot-api` をモック化すること（既存テストパターンを踏襲）
- photo/document のメッセージオブジェクト構造を `node-telegram-bot-api` の型定義に沿って構築すること
- `biome-ignore` コメントによる静的解析抑制は禁止

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E034-23**: `handleMessage` において、テキストなし（photo/document のみ）のメッセージが caption を text として処理される
- [ ] **AC-E034-24**: `handleMessage` において、添付ファイル（photo/document）が `attachments` フィールドに正しく格納される
- [ ] **AC-E034-25**: `setTypingStatus` が、Telegram の `sendChatAction` API を呼び出して typing 状態を送信する
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | TelegramConnector の テキストなしメッセージ（photo/document + caption）・attachments フィールドへの格納・setTypingStatus の sendChatAction 呼び出し | `vi.mock("node-telegram-bot-api")` でモック化 |
| ドメインロジックテスト | 該当なし | ドメインロジック変更なし |
| 統合テスト | 該当なし | 外部 SDK モック化のため不要 |
| E2E テスト | AC-E034-23〜25 | vitest ユニットテストで代替。実 Telegram 接続なし |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（設計ステップスキップ: 既存コードのテスト追加のみ） |
| サブドメイン種別 | 汎用 — 連携設計 + E2E 中心 |

- 参照 Epic 仕様書: ES-034 §Story 4: Telegram コネクターの残り分岐カバレッジ向上
- 参照設計: `docs/requirements/ES-034-connectors-test-coverage.md` §Story 4
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/connectors/telegram/index.ts`（235 行・実装本体）
  - `packages/jimmy/src/connectors/telegram/__tests__/connector.test.ts`（379 行・既存テスト）

## 依存

- 先行 Task: なし（TASK-112〜116 と並行実装可能）

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
