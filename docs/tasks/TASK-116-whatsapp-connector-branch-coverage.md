# Task: [ES-034] Story 3 — WhatsAppConnector 分岐カバレッジ向上（index.ts）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #248 |
| Epic 仕様書 | ES-034 |
| Story | 3 |
| Complexity | M |
| PR | #TBD |

## 責務

`WhatsAppConnector`（`packages/jimmy/src/connectors/whatsapp/index.ts`）の未カバー分岐（接続状態遷移・allowFrom フィルタ・メディア処理・stop）をユニットテストで網羅し、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/connectors/whatsapp/__tests__/index.test.ts`（既存ファイルに追記）

対象外（隣接 Task との境界）:

- TASK-112〜115: Discord/Slack のテストは別 Task
- TASK-117: TelegramConnector のテストは別 Task

## Epic から委ねられた詳細

- `@whiskeysockets/baileys` ライブラリをモック化すること（既存テストパターンを踏襲）
- `downloadMediaMessage` のモック粒度: 実際のバッファを返すモックで十分（実際のメディアダウンロードは不要）（Epic 未決定事項 #1）
- 接続状態遷移（starting → qr_pending → running → stopped）をイベントシミュレーションで検証すること
- `biome-ignore` コメントによる静的解析抑制は禁止

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E034-17**: `connection.update` イベントで QR コードが生成された場合に `connectionStatus` が `"qr_pending"` になり `latestQr` に QR データが格納される
- [ ] **AC-E034-18**: `connection.update` イベントで接続が閉じられた場合（loggedOut 以外）に `scheduleReconnect` が呼ばれ、再接続が試みられる
- [ ] **AC-E034-19**: `connection.update` イベントで loggedOut の場合に再接続が行われない
- [ ] **AC-E034-20**: `handleMessage` において、allowFrom が設定されている場合に許可リスト外の JID からのメッセージが無視される
- [ ] **AC-E034-21**: `handleMessage` において、画像・動画・音声・文書などのメディアメッセージがダウンロードされ `attachments` として IncomingMessage に含まれる
- [ ] **AC-E034-22**: `stop` が呼ばれた場合に `connectionStatus` が `"stopped"` になり、保留中の再接続タイマーがキャンセルされる
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | WhatsAppConnector の connection.update イベント（QR/切断/loggedOut 各分岐）・allowFrom フィルタ・メディアメッセージ処理・stop 時の再接続タイマーキャンセル | `vi.mock("@whiskeysockets/baileys")` でモック化。`downloadMediaMessage` は `vi.fn().mockResolvedValue(Buffer.from("..."))` |
| ドメインロジックテスト | 該当なし | ドメインロジック変更なし |
| 統合テスト | 該当なし | 外部 SDK モック化のため不要 |
| E2E テスト | AC-E034-17〜22 | vitest ユニットテストで代替。実 WhatsApp 接続なし |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（設計ステップスキップ: 既存コードのテスト追加のみ） |
| サブドメイン種別 | 汎用 — 連携設計 + E2E 中心 |

- 参照 Epic 仕様書: ES-034 §Story 3: WhatsApp コネクターのカバレッジ向上
- 参照設計: `docs/requirements/ES-034-connectors-test-coverage.md` §Story 3、§ステータス遷移（WhatsApp 接続状態遷移図）、§エラーケース（再接続タイマー中の stop / loggedOut）、§未決定事項 #1
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/connectors/whatsapp/index.ts`（315 行・実装本体）
  - `packages/jimmy/src/connectors/whatsapp/__tests__/index.test.ts`（462 行・既存テスト）

## 依存

- 先行 Task: なし（TASK-112〜115 と並行実装可能）

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
