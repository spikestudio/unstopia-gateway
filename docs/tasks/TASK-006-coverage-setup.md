# TASK-006: @vitest/coverage-v8 インストール・coverage 設定追加

| 項目 | 内容 |
|------|------|
| Epic | ES-002 |
| AC | AC-E002-01, AC-E002-02, AC-E002-03, AC-E002-05 |
| 複雑度 | S |
| 依存 | なし |

## 作業内容

`packages/jimmy` に `@vitest/coverage-v8` を追加し、`vitest.config.ts` に coverage 設定を追記する。

## 変更ファイル

- `packages/jimmy/package.json`（devDependencies に @vitest/coverage-v8 追加）
- `packages/jimmy/vitest.config.ts`（coverage セクション追加）
- `pnpm-lock.yaml`（自動更新）
- `.gitignore`（`coverage/` を除外）

## 実施手順

```bash
# @vitest/coverage-v8 インストール
pnpm add -D @vitest/coverage-v8 --filter unstopia-gateway-cli

# vitest.config.ts に coverage 設定を追記（下記参照）

# .gitignore に coverage/ を追加
```

## vitest.config.ts の変更内容

```typescript
// test セクションに以下を追加:
coverage: {
  provider: "v8",
  reporter: ["text", "html"],
  include: ["src/**/*.ts"],
  exclude: [
    "src/**/*.test.ts",
    "src/**/__tests__/**",
    "src/**/*.d.ts",
  ],
},
```

## Acceptance Criteria

- [ ] `pnpm test --coverage` でターミナルに branch/statement/line/function カバレッジ率が表示される（AC-E002-01）
- [ ] `packages/jimmy/coverage/` に HTML レポートが出力される（AC-E002-02）
- [ ] `src/**/*.ts` 全ファイルが計測対象に含まれる（AC-E002-03）
- [ ] `vitest.config.ts` に provider/reporter/include/exclude が設定されている（AC-E002-05）
