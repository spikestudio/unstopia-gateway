# Task: [ES-020] Story 20.1, 20.2 — DiscordConnector index.ts テスト追加

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #129 |
| Epic 仕様書 | ES-020 |
| Story | 20.1, 20.2 |
| Complexity | M |
| PR | #144 |

## 責務

discord.js Client をモック化し、DiscordConnector のフィルタリング・送受信フロー・ヘルスチェックをユニットテストで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/connectors/discord/__tests__/index.test.ts`（新規作成）

対象外（隣接 Task との境界）:

- TASK-040: SlackConnector のテスト（別ファイル）
- TASK-041: WhatsAppConnector のテスト（別ファイル）

## Epic から委ねられた詳細

- vi.mock を使って discord.js の Client コンストラクタを完全モック化すること（実ネットワーク接続なし）
- 動的 import を用いた既存パターン（TelegramConnector の connector.test.ts）に準拠すること
- vi.mock は各テストファイルの先頭に配置すること
- biome-ignore コメントによる抑制禁止

## 完了条件

**機能面（AC-ID 参照）:**

- [x] **AC-E020-01**: bot メッセージを送信すると handler が呼ばれない（bot フィルター）
- [x] **AC-E020-02**: allowFrom に含まれないユーザーからのメッセージを送信すると handler が呼ばれない（allowFrom フィルター）
- [x] **AC-E020-03**: guild 制限のある Connector に別 guild からのメッセージを送信すると handler が呼ばれない（guildId フィルター）
- [x] **AC-E020-04**: channel 制限のある Connector に別チャンネルからのメッセージを送信すると handler が呼ばれない（channelId フィルター）
- [x] **AC-E020-05**: 正常なメッセージを送信すると handler が正しい IncomingMessage 構造で呼ばれる
- [x] **AC-E020-06**: `sendMessage` を呼ぶと discord.js の `channel.send` が正しく呼ばれ、最後のメッセージ ID を返す
- [x] **AC-E020-07**: `sendMessage` でテキストチャンネルが取得できない場合、`undefined` が返りエラーを throw しない
- [x] **AC-E020-08**: `getHealth` を呼ぶと connector のステータス（running / stopped / error）と capabilities が返る
- [x] **AC-E020-09**: `reconstructTarget` を replyContext で呼ぶと、channel / thread / messageTs が正しくマッピングされた Target が返る
- [x] Epic 仕様書の AC チェックボックス更新

### 品質面

- [x] ユニットテスト/統合テストが追加・通過している
- [x] コードレビューが承認されている
- [x] CI パイプラインがグリーン
- [x] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | DiscordConnector のフィルタリング・アウトバウンドメソッド・getHealth・reconstructTarget | vi.mock("discord.js") で Client コンストラクタをモック |
| ドメインロジックテスト | 該当なし | ドメインロジック変更なし |
| 統合テスト | 該当なし | 外部 SDK モック化のため不要 |
| E2E テスト | AC-E020-01〜09 | vitest ユニットテストで代替。実 Discord 接続なし |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（設計ステップスキップ: 既存コードのテスト追加のみ） |
| サブドメイン種別 | 汎用 — 連携設計 + E2E 中心 |

- 参照 Epic 仕様書: ES-020 Story 20.1, 20.2
- 参照設計: `docs/requirements/ES-020-connector-index-tests.md` §Story 20.1, §Story 20.2
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/connectors/discord/index.ts`（343 行・実装本体）
  - `packages/jimmy/src/connectors/telegram/__tests__/connector.test.ts`（モックパターン参考）

## 依存

- 先行 Task: なし（独立して実装可能）

## 引き渡し前チェック

- [x] 完了条件が全て検証可能な形で記述されている
- [x] 対応する Epic AC（E2E シナリオ）が特定され、完了条件と対応づけられている
- [x] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [x] 参照設計にセクション番号/名（§）が記載されている
- [x] コンテキスト量が複雑度レベルの目安に収まっている
- [x] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [x] 先行 Task が完了しコードがマージ済みである
- [x] ドキュメントに書かれていない暗黙の要件がない
- [x] Epic から委ねられた詳細が転記されている（該当なしを含む）
