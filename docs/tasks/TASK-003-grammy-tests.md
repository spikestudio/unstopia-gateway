# TASK-003: connector.test.ts を grammy mock に更新

| 項目 | 内容 |
|------|------|
| Epic | ES-001 |
| AC | AC-3 |
| 複雑度 | M |
| 依存 | TASK-002 |

## 作業内容

`packages/jimmy/src/connectors/telegram/__tests__/connector.test.ts` の mock を grammy 向けに書き換える。

## 変更ファイル

- `packages/jimmy/src/connectors/telegram/__tests__/connector.test.ts`

## Mock 書き換え方針

### Before (node-telegram-bot-api mock)

```typescript
vi.mock("node-telegram-bot-api", () => {
  const MockBot = vi.fn(function (this: Record<string, unknown>) {
    this.sendMessage = mockSendMessage;
    this.editMessageText = mockEditMessageText;
    this.getMe = mockGetMe;
    this.startPolling = mockStartPolling;
    this.stopPolling = mockStopPolling;
    this.on = mockOn;
  });
  return { default: MockBot };
});
```

### After (grammy mock)

```typescript
const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 1 });
const mockEditMessageText = vi.fn().mockResolvedValue(true);
const mockGetMe = vi.fn().mockResolvedValue({ id: 999, username: "test_bot" });
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockSendChatAction = vi.fn().mockResolvedValue(true);

vi.mock("grammy", () => {
  const MockBot = vi.fn(function (this: Record<string, unknown>) {
    this.api = {
      sendMessage: mockSendMessage,
      editMessageText: mockEditMessageText,
      getMe: mockGetMe,
      sendChatAction: mockSendChatAction,
    };
    this.start = mockStart;
    this.stop = mockStop;
    this.on = mockOn;
    this.catch = vi.fn();
  });
  return { Bot: MockBot };
});
```

## メッセージコールバックの変更点

grammy のメッセージハンドラは `(ctx: Context)` を受け取るため、テスト内のコールバック呼び出しも変更:

```typescript
// Before
await messageCallback(telegramMsg);

// After: ctx オブジェクトとして渡す
await messageCallback({ message: telegramMsg });
```

## Acceptance Criteria

- [ ] `vi.mock("node-telegram-bot-api", ...)` が `vi.mock("grammy", ...)` に置き換わっている
- [ ] `bot.api.*` メソッドが正しく mock されている
- [ ] 既存のすべてのテストケースが PASS している（機能変更なし）
- [ ] `pnpm test` で 217 tests 以上が PASS

## 注意

- テストの **仕様（何をテストするか）は変更しない** — mock の実装のみ差し替える
- 既存テストが落ちた場合は TASK-002 の実装に戻って修正する
