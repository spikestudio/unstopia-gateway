<!-- 配置先: docs/requirements/ES-013-api-split.md -->
# ES-013: E1 — gateway/api.ts 分割

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-25 |
| 対応 Issue | #88 |
| 対応ストーリー | S1 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |

## 概要

`gateway/api.ts`（2668行・310条件分岐）を API ドメイン別ファイルに分割し、各ドメインを独立して変更・テストできる構造にする。

## 分割結果

| ファイル | 行数 | 役割 |
|---------|------|------|
| `gateway/api.ts` | 39 | dispatcher のみ（handleApiRequest → 各ハンドラに委譲） |
| `gateway/api/utils.ts` | 176 | 共通ヘルパー（readBody, json, matchRoute, serializeSession 等） |
| `gateway/api/session-runner.ts` | 787 | runWebSession / transcript / dispatch ロジック |
| `gateway/api/sessions.ts` | 612 | /api/sessions* ハンドラ（19ルート） |
| `gateway/api/cron.ts` | 148 | /api/cron* ハンドラ（6ルート） |
| `gateway/api/org.ts` | 238 | /api/org* ハンドラ（7ルート） |
| `gateway/api/skills.ts` | 210 | /api/skills* ハンドラ（6ルート） |
| `gateway/api/connectors.ts` | 222 | /api/connectors* ハンドラ（6ルート） |
| `gateway/api/stt.ts` | 147 | /api/stt* ハンドラ（4ルート） |
| `gateway/api/misc.ts` | 482 | config/logs/activity/onboarding/files/goals/budgets/costs |

## 設計判断

- `session-runner.ts`（787行）は `runWebSession` を含む。この関数はレート制限フォールバック・リトライ・待機ループを含む不可分な非同期ロジックであり、さらなる分割は凝集度を下げるため現状維持
- 各ドメインハンドラは `(req, res, context, method, pathname[, url]): Promise<boolean>` を返すシグネチャで統一（`true` = 処理済み、`false` = 次ハンドラへ）
- `skills.ts` の `_context: ApiContext` はシグネチャ統一のため保持（skills ハンドラ内で context を参照しないが、dispatcher 側でシグネチャを分岐させるコストを避けるため `_` プレフィックスで未使用を明示）

## Acceptance Criteria

| # | AC | 検証方法 |
|---|-----|---------|
| AC-1 | `gateway/api.ts` が 200 行以下（dispatcher のみ） | `wc -l` 確認（実測 39行） |
| AC-2 | 各ドメインファイルが 800 行以下 | `wc -l` 確認（最大 session-runner.ts 787行） |
| AC-3 | `pnpm build && pnpm test` が全 PASS | 655 tests PASS 確認済み |
| AC-4 | `npx madge --circular` がゼロ件を維持 | コマンド確認済み |
