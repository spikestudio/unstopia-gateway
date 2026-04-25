<!-- 配置先: docs/requirements/ES-011-circular-dep-removal.md -->
# ES-011: E3 — 循環依存解消

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-25 |
| 対応 Issue | #81 |
| 対応ストーリー | S3, S4, S5 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |

## 概要

`npx madge --circular` が検出する 2 サイクルの循環依存を、インターフェース抽出と型定義の移動によって解消する。実装本体のロジック変更は最小限とし、型境界のみを整理する。

## 現状の循環依存（madge 実測）

```
サイクル 1: cron/scheduler.ts → cron/runner.ts → (type) sessions/manager.ts → cron/scheduler.ts
サイクル 2: gateway/api.ts → gateway/files.ts → (type) gateway/api.ts
```

## 解消方針

### サイクル 2（gateway/api ⟷ gateway/files）

`ApiContext` インターフェースを `gateway/api.ts` から `gateway/types.ts`（新規）に移動する。

```
Before: files.ts → import type { ApiContext } from "./api.js"
After:  files.ts → import type { ApiContext } from "./types.js"
        api.ts   → import type { ApiContext } from "./types.js"
```

### サイクル 1（cron ⟷ sessions）

`RouteOptions` を `sessions/manager.ts` から `shared/types.ts` に移動し、`SessionRouter` インターフェースを `shared/types.ts` に追加する。`cron/` は `SessionManager` クラスではなく `SessionRouter` インターフェースに依存するよう変更する。

```
Before: cron/runner.ts    → import type { SessionManager } from "../sessions/manager.js"
        cron/scheduler.ts → import type { SessionManager } from "../sessions/manager.js"

After:  cron/runner.ts    → import type { SessionRouter } from "../shared/types.js"
        cron/scheduler.ts → import type { SessionRouter } from "../shared/types.js"
```

## Acceptance Criteria

| # | AC | 検証方法 |
|---|-----|---------|
| AC-1 | `npx madge --circular --extensions ts packages/jimmy/src` で 0 件 | コマンド出力確認 |
| AC-2 | `gateway/types.ts` が新規作成され `ApiContext` が定義されている | ファイル存在確認 |
| AC-3 | `gateway/files.ts` が `./api.js` ではなく `./types.js` を import している | grep 確認 |
| AC-4 | `SessionRouter` インターフェースが `shared/types.ts` に定義されている | grep 確認 |
| AC-5 | `cron/runner.ts`・`cron/scheduler.ts` が `sessions/manager.ts` を import していない | grep 確認 |
| AC-6 | `pnpm build && pnpm test` が全 PASS（リグレッションなし） | コマンド出力確認 |

## タスク分解

| Task | 内容 | Issue |
|------|------|-------|
| TASK-019 | `ApiContext` を `gateway/types.ts` に移動 | #82 |
| TASK-020 | `SessionRouter` / `RouteOptions` を `shared/types.ts` に追加、cron の import を更新 | #83 |
| TASK-021 | madge ゼロ循環依存検証 + 全テスト PASS 確認 | #84 |
