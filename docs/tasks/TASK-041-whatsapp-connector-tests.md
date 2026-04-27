# Task: [ES-020] Story 20.5, 20.6 — WhatsAppConnector index.ts テスト追加

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #131 |
| Epic 仕様書 | ES-020 |
| Story | 20.5, 20.6 |
| Complexity | M |
| PR | #144 |

## 責務

@whiskeysockets/baileys の makeWASocket / useMultiFileAuthState をモック化し、WhatsAppConnector の JID フィルタリング・メッセージ型判定・送受信フロー・ヘルスチェックをユニットテストで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/connectors/whatsapp/__tests__/index.test.ts`（新規作成）

対象外（隣接 Task との境界）:

- TASK-039: DiscordConnector のテスト（別ファイル）
- TASK-040: SlackConnector のテスト（別ファイル）

## Epic から委ねられた詳細

- vi.mock を使って @whiskeysockets/baileys の makeWASocket / useMultiFileAuthState を完全モック化すること（実ネットワーク接続なし）
- 動的 import を用いた既存パターン（TelegramConnector の connector.test.ts）に準拠すること
- vi.mock は各テストファイルの先頭に配置すること
- connect() メソッドの完全モック化を推奨（未決定事項 #1 の解決: TelegramConnector パターンに倣い vi.mock で完全モック）
- biome-ignore コメントによる抑制禁止

## 完了条件

**機能面（AC-ID 参照）:**

- [x] **AC-E020-20**: グループ JID（`@g.us`）からのメッセージを送信すると handler が呼ばれない（グループフィルター）
- [x] **AC-E020-21**: `fromMe=true` で自分の JID 以外からのメッセージを送信すると handler が呼ばれない（自己送信フィルター）
- [x] **AC-E020-22**: allowFrom に含まれない JID からのメッセージを送信すると handler が呼ばれない
- [x] **AC-E020-23**: 正常なテキストメッセージを送信すると handler が正しい IncomingMessage 構造（source / sessionKey / channel / text 等）で呼ばれる
- [x] **AC-E020-24**: `getCapabilities` を呼ぶと threading=false / messageEdits=false / reactions=false / attachments=true が返る
- [x] **AC-E020-25**: `replyMessage` を呼ぶと `sock.sendMessage` が正しく呼ばれる
- [x] **AC-E020-26**: 接続前（`connectionStatus !== 'running'`）に `replyMessage` を呼ぶと `sock.sendMessage` が呼ばれずに処理が終わる
- [x] **AC-E020-27**: `getHealth` を呼ぶと connectionStatus に応じた status（running / qr_pending / stopped）が返る
- [x] **AC-E020-28**: `reconstructTarget` を replyContext で呼ぶと channel / messageTs が正しくマッピングされた Target が返る
- [x] Epic 仕様書の AC チェックボックス更新

### 品質面

- [x] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [x] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | WhatsAppConnector の JID フィルタリング・getCapabilities・replyMessage・getHealth・reconstructTarget | vi.mock("@whiskeysockets/baileys") で makeWASocket / useMultiFileAuthState をモック |
| ドメインロジックテスト | 該当なし | ドメインロジック変更なし |
| 統合テスト | 該当なし | 外部 SDK モック化のため不要 |
| E2E テスト | AC-E020-20〜28 | vitest ユニットテストで代替。実 WhatsApp 接続なし |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（設計ステップスキップ: 既存コードのテスト追加のみ） |
| サブドメイン種別 | 汎用 — 連携設計 + E2E 中心 |

- 参照 Epic 仕様書: ES-020 Story 20.5, 20.6
- 参照設計: `docs/requirements/ES-020-connector-index-tests.md` §Story 20.5, §Story 20.6, §未決定事項 #1
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/connectors/whatsapp/index.ts`（314 行・実装本体）
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
