# TASK-011: gateway ビジネスロジックのテスト追加

| 項目 | 内容 |
|------|------|
| Epic | ES-003 |
| AC | AC-E003-04 |
| 複雑度 | M |
| 依存 | TASK-009 |

## 作業内容

`src/gateway/` の純粋なビジネスロジック関数のユニットテストを追加する。

## 対象ファイル

- `src/gateway/budgets.ts` — トークン予算の計算ロジック
- `src/gateway/goals.ts` — ゴール管理のロジック

## テスト配置先

- `src/gateway/__tests__/budgets.test.ts`
- `src/gateway/__tests__/goals.test.ts`

## テスト観点

**budgets.ts:**
- 予算計算の境界値テスト（0・負数・最大値）
- 予算超過検知ロジック
- 残余予算の計算

**goals.ts:**
- ゴールの追加・取得・削除
- バリデーションルールの検証
- 状態遷移のテスト

## Acceptance Criteria

- [ ] `src/gateway/__tests__/budgets.test.ts` が `pnpm test` で PASS する（AC-E003-04）
- [ ] `src/gateway/__tests__/goals.test.ts` が `pnpm test` で PASS する（AC-E003-04）
- [ ] リファクタリングなし（既存コード変更禁止）

## 注意

- DB 依存がある場合は better-sqlite3 を vi.mock でスタブする
- fs 依存がある場合は `node:fs` を vi.mock でスタブする（リファクタリングなしで対応可能な場合）
