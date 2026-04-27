# Task: [ES-022] gateway/api/api-types.ts 新設（AC-E022-01〜06）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #141 |
| Epic 仕様書 | ES-022 |
| Story | 22.1 |
| Complexity | M |
| PR | <!-- マージ後に記入 --> |

## 責務

`packages/jimmy/src/gateway/api/api-types.ts` を新設し、各ハンドラーのリクエスト・レスポンス型を集約定義する。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/api-types.ts`（新規）

対象外（隣接 Task との境界）:

- ハンドラーファイルの変更は TASK-048 で行う
- STT・skills ハンドラーは今回スコープ外

## 受入基準

- AC-E022-01: `api-types.ts` が新設され、各ハンドラーから import できる
- AC-E022-02: sessions ハンドラーのリクエストボディ型が定義される（CreateSessionBody, UpdateSessionBody, BulkDeleteBody, EnqueueMessageBody, StubSessionBody）
- AC-E022-03: org ハンドラーのリクエストボディ型が定義される（CrossRequestBody, PatchEmployeeBody, PutBoardBody）
- AC-E022-04: cron ハンドラーのリクエストボディ型が定義される（CreateCronJobBody, UpdateCronJobBody）
- AC-E022-05: connectors ハンドラーのリクエストボディ型が定義される（IncomingMessageBody, ProxyActionBody, SendMessageBody）
- AC-E022-06: misc ハンドラーのレスポンス型が定義される（StatusResponse, InstanceInfo, OnboardingBody）

## 実装メモ

- `body as Record<string, unknown>` を置き換えるための named type を定義する
- ランタイムバリデーションは変更しない（型定義のみ）
- `unknown` ベースの型アサーションを使い、any は使わない
- 300行以内を目標とする
