# TASK-002: TelegramConnector を grammy API に書き換え

| 項目 | 内容 |
|------|------|
| Epic | ES-001 |
| AC | AC-2 |
| 複雑度 | M |
| 依存 | TASK-001 |

## 作業内容

`packages/jimmy/src/connectors/telegram/index.ts` を grammy API に書き換える。

## 変更ファイル

- `packages/jimmy/src/connectors/telegram/index.ts`

## API マッピング

| 機能 | Before (node-telegram-bot-api) | After (grammy) |
|------|-------------------------------|----------------|
| import | `import TelegramBot from "node-telegram-bot-api"` | `import { Bot, type Context } from "grammy"` |
| インスタンス | `new TelegramBot(token, { polling: false })` | `new Bot(token)` |
| Bot 情報取得 | `await bot.getMe()` | `await bot.api.getMe()` |
| ポーリング開始 | `bot.startPolling()` | `bot.start()` (non-blocking) |
| ポーリング停止 | `await bot.stopPolling()` | `await bot.stop()` |
| メッセージ受信 | `bot.on("message", async (telegramMsg) => {...})` | `bot.on("message", async (ctx) => {...})` |
| メッセージ送信 | `await bot.sendMessage(chatId, text, opts)` | `await bot.api.sendMessage(chatId, text, opts)` |
| メッセージ編集 | `await bot.editMessageText(text, { chat_id, message_id, ... })` | `await bot.api.editMessageText(chatId, Number(msgId), text, opts)` |
| タイピング | `await bot.sendChatAction(chatId, "typing")` | `await bot.api.sendChatAction(chatId, "typing")` |

## メッセージハンドラの変更点

```typescript
// Before
bot.on("message", async (telegramMsg) => {
  if (telegramMsg.from?.is_bot) { ... }
  const userId = telegramMsg.from?.id;
  const sessionKey = deriveSessionKey(telegramMsg);
  // ...
  const msg: IncomingMessage = {
    raw: telegramMsg,
    // ...
  };
});

// After
bot.on("message", async (ctx) => {
  const telegramMsg = ctx.message;
  if (!telegramMsg) return;
  if (telegramMsg.from?.is_bot) { ... }
  const userId = telegramMsg.from?.id;
  const sessionKey = deriveSessionKey(telegramMsg);  // threads.ts の関数はそのまま使える
  // ...
  const msg: IncomingMessage = {
    raw: telegramMsg,
    // ...
  };
});
```

## エラーハンドリング

- `start()` 失敗の捕捉: grammy の `bot.start()` は non-blocking なため、`getMe()` で事前検証してから `bot.start()` を呼ぶパターンを維持する
- `bot.catch(handler)` で実行時エラーをログに記録する

## Acceptance Criteria

- [ ] `import` が `grammy` から行われている
- [ ] `TelegramBot` 型への参照がすべて除去されている
- [ ] `getMe()` → `start()` → `on("message")` のフローが grammy API で動作する
- [ ] `sendMessage` / `editMessageText` / `sendChatAction` が grammy API で呼び出される
- [ ] `pnpm typecheck` が clean

## 注意

- `threads.ts` の `TelegramMessageLike` インターフェースは grammy の `Message` 型と互換のはずだが、確認すること
- `safeSend` メソッドの `TelegramBot.SendMessageOptions` 型参照を grammy の型に置き換える
