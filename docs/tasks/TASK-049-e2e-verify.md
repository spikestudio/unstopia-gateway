# Task: [ES-022] E2E 検証（typecheck / build / test PASS）（AC-E022-07〜08）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #143 |
| Epic 仕様書 | ES-022 |
| Story | 22.1, 22.2 |
| Complexity | S |
| PR | <!-- マージ後に記入 --> |

## 責務

TASK-047・TASK-048 の実装が完了した状態で `pnpm typecheck && pnpm build && pnpm test --run` を実行し、
全 AC（AC-E022-07〜08）が PASS することを確認する。

## スコープ

対象ファイル:

- 確認のみ。新規実装は行わない
- TASK-047〜048 で生成・更新された全ファイル

対象外（隣接 Task との境界）:

- TASK-047: api-types.ts の型定義は行わない
- TASK-048: ハンドラーキャスト置換は行わない
- 失敗した場合は対応 Task に差し戻し

## 受入基準

- AC-E022-07: `pnpm typecheck` がゼロエラーで通過する
- AC-E022-08: `pnpm test` が全 PASS する

## 依存

TASK-047 (#141), TASK-048 (#142) が完了していること
