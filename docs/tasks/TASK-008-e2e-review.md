# TASK-008: smoke.spec.ts 現状確認・E2E 整備方針確定・記録

| 項目 | 内容 |
|------|------|
| Epic | ES-002 |
| AC | AC-E002-06, AC-E002-07, AC-E002-08 |
| 複雑度 | S |
| 依存 | なし（TASK-006 と並行実施可能） |

## 作業内容

`e2e/smoke.spec.ts` の現状を読み取り、カバーしているシナリオ・前提条件を把握・記録する。
playwright での実行可否を確認し、E2E テストの整備方針（現状維持 or 追加実装）をユーザーと合意する。

## 実施手順

```bash
# smoke.spec.ts の内容確認
cat e2e/smoke.spec.ts

# playwright 実行（gateway 起動が必要な場合は SKIP で記録）
pnpm test:e2e 2>/dev/null || echo "SKIP: gateway not running"
```

## 記録先

`docs/requirements/ES-002-test-coverage-foundation.md` の未決定事項 #2 を以下の形式で更新:

```
| 2 | E2E テスト整備方針 | 確定済み | 「現状維持」または「TASK-XXX で N 件追加」|
```

## Acceptance Criteria

- [ ] `e2e/smoke.spec.ts` のテスト内容（シナリオ・前提条件）が把握され Epic 仕様書に記録されている（AC-E002-06）
- [ ] playwright 実行結果（PASS / SKIP）が確認・記録されている（AC-E002-07）
- [ ] E2E 整備方針がユーザーと合意され未決定事項 #2 が解決済みになっている（AC-E002-08）
