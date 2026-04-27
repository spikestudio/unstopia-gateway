<!-- 配置先: docs/requirements/ES-020-connector-index-tests.md -->
# ES-020: テスト拡充（connectors） — Discord/Slack/WhatsApp/CronConnector の index.ts テスト追加

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #127 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |
| Epic | E9（テスト拡充 connectors） |
| 所属 BC | — （設計ステップスキップ: 既存コードのテスト追加のみ） |
| ADR 参照 | — |

## 対応ストーリー

- S13: As a **開発者**, I want to `connectors/`（Discord / Slack / WhatsApp）のテストを追加したい, so that メッセージ送受信の主要フローが自動検証される.

## 概要

`packages/jimmy/src/connectors/` 配下の Discord・Slack・WhatsApp コネクターには
`index.ts`（Connector クラス本体）のユニットテストが存在しない。
このEpicでは外部 SDK（discord.js・@slack/bolt・@whiskeysockets/baileys）をモック化し、
インバウンド処理（フィルタリング・IncomingMessage 構築）・アウトバウンド処理（sendMessage・replyMessage 等）・
ヘルスチェックの主要パスをユニットテストで検証する。

## ストーリーと受入基準

### Story 20.1: Discord コネクター — インバウンド処理テスト（S13）

> As a **開発者**, I want to `connectors/discord/index.ts` の `handleMessage` を discord.js Client をモックしてテストしたい, so that bot フィルター・guild 制限・channel 制限・allowFrom フィルターが正しく動作することを自動検証できる.

**受入基準:**

- [x] **AC-E020-01**: 開発者が discord.js の Client をモックして bot メッセージを送信すると、handler が呼ばれない（bot フィルター）. ← S13
- [x] **AC-E020-02**: 開発者が allowFrom に含まれないユーザーからのメッセージを送信すると、handler が呼ばれない（allowFrom フィルター）. ← S13
- [x] **AC-E020-03**: 開発者が guild 制限のある Connector に別 guild からのメッセージを送信すると、handler が呼ばれない（guildId フィルター）. ← S13（AI 補完: guildId フィルターは重要なセキュリティ境界）
- [x] **AC-E020-04**: 開発者が channel 制限のある Connector に別チャンネルからのメッセージを送信すると、handler が呼ばれない（channelId フィルター）. ← S13（AI 補完: channelId フィルターも同様）
- [x] **AC-E020-05**: 開発者が正常なメッセージを送信すると、handler が正しい `IncomingMessage` 構造（connector / source / sessionKey / channel / user / text 等）で呼ばれる. ← S13

**インターフェース:** `packages/jimmy/src/connectors/discord/__tests__/connector.test.ts`（新規作成）

### Story 20.2: Discord コネクター — アウトバウンド処理テスト（S13）

> As a **開発者**, I want to `sendMessage` / `replyMessage` / `editMessage` / `addReaction` / `removeReaction` / `reconstructTarget` / `getHealth` をモックを使ってテストしたい, so that 送信系メソッドのエラーハンドリングと正常系を自動検証できる.

**受入基準:**

- [x] **AC-E020-06**: 開発者が `sendMessage` を呼ぶと、discord.js の `channel.send` が正しく呼ばれ、最後のメッセージ ID を返す. ← S13
- [x] **AC-E020-07**: 開発者が `sendMessage` でテキストチャンネルが取得できない場合、`undefined` が返り、エラーを throw しない. ← S13（AI 補完: エラーハンドリングはユーザー体験に直結）
- [x] **AC-E020-08**: 開発者が `getHealth` を呼ぶと、connector のステータス（running / stopped / error）と capabilities が返る. ← S13
- [x] **AC-E020-09**: 開発者が `reconstructTarget` を replyContext で呼ぶと、channel / thread / messageTs が正しくマッピングされた Target が返る. ← S13（AI 補完: reconstructTarget は ReplyContext → Target 変換の唯一の窓口）

**インターフェース:** `packages/jimmy/src/connectors/discord/__tests__/connector.test.ts`（新規作成）

### Story 20.3: Slack コネクター — インバウンド処理テスト（S13）

> As a **開発者**, I want to `connectors/slack/index.ts` の `SlackConnector` を @slack/bolt App をモックしてテストしたい, so that bot フィルター・allowFrom フィルター・reaction_added イベント処理が正しく動作することを自動検証できる.

**受入基準:**

- [x] **AC-E020-10**: 開発者が Slack の `message` イベントで `bot_id` が設定されたイベントを送信すると、handler が呼ばれない（bot フィルター）. ← S13
- [x] **AC-E020-11**: 開発者が `user` が未設定のイベント（URL unfurl 等）を送信すると、handler が呼ばれない（ghost event フィルター）. ← S13（AI 補完: Slack URL unfurl は既知の false positive パターン）
- [x] **AC-E020-12**: 開発者が allowFrom に含まれないユーザーからのメッセージを送信すると、handler が呼ばれない. ← S13
- [x] **AC-E020-13**: 開発者が正常なメッセージを送信すると、handler が正しい `IncomingMessage` 構造（source / sessionKey / channel / text 等）で呼ばれる. ← S13
- [x] **AC-E020-14**: 開発者が `reaction_added` イベントを送信すると、対象メッセージのテキストが取得されリアクション文脈のプロンプトで handler が呼ばれる. ← S13（AI 補完: reaction_added ハンドラーはコードの約1/3を占めるが未テスト）

**インターフェース:** `packages/jimmy/src/connectors/slack/__tests__/connector.test.ts`（新規作成）

### Story 20.4: Slack コネクター — アウトバウンド処理テスト（S13）

> As a **開発者**, I want to `SlackConnector` の `sendMessage` / `replyMessage` / `editMessage` / `addReaction` / `removeReaction` / `getHealth` / `reconstructTarget` をモックを使ってテストしたい, so that 送信系メソッドの正常系とエラーハンドリングを自動検証できる.

**受入基準:**

- [x] **AC-E020-15**: 開発者が `sendMessage` を呼ぶと、`chat.postMessage` が正しく呼ばれ最後の ts を返す. ← S13
- [x] **AC-E020-16**: 開発者が空文字で `sendMessage` を呼ぶと、`chat.postMessage` が呼ばれずに `undefined` を返す. ← S13（AI 補完: 空文字送信防止は Slack API の過剰呼び出し抑止）
- [x] **AC-E020-17**: 開発者が `replyMessage` を呼ぶと、`thread_ts` 付きで `chat.postMessage` が呼ばれる. ← S13
- [x] **AC-E020-18**: 開発者が `getHealth` を呼ぶと、started / error 状態が反映されたステータスを返す. ← S13
- [x] **AC-E020-19**: 開発者が `reconstructTarget` を replyContext で呼ぶと、channel / thread / messageTs が正しくマッピングされた Target が返る. ← S13（AI 補完: reconstructTarget はセッション継続の要）

**インターフェース:** `packages/jimmy/src/connectors/slack/__tests__/connector.test.ts`（新規作成）

### Story 20.5: WhatsApp コネクター — インバウンド処理テスト（S13）

> As a **開発者**, I want to `connectors/whatsapp/index.ts` の `WhatsAppConnector` を @whiskeysockets/baileys をモックしてテストしたい, so that JID フィルタリング・メッセージ型判定・IncomingMessage 構築が正しく動作することを自動検証できる.

**受入基準:**

- [x] **AC-E020-20**: 開発者がグループ JID（`@g.us`）からのメッセージを送信すると、handler が呼ばれない（グループフィルター）. ← S13（AI 補完: グループ通知を無視するのは WhatsApp コネクターの主要セキュリティ境界）
- [x] **AC-E020-21**: 開発者が `fromMe=true` で自分の JID 以外からのメッセージを送信すると、handler が呼ばれない（自己送信フィルター）. ← S13
- [x] **AC-E020-22**: 開発者が allowFrom に含まれない JID からのメッセージを送信すると、handler が呼ばれない. ← S13
- [x] **AC-E020-23**: 開発者が正常なテキストメッセージを送信すると、handler が正しい `IncomingMessage` 構造（source / sessionKey / channel / text 等）で呼ばれる. ← S13
- [x] **AC-E020-24**: 開発者が `getCapabilities` を呼ぶと、threading=false / messageEdits=false / reactions=false / attachments=true が返る. ← S13（AI 補完: WhatsApp は他コネクターと capability が異なるため明示的に検証）

**インターフェース:** `packages/jimmy/src/connectors/whatsapp/__tests__/connector.test.ts`（新規作成）

### Story 20.6: WhatsApp コネクター — アウトバウンド処理テスト（S13）

> As a **開発者**, I want to `WhatsAppConnector` の `replyMessage` / `getHealth` / `reconstructTarget` をモックを使ってテストしたい, so that 送信系メソッドと状態管理を自動検証できる.

**受入基準:**

- [x] **AC-E020-25**: 開発者が `replyMessage` を呼ぶと、`sock.sendMessage` が正しく呼ばれる. ← S13
- [x] **AC-E020-26**: 開発者が接続前（`connectionStatus !== 'running'`）に `replyMessage` を呼ぶと、`sock.sendMessage` が呼ばれずに処理が終わる. ← S13（AI 補完: 未接続時の防御は重要な安全境界）
- [x] **AC-E020-27**: 開発者が `getHealth` を呼ぶと、connectionStatus に応じた status（running / qr_pending / stopped）が返る. ← S13
- [x] **AC-E020-28**: 開発者が `reconstructTarget` を replyContext で呼ぶと、channel / messageTs が正しくマッピングされた Target が返る. ← S13

**インターフェース:** `packages/jimmy/src/connectors/whatsapp/__tests__/connector.test.ts`（新規作成）

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | — | 該当なし（既存コードのテスト追加のみ） |
| DB スキーマ骨格 | — | 該当なし |
| API spec 骨格 | — | 該当なし |

## バリデーションルール

該当なし（テスト追加 Epic のため）

## ステータス遷移（該当する場合）

該当なし

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| Discord sendMessage: チャンネル取得失敗 | `client.channels.fetch` が throw | `undefined` を返す。handler は throw しない | エラーを握り潰す（ログは出力）仕様を検証 |
| Slack reaction_added: メッセージ取得失敗 | `conversations.history` / `conversations.replies` が throw | handler が呼ばれない（早期 return） | リアクションイベントのメッセージが取得できない場合の仕様を検証 |
| WhatsApp replyMessage: 未接続 | `connectionStatus !== 'running'` | `sock.sendMessage` が呼ばれない | QR コードスキャン前など未接続状態での誤送信を防ぐ |

## 非機能要件

| 項目 | 基準 |
|------|------|
| テスト実行 | `pnpm test` で全テスト PASS すること |
| モック方針 | 外部 SDK（discord.js / @slack/bolt / baileys）を vi.mock でモック化し、実ネットワーク接続なしに実行できること |
| biome-ignore 禁止 | eslint-disable / biome-ignore 等の抑制コメントを使用しないこと |
| テスト粒度 | 各テストファイルは `vi.mock` を先頭に配置し、動的 import を用いた既存パターン（TelegramConnector の connector.test.ts）に準拠すること |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 開発者（このリポジトリをメンテナンスする人） |
| デリバリーする価値 | Discord / Slack / WhatsApp コネクターの index.ts が自動テストで保護され、将来のリファクタリング時にリグレッションを検知できる |
| デモシナリオ | `pnpm test` を実行すると connector の index.ts テストが 28 件以上 PASS し、branch カバレッジが向上する |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | 全 AC を vitest ユニットテストで自動検証。外部 SDK は vi.mock でモック化 |
| 検証環境 | ローカル + CI（GitHub Actions）。実 Discord / Slack / WhatsApp アカウント不要 |
| 前提条件 | `pnpm build && pnpm test` が PASS すること。biome ゼロ警告 |

## 他 Epic への依存・影響

- **依存**: ES-019（engines/claude 整理）— 完了済み。本 Epic に依存なし
- **影響**: Phase 2 のカバレッジ目標（40%以上）に貢献

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | WhatsApp の `connect()` メソッド（baileys の `useMultiFileAuthState` / `makeWASocket` 呼び出し）を完全モックするか部分モックにするか | 解決済み | vi.mock で完全モック採用（TelegramConnector パターンと同様） |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている（テスト Epic のため該当なし）
- [x] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（テスト Epic のため該当なし）
- [x] 関連 ADR が参照されている（該当なし）
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-E020-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [x] 所属 BC が記載されている（設計ステップスキップ: 既存コードのテスト追加のみ）
- [x] 設計成果物セクションが記入されている（該当なし）
