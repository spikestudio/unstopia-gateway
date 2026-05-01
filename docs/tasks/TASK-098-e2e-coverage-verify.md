# Task: [ES-031] Task 6 — E2E カバレッジ検証（branch 90% 達成確認）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #224 |
| Epic 仕様書 | ES-031 |
| Story | 1-6（全ストーリー） |
| Complexity | XS |
| PR | <!-- PR 作成後に記入 --> |

## 責務

TASK-093〜097 の実装完了後、`pnpm vitest run --coverage` を実行し `src/sessions` の branch カバレッジが 90% 以上に達したことを確認する。不足分があれば補完テストを追加して目標達成まで調整する。

## スコープ

- カバレッジレポートの確認（確認作業のみ）
- 不足ブランチの補完テスト追加（必要に応じて）

## 完了条件

**機能面:**

- [ ] `pnpm vitest run --coverage` 実行結果で `src/sessions` の Branch 列が 90% 以上であること
- [ ] `src/shared/usageAwareness.ts` の Branch 列が 90% 以上であること
- [ ] 全テストが PASS していること
- [ ] Epic 仕様書の AC チェックボックスが全て [x] であること（#217 に最終確認コメントを投稿）

### 品質面

- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

確認コマンド:
```bash
pnpm vitest run --coverage 2>&1 | grep -A 20 "src/sessions"
pnpm vitest run --coverage 2>&1 | grep "usageAwareness"
```

## 依存

- 先行 Task: TASK-093, TASK-094, TASK-095, TASK-096, TASK-097（全て完了後に実行）

## 引き渡し前チェック

- [ ] 全 TASK（093〜097）が完了していること
- [ ] カバレッジ目標が達成されていること
