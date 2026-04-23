# TASK-013: engines/mock.ts テスト追加 + coverage 30% 確認

| 項目 | 内容 |
|------|------|
| Epic | ES-003 |
| AC | AC-E003-03, AC-E003-04, AC-E003-05 |
| 複雑度 | M |
| 依存 | TASK-009, TASK-010, TASK-011, TASK-012 |

## 作業内容

`engines/mock.ts` のテストを追加し、全テスト実行後に branch カバレッジ 30% 達成を確認する。

## 対象ファイル

- `src/engines/mock.ts` — テスト用モックエンジンの実装

## テスト配置先

- `src/engines/__tests__/mock.test.ts`

## テスト観点

**engines/mock.ts:**
- `MockEngine` クラスの初期化・設定
- `start()` / `stop()` の動作
- メッセージ送受信のモック動作
- エラーケースのハンドリング

## カバレッジ確認手順

```bash
cd packages/jimmy
pnpm test --coverage

# branch カバレッジが 30% 以上であることを確認
# 未達の場合は追加テスト対象を検討して報告
```

## 30% 未達時の対応方針

以下の順で追加テストを検討:
1. `connectors/whatsapp/format.ts`（格上げ候補）
2. `sessions/callbacks.ts` の追加ケース
3. `shared/` モジュール

## Acceptance Criteria

- [ ] `src/engines/__tests__/mock.test.ts` が `pnpm test` で PASS する（AC-E003-04）
- [ ] `pnpm test --coverage` で branch カバレッジが **30% 以上**に達している（AC-E003-03）
- [ ] リファクタリングなし・`pnpm test && pnpm build` が両方 PASS する（AC-E003-05）
- [ ] カバレッジ達成値を Epic 仕様書の未決定事項に記録する
