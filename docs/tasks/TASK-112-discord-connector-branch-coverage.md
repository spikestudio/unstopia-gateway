# Task: [ES-034] Story 1 — DiscordConnector 分岐カバレッジ向上（index.ts）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #244 |
| Epic 仕様書 | ES-034 |
| Story | 1 |
| Complexity | M |
| PR | #TBD |

## 責務

`DiscordConnector`（`packages/jimmy/src/connectors/discord/index.ts`）の未カバー分岐をユニットテストで網羅し、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/connectors/discord/__tests__/index.test.ts`（既存ファイルに追記）

対象外（隣接 Task との境界）:

- TASK-113: `RemoteDiscordConnector`（`remote.ts`）のテスト追加は別 Task
- TASK-114: SlackConnector のテストは別 Task
- TASK-116: WhatsAppConnector のテストは別 Task
- TASK-117: TelegramConnector のテストは別 Task

## Epic から委ねられた詳細

- `vi.mock` で `discord.js` の Client をモック化すること（既存パターンを踏襲）
- `biome-ignore` コメントによる静的解析抑制は禁止
- 既存テスト（ES-020 で追加済み）との重複テストケースは追加しない

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E034-01**: `handleMessage` において `channelRouting` が指定された場合に `proxyToRemote` が呼ばれ、メッセージがリモートに転送される
- [ ] **AC-E034-02**: `handleMessage` において guildId フィルタが設定されている場合に、異なるギルドのメッセージが無視される
- [ ] **AC-E034-03**: `handleMessage` において channelId フィルタが設定されている場合に、指定外チャンネルのメッセージが無視される（ただし DM は常に許可）
- [ ] **AC-E034-04**: `replyMessage` が、thread が指定されている場合はスレッドチャンネルに、指定なしの場合は通常チャンネルに送信する
- [ ] **AC-E034-05**: `editMessage` が、messageTs がない場合は何もせず返る
- [ ] **AC-E034-06**: `addReaction`/`removeReaction` が、messageTs がない場合は何もせず返る
- [ ] **AC-E034-07**: `setTypingStatus` が、既存の typing interval をクリアしてから新しい interval を設定する
- [ ] **AC-E034-08**: `start` において、client error イベントが発火した場合に status が "error" になる
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | DiscordConnector の channelRouting 転送・guildId/channelId フィルタ・DM 許可・replyMessage スレッド分岐・editMessage/addReaction/removeReaction の messageTs なし・setTypingStatus interval・start error イベント | vi.mock("discord.js") で Client をモック化 |
| ドメインロジックテスト | 該当なし | ドメインロジック変更なし |
| 統合テスト | 該当なし | 外部 SDK モック化のため不要 |
| E2E テスト | AC-E034-01〜08 | vitest ユニットテストで代替。実 Discord 接続なし |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（設計ステップスキップ: 既存コードのテスト追加のみ） |
| サブドメイン種別 | 汎用 — 連携設計 + E2E 中心 |

- 参照 Epic 仕様書: ES-034 §Story 1: Discord コネクターのカバレッジ向上
- 参照設計: `docs/requirements/ES-034-connectors-test-coverage.md` §Story 1
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/connectors/discord/index.ts`（343 行・実装本体）
  - `packages/jimmy/src/connectors/discord/__tests__/index.test.ts`（506 行・既存テスト・ES-020 で作成済み）
  - `packages/jimmy/src/connectors/telegram/__tests__/connector.test.ts`（モックパターン参考）

## 依存

- 先行 Task: なし（独立して実装可能）

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
