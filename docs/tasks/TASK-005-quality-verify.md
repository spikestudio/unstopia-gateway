# TASK-005: typecheck・biome・全テスト通過確認

| 項目 | 内容 |
|------|------|
| Epic | ES-001 |
| AC | AC-5 + 全 AC の結合確認 |
| 複雑度 | M |
| 依存 | TASK-001〜004 すべて |

## 作業内容

全 Task 完了後の最終品質確認。型エラー・静的解析エラー・テスト失敗がゼロであることを確認する。

## 実施手順

```bash
# 1. 型チェック
pnpm typecheck

# 2. biome 静的解析
pnpm biome check

# 3. 全テスト
pnpm test

# 4. ビルド確認
pnpm build

# 5. audit 最終確認
pnpm audit
```

## Acceptance Criteria

- [ ] `pnpm typecheck` が clean（エラー 0）
- [ ] `pnpm biome check` が clean（エラー 0）
- [ ] `pnpm test` が 217 tests 以上 PASS（jimmy 側で既存テスト数以上）
- [ ] `pnpm build` が成功する
- [ ] `pnpm audit` の advisory 数が PR #28 後の 4 件から 1 件（protobufjs@6.8.8 のみ）に減少している

## 完了後のアクション

- `/aidd-epic-review` で ES-001 の総合レビューを実施
- gate:reviewed 取得後、PR #34 を draft 解除して merge 指示を待つ
