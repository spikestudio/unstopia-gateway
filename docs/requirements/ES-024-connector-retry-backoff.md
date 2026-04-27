# ES-024: コネクター共通基底 — リトライ・バックオフユーティリティ統一

| 項目 | 内容 |
|------|------|
| Epic ID | ES-024 |
| Phase | Phase 2: コードベース構造改善 |
| Story | S19: コネクターのエラーリトライ・バックオフ処理を共通基底に統一 |
| Issue | #148 |
| Priority | Medium |
| Complexity | S |

## 概要

WhatsApp コネクターのインライン指数バックオフ計算を `packages/jimmy/src/shared/retry.ts` に共通ユーティリティとして抽出する。
各コネクターが独自にリトライロジックを実装せずに済む基盤を整備し、動作を予測可能にする。

## ストーリー

**S19**: As a **開発者**, I want to コネクターのエラーリトライ・バックオフ処理を共通基底に統一したい, so that 各コネクターが独自にリトライを実装する必要がなくなり、動作が予測可能になる.

## 受け入れ条件

### AC-E024-01: `shared/retry.ts` の `exponentialBackoffMs` が正しい遅延を返す

- `exponentialBackoffMs(0, 5000, 60000)` → `5000`
- `exponentialBackoffMs(1, 5000, 60000)` → `10000`
- `exponentialBackoffMs(10, 5000, 60000)` → `60000`（maxMs でキャップ）

### AC-E024-02: `shared/retry.ts` の `withRetry` が成功まで最大N回リトライする

- 成功時は最初の試行で即座に結果を返す
- 失敗時はリトライして最終的に成功した結果を返す
- `maxAttempts` 回失敗した場合は最後のエラーをスローする
- `onRetry` コールバックが正しい attempt 番号で呼ばれる

### AC-E024-03: `whatsapp/index.ts` が `exponentialBackoffMs` を使うようリファクタリング済み

- `scheduleReconnect()` のインライン計算 `Math.min(5000 * 2 ** this.reconnectAttempts, 60000)` が
  `exponentialBackoffMs(this.reconnectAttempts, 5000, 60000)` に置き換えられている

### AC-E024-04: `pnpm test` 全 PASS

- `packages/jimmy` のすべてのテストが通過すること
- 新規テストファイル `shared/__tests__/retry.test.ts` が追加されていること
