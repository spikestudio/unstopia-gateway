<!-- 配置先: docs/requirements/ES-014-session-manager-split.md -->
# ES-014: E4 — sessions/manager.ts 分割

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-25 |
| 対応 Issue | #90 |
| 対応ストーリー | S6, S7 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |

## 概要

`sessions/manager.ts`（982行）から `runSession`（710行）と `handleCronCommand`（49行）を独立モジュールとして抽出し、SessionManager の責務を軽減する。

## 分割結果

| ファイル | 行数 | 役割 |
|---------|------|------|
| `sessions/manager.ts` | 277 | SessionManager クラス（thin orchestrator） |
| `sessions/engine-runner.ts` | 681 | runSession — エンジン実行・レートリミット・リトライ・ストリーミング |
| `sessions/cron-command-handler.ts` | 52 | handleCronCommand — /cron コマンド処理 |

## 設計判断

- `engine-runner.ts` は `runSession(session, msg, attachments, connector, target, engines, config, getConnectors, employee?)` シグネチャで DI パターンを採用。`this.engines` / `this.config` / `this.connectorProvider` をパラメータとして受け取ることで、SessionManager への依存を排除した
- `engine-runner.ts`（681行）はレートリミットフォールバック・指数バックオフ・ストリーミングデルタ処理を含む不可分な非同期ロジックのため現状維持
- `mergeTransportMeta` は `route()` でも使用するため `engine-runner.ts` に export として配置し、`manager.ts` が import する

## Acceptance Criteria

| # | AC | 検証方法 |
|---|-----|---------|
| AC-1 | `sessions/manager.ts` が 300 行以下 | `wc -l` 確認（実測 277行） |
| AC-2 | `sessions/engine-runner.ts` が新規作成され `runSession` が export されている | ファイル存在確認 |
| AC-3 | `sessions/cron-command-handler.ts` が新規作成され `handleCronCommand` が export されている | ファイル存在確認 |
| AC-4 | `pnpm build && pnpm test` が全 PASS | 673 tests PASS 確認済み |
| AC-5 | `npx madge --circular` がゼロ件を維持 | コマンド確認済み |
