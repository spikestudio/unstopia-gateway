# TASK-009: テストファイル整理・coverage.exclude 修正

| 項目 | 内容 |
|------|------|
| Epic | ES-003 |
| AC | AC-E003-01, AC-E003-02 |
| 複雑度 | S |
| 依存 | なし |

## 作業内容

`__tests__/` 外に存在するテストファイル 3 件を移動し、vitest.config.ts の coverage.exclude を修正する。

## 移動対象

| 現在のパス | 移動先 |
|-----------|--------|
| `src/sessions/queue.test.ts` | `src/sessions/__tests__/queue.test.ts` |
| `src/sessions/registry.test.ts` | `src/sessions/__tests__/registry.test.ts` |
| `src/connectors/slack/threads.test.ts` | `src/connectors/slack/__tests__/threads.test.ts` |

## vitest.config.ts 修正

`coverage.exclude` に以下を追加:

```typescript
"src/**/*.test.ts",  // __tests__/ 外に残ったテストファイルを除外
```

## Acceptance Criteria

- [ ] 3 ファイルが `__tests__/` 内に移動し、`pnpm test` が PASS する（AC-E003-01）
- [ ] `vitest.config.ts` の `coverage.exclude` に `src/**/*.test.ts` が追加されている（AC-E003-02）
- [ ] `pnpm test --coverage` を実行してカバレッジ計測が正常に動作する
