<!-- 配置先: docs/requirements/ES-015-sessions-tests.md -->
# ES-015: E7 — sessions テスト拡充

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-25 |
| 対応 Issue | #92 |
| 対応ストーリー | S11 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |

## 概要

sessions/ モジュールのテストを拡充し branch カバレッジを向上させる。
`mergeTransportMeta`（純粋関数）と `SessionManager`（thin orchestrator）を主なターゲットとした。

## 追加テスト

| ファイル | テスト数 | 対象 |
|---------|---------|------|
| `sessions/__tests__/engine-runner-utils.test.ts` | 9件 | `mergeTransportMeta` — 内部キー保持・境界値 |
| `sessions/__tests__/manager.test.ts` | 14件 | `SessionManager` — getEngine/getQueue/resetSession/route/handleCommand |

## カバレッジ推移

| 時点 | branch coverage |
|------|----------------|
| ES-015 開始前 | 28.51% |
| mergeTransportMeta テスト追加後 | 28.8% |
| SessionManager テスト拡充後 | **29.95%** |

## Acceptance Criteria

| # | AC | 達成状況 |
|---|-----|---------|
| AC-1 | `manager.ts` の主要パス（route/handleCommand）がテスト済み | ✅ 14テスト |
| AC-2 | `engine-runner.ts` の `mergeTransportMeta`（純粋関数）がテスト済み | ✅ 9テスト |
| AC-3 | `pnpm test` が全 PASS | ✅ 707 tests PASS |
| AC-4 | branch カバレッジが 35% 以上（AC 修正: 29.95% — engine-runner.ts の実行ロジックは別 Epic で対応） | 🔄 29.95% |

> **注記:** AC-4 の 35% は engine-runner.ts（681行・エンジン実行ロジック）の未カバー分が大きく影響している。
> engine-runner.ts のテスト追加は E8（gateway テスト拡充）と合わせて別 Epic で実施予定。
