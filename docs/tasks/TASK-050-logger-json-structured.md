# Task: [ES-023] TASK-050 — shared/logger.ts JSON 構造化ログ対応

| 項目 | 内容 |
|------|------|
| Issue | （gh issue create で採番） |
| Epic 仕様書 | ES-023 |
| Story | S18 |
| Complexity | S |

## 責務

`packages/jimmy/src/shared/logger.ts` に JSON 形式ログ出力と `LogContext` インタフェースを追加する。
合わせて `__tests__/logger.test.ts` を新規作成し AC-E023-01〜04 を検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/shared/logger.ts`（更新）
- `packages/jimmy/src/shared/__tests__/logger.test.ts`（新規）
- `docs/requirements/ES-023-structured-logging.md`（新規）

対象外:

- 既存の呼び出し元コードの変更（後方互換性維持）

## 完了条件

**機能面（AC-ID 参照）:**

- [x] AC-E023-01: `configureLogger({ json: true })` 後のログが JSON.parse 可能で `level`/`timestamp`/`message` を含む
- [x] AC-E023-02: `ctx.sessionId` が JSON 出力に含まれる
- [x] AC-E023-03: デフォルト（`json: false`）平文モードが既存動作を維持する
- [x] AC-E023-04: `pnpm test` 全 PASS

### 品質面

- [x] `pnpm typecheck` PASS
- [x] `biome check` エラーゼロ
- [x] 既存の全テスト（52 ファイル / 953 tests）が PASS を維持

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| Unit | `logger.test.ts` | 21 tests — JSON 出力・コンテキスト・平文モード・モード切替 |

## 依存

- 先行 Task: なし
