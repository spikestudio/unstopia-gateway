<!-- 配置先: docs/requirements/ES-012-composition-root.md -->
# ES-012: E2 — Composition Root

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-25 |
| 対応 Issue | #86 |
| 対応ストーリー | S2 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |

## 概要

`gateway/server.ts` の `startGateway()` 内でインラインに生成していたエンジン依存・コネクター名を `gateway/container.ts` のファクトリ関数として分離し、Composition Root パターンを確立する。

## 解消方針

| 関数 | 責務 |
|------|------|
| `buildEngines(config)` | Claude / Codex / Gemini エンジンを生成して `Map<string, Engine>` で返す |
| `buildConnectorNames(config)` | 設定から有効なコネクター名リストを生成して返す |

`startGateway` はファクトリを呼び出して組み立てる thin orchestrator になる。

## Acceptance Criteria

| # | AC | 検証方法 |
|---|-----|---------|
| AC-1 | `gateway/container.ts` が新規作成され `buildEngines` / `buildConnectorNames` が export されている | ファイル存在・grep 確認 |
| AC-2 | `gateway/server.ts` の `startGateway` がエンジン生成を `buildEngines` に委譲している | grep 確認 |
| AC-3 | cleanup 処理が `engines.values()` をイテレートして `killAll` を呼ぶ汎用実装になっている | コード確認 |
| AC-4 | `pnpm build && pnpm test` が全 PASS | コマンド出力確認 |
