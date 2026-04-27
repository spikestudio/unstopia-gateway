# ES-023: 構造化ログ導入（JSON 形式 + sessionId トレース）

| 項目 | 内容 |
|------|------|
| Epic ID | ES-023 |
| Phase | Phase 2: コードベース構造改善 |
| Story | S18: shared/logger.ts に JSON 構造化ログ + sessionId トレースを追加 |
| Issue | #145 |
| Priority | Medium |
| Complexity | S |

## 概要

`packages/jimmy/src/shared/logger.ts` に JSON 形式のログ出力と `LogContext` インタフェースを追加する。
既存の平文ログ形式はデフォルトとして維持し、後方互換性を保つ。

## ストーリー

**S18**: AI gateway daemon のオペレーション上、sessionId・connector・engine をログに付与して追跡したい。
現状の平文形式では grep/jq による構造的な解析ができないため、JSON 形式の出力モードを追加する。

## 受け入れ条件

### AC-E023-01: JSON モードが正しい構造の JSON を出力する

- `configureLogger({ json: true })` 設定後のログが JSON.parse 可能であること
- 出力 JSON に `level`・`timestamp`・`message` の 3 フィールドが含まれること
- `timestamp` は ISO 8601 形式であること

### AC-E023-02: `ctx.sessionId` が JSON ログ出力に含まれる

- `logger.info("msg", { sessionId: "xxx" })` 呼び出し時、出力 JSON に `sessionId: "xxx"` が含まれること
- `connector`・`engine` 等の追加コンテキストフィールドも同様に出力されること
- `undefined` 値のフィールドは JSON に含まれないこと

### AC-E023-03: デフォルト（平文）モードが変更されない

- `configureLogger({ json: false })` またはデフォルト状態では平文形式を出力すること
- 平文形式: `<ISO timestamp> [LEVEL] <message>`
- minLevel 以下のログは出力されないこと
- 既存の呼び出し元（`ctx` 引数なし）は変更なしで動作すること

### AC-E023-04: `pnpm test` が PASS する

- `packages/jimmy/src/shared/__tests__/logger.test.ts` の全テストが通ること
- 全体テストスイート（52 ファイル）の PASS が維持されること
- `biome check` でエラーゼロであること

## 設計

### LogContext インタフェース

```typescript
export interface LogContext {
  sessionId?: string;
  connector?: string;
  engine?: string;
  [key: string]: string | number | boolean | undefined;
}
```

### configureLogger 拡張

```typescript
// json?: boolean — true にすると JSON 形式で出力
configureLogger({ json: true, level: "info", stdout: true, file: false });
```

### JSON ログフォーマット

```json
{"level":"info","timestamp":"2026-04-27T18:00:00.000Z","message":"...","sessionId":"..."}
```

### 後方互換性

- 既存の `logger.info("msg")` 呼び出し（ctx なし）はそのまま動作する
- デフォルトは `json: false`（平文モード）
- 既存のすべてのテストが PASS を維持する

## タスク分解

| Task | 内容 |
|------|------|
| TASK-050 | `shared/logger.ts` JSON 構造化ログ対応 + テスト + 検証 |

## 完了条件チェックリスト

- [x] AC-E023-01: JSON モード出力 OK
- [x] AC-E023-02: sessionId コンテキスト出力 OK
- [x] AC-E023-03: 平文モード後方互換性 OK
- [x] AC-E023-04: `pnpm test` 全 PASS（953 tests）
