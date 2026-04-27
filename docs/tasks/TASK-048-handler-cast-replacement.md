# Task: [ES-022] ハンドラー内キャスト置換（api-types.ts 参照）（AC-E022-09〜11）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #142 |
| Epic 仕様書 | ES-022 |
| Story | 22.2 |
| Complexity | M |
| PR | <!-- マージ後に記入 --> |

## 責務

sessions.ts, org.ts, cron.ts, connectors.ts, misc.ts における `body as Record<string, unknown>` キャストを
`api-types.ts` で定義した named 型に置き換える。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/sessions.ts`
- `packages/jimmy/src/gateway/api/org.ts`
- `packages/jimmy/src/gateway/api/cron.ts`
- `packages/jimmy/src/gateway/api/connectors.ts`
- `packages/jimmy/src/gateway/api/misc.ts`

対象外（隣接 Task との境界）:

- `api-types.ts` の定義変更は TASK-047 で完結済みとする
- STT・skills ハンドラーは今回スコープ外

## 受入基準

- AC-E022-09: sessions.ts の主要キャスト箇所（5箇所以上）が named 型アサーションに置き換えられる
- AC-E022-10: org.ts, cron.ts, connectors.ts の同様のキャスト箇所が named 型参照に置き換えられる
- AC-E022-11: biome check がゼロ警告・ゼロエラーを維持する

## 依存

TASK-047 (#141) が完了していること
