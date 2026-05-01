# Task: [ES-032] Story 1.5 — cron.ts 残存カバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #232 |
| Epic 仕様書 | ES-032 |
| Story | 1.5 |
| Complexity | S |
| PR | #226 |

## 責務

`src/gateway/api/cron.ts` の未カバーブランチ（JSON パース失敗の空 catch / trigger 正常・404 分岐）をテストし、branch カバレッジを 86% から 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/cron.test.ts`（新規作成）
- `packages/jimmy/src/gateway/api/cron.ts`（読み取りのみ、変更なし）

対象外（隣接 Task との境界）:

- 既存カバー済みパス（GET /api/cron / GET /api/cron/:id/runs 正常系 / POST /api/cron / PUT /api/cron/:id / DELETE /api/cron/:id）は包括的にカバーする（未テストファイルなので全体をカバー）

## Epic から委ねられた詳細

- `loadJobs`, `saveJobs` は `../../cron/jobs.js` からモックする
- `runCronJob` は `../../cron/runner.js` からモックする（fire-and-forget なので即時 resolve で OK）
- `reloadScheduler` は `../../cron/scheduler.js` からモックする
- `GET /api/cron/:id/runs` の JSON パース失敗パス: JSONL ファイルに invalid JSON 行を含めて `try {}` の空 catch が通ることを確認する
- `POST /api/cron/:id/trigger` の fire-and-forget: `runCronJob` が呼ばれることと即座に 200 が返ることを確認する
- `CRON_RUNS` は `../../shared/paths.js` からモックする

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E032-33: `cron.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E032-34: `GET /api/cron/:id/runs` でラストラン JSON パース失敗時の振る舞いが検証される
- [ ] AC-E032-35: `POST /api/cron/:id/trigger` がジョブ不在時に 404 を返し、正常時に triggered フラグとともに即座に 200 を返すことが検証される
- [ ] Epic 仕様書の AC-E032-33〜35 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | handleCronRequest の全ルート分岐（特に未カバーの空 catch と trigger 分岐） | FS・jobs・runner・scheduler はモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: HTTP ハンドラーの単体テストのみ。E2E は TASK-106 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway/api（HTTP ルーティング層） |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-032 §Story 1.5
- 参照コード: `packages/jimmy/src/gateway/api/cron.ts`
- 参照コード: `packages/jimmy/src/gateway/api/__tests__/session-crud.test.ts`（モック構成の参考）

**モック対象一覧:**

- `node:fs` → `existsSync`, `readFileSync`
- `node:path` → `join`
- `../../cron/jobs` → `loadJobs`, `saveJobs`
- `../../cron/runner` → `runCronJob`
- `../../cron/scheduler` → `reloadScheduler`
- `../../shared/logger` → `logger`
- `../../shared/paths` → `CRON_RUNS`
- `node:crypto` → `randomUUID`

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] Epic から委ねられた詳細が転記されている
