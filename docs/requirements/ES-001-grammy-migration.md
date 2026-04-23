# ES-001: Telegram Connector を grammy へ移行

| 項目 | 内容 |
|------|------|
| ステータス | 定義済み |
| 作成日 | 2026-04-23 |
| 対応 Issue | #29 |
| 優先度 | 中（セキュリティ改善） |
| 独立 Epic | Phase 外の単発 Epic（chore スコープ） |

## 背景・動機

現在の Telegram Connector は `node-telegram-bot-api@0.67.0` を使用しており、同パッケージが依存する `request@2.88.2`（deprecated）経由で以下の脆弱性が残存している（PR #28 で修正不能と判定）。

| 深刻度 | CVE | パッケージ |
|-------|-----|-----------|
| moderate | GHSA-p8p7-x288-28g6 | request@2.88.2 |
| moderate | GHSA-72xf-g2v4-qvf3 | tough-cookie@2.5.0 |
| moderate | GHSA-w5hq-g745-h8pq | uuid@8.3.2 |

`grammy@1.x` は request 系依存を持たないため、移行により 3 件を根本解消できる。

## スコープ

### In scope

- `packages/jimmy/src/connectors/telegram/index.ts` の grammy 移行
- `packages/jimmy/package.json` の依存更新（`node-telegram-bot-api` → `grammy`）
- `connector.test.ts` の grammy 向け mock 更新
- `pnpm audit` で request chain 3 件の解消確認

### Out of scope

- `threads.ts` / `format.ts` の変更（Telegram Bot API 非依存のロジック）
- Telegram 以外の Connector（Slack / Discord / WhatsApp）
- 機能追加・動作変更

## Acceptance Criteria

### AC-1: 依存関係の置き換え

- `node-telegram-bot-api` が `packages/jimmy/package.json` の dependencies から除去されている
- `grammy@^1.0.0` が dependencies に追加されている
- `@types/node-telegram-bot-api` が devDependencies から除去されている
- `pnpm install` 後に `request@2.88.2` が Telegram 経路で参照されていない

### AC-2: 機能等価性

grammy 移行後も以下の動作が維持されている:

| 機能 | 旧 (node-telegram-bot-api) | 新 (grammy) |
|------|--------------------------|-------------|
| ポーリング起動 | `bot.startPolling()` | `bot.start()` |
| ポーリング停止 | `bot.stopPolling()` | `bot.stop()` |
| Bot 情報取得 | `bot.getMe()` | `bot.api.getMe()` |
| メッセージ受信 | `bot.on("message", handler)` | `bot.on("message", ctx => ...)` |
| メッセージ送信 | `bot.sendMessage(chatId, text, opts)` | `bot.api.sendMessage(chatId, text, opts)` |
| メッセージ編集 | `bot.editMessageText(text, opts)` | `bot.api.editMessageText(chatId, msgId, text, opts)` |
| タイピング送信 | `bot.sendChatAction(chatId, "typing")` | `bot.api.sendChatAction(chatId, "typing")` |

### AC-3: テスト通過

- 既存テスト（connector.test.ts）が grammy mock で全 PASS している
- `pnpm test` で 217 tests 以上が PASS している

### AC-4: セキュリティ改善確認

- `pnpm audit` の結果から `request`, `tough-cookie`, `uuid` (Telegram 経路) の advisory が消滅している
- `docs/research/security-exceptions.md` の該当 3 件を削除している

### AC-5: 型チェック・静的解析

- `pnpm typecheck` が clean
- `pnpm biome check` が 0 errors

## 実装方針

### grammy API マッピング

```typescript
// Before: node-telegram-bot-api
import TelegramBot from "node-telegram-bot-api";
const bot = new TelegramBot(token, { polling: false });
await bot.getMe();
bot.startPolling();
bot.on("message", async (msg) => { ... });
await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
await bot.editMessageText(text, { chat_id, message_id, parse_mode: "Markdown" });
await bot.sendChatAction(chatId, "typing");
await bot.stopPolling();

// After: grammy
import { Bot } from "grammy";
const bot = new Bot(token);
await bot.api.getMe();
bot.start();                    // non-blocking, use bot.start() with error handler
bot.on("message", async (ctx) => { ... });
await bot.api.sendMessage(chatId, text, { parse_mode: "Markdown" });
await bot.api.editMessageText(chatId, Number(messageId), text, { parse_mode: "Markdown" });
await bot.api.sendChatAction(chatId, "typing");
await bot.stop();
```

### 注意点

- grammy の `bot.start()` はイベントループをブロックしない（`await` 不要）
- エラーハンドリングは `bot.catch(handler)` で行う
- message handler の引数が `(msg: TelegramBot.Message)` → `(ctx: Context)` に変わる
  - `ctx.message` で元のメッセージオブジェクトにアクセス
  - `ctx.from` / `ctx.chat` は grammy が型安全に提供
- 既存の `TelegramMessageLike` インターフェース（threads.ts）は維持する

## Task 分解（実装時に `/aidd-decompose-epic` で詳細化）

| Task | 内容 |
|------|------|
| T-1 | grammy インストール・node-telegram-bot-api 削除 |
| T-2 | TelegramConnector を grammy API に書き換え |
| T-3 | connector.test.ts の mock を grammy 向けに更新 |
| T-4 | audit 確認・security-exceptions.md 更新 |

## 参考

- grammy 公式ドキュメント: https://grammy.dev
- grammy API リファレンス: https://grammy.dev/ref/core/Bot
- 現行実装: `packages/jimmy/src/connectors/telegram/index.ts`
- 脆弱性記録: `docs/research/security-exceptions.md`
