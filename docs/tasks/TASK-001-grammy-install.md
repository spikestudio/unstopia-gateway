# TASK-001: grammy インストール・node-telegram-bot-api 削除

| 項目 | 内容 |
|------|------|
| Epic | ES-001 |
| AC | AC-1 |
| 複雑度 | S |
| 依存 | なし |

## 作業内容

`packages/jimmy/package.json` の依存を切り替え、lockfile を更新する。

## 変更ファイル

- `packages/jimmy/package.json`
- `pnpm-lock.yaml`（自動更新）

## 実施手順

```bash
# grammy 追加
pnpm add grammy --filter unstopia-gateway-cli

# node-telegram-bot-api / @types/node-telegram-bot-api 削除
pnpm remove node-telegram-bot-api @types/node-telegram-bot-api --filter unstopia-gateway-cli

# lockfile 確認
pnpm install
```

## Acceptance Criteria

- [ ] `node-telegram-bot-api` が `packages/jimmy/package.json` の dependencies から除去されている
- [ ] `@types/node-telegram-bot-api` が devDependencies から除去されている
- [ ] `grammy@^1.0.0` が dependencies に追加されている
- [ ] `pnpm install` が警告なく完了する
- [ ] `pnpm build` が通る（import エラーが型レベルで検出される段階まで許容）

## 注意

- TASK-001 完了後、`index.ts` は一時的に型エラーになる（TASK-002 で修正）
- `pnpm build` が通らなくても TASK-001 は完了とみなし、TASK-002 を続ける
