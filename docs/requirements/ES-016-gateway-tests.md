<!-- 配置先: docs/requirements/ES-016-gateway-tests.md -->
# ES-016: E8 — gateway テスト拡充

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-25 |
| 対応 Issue | #94 |
| 対応ストーリー | S12 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |

## 概要

gateway/ モジュールのテストを拡充し branch カバレッジを向上させる。
`gateway/api/cron.ts`（全ルート）と `gateway/api/org.ts`（基本ルート）を対象とした。

## 追加テスト

| ファイル | テスト数 | 対象 |
|---------|---------|------|
| `gateway/__tests__/api-cron.test.ts` | 12件 | `handleCronRequest` — 全6ルート + 404パス |
| `gateway/__tests__/api-org.test.ts` | 3件 | `handleOrgRequest` — GET /api/org / GET employees / 未マッチ |

## HTTP ハンドラーテストのパターン

- `HttpRequest` は `EventEmitter` を最小限にキャスト、`setImmediate` でボディを非同期送信
- `ServerResponse` は `writeHead` / `end` をモックして status と body を検証
- cron/jobs, cron/scheduler, cron/runner, fs を vi.mock で分離

## カバレッジ推移

| 時点 | branch coverage |
|------|----------------|
| ES-016 開始前 | 30.12% |
| api-cron.test.ts 追加後 | 30.99% |
| api-org.test.ts 追加後 | 測定中（~31%推定） |

## Acceptance Criteria

| # | AC | 達成状況 |
|---|-----|---------|
| AC-1 | `gateway/api/cron.ts` の主要ルートがテスト済み | ✅ 12テスト（全ルート） |
| AC-2 | `pnpm test` が全 PASS | ✅ 726 tests PASS |
| AC-3 | branch カバレッジが 35% 以上 | 🔄 ~31%（gateway/api の残ハンドラーは後続 Epic で対応） |
