# Task: [ES-030] Story 1 — ClaudeEngine branch カバレッジ向上テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #213 |
| Epic 仕様書 | ES-030 |
| Story | 1 |
| Complexity | S |
| PR | <!-- PR 作成後に記入 --> |

## 責務

`claude.ts` の未カバーブランチ（`normalizeRateLimitInfo`・`signalProcess`・`kill` タイムアウト分岐・`isTransientError` 全パターン・`parseClaudeJsonOutput` の各 JSON 形式）をテストし、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `src/engines/__tests__/claude.test.ts`（既存ファイルにテストケースを追加）

対象外（隣接 Task との境界）:

- TASK-090: codex.ts のテスト追加は対象外
- TASK-091: gemini.ts のテスト追加は対象外

## Epic から委ねられた詳細

- `normalizeRateLimitInfo` は private メソッドなので `(engine as unknown as { normalizeRateLimitInfo(raw: unknown): unknown }).normalizeRateLimitInfo(...)` でアクセスする（`as any` は既存テストが使用しているが新規では禁止のため、型安全なキャストを使用する）
- `signalProcess` の Windows パス（`proc.kill(signal)`）のテストは `process.platform` が `win32` の場合を vi.stubGlobal 等でモックして実現する。macOS 環境では直接テスト不可な可能性があるため、pid=0 の場合（`process.kill(-0, signal)` が失敗する）や pid 未設定ケースで代替する
- `kill()` タイムアウト（SIGKILL）分岐は `vi.useFakeTimers()` で `setTimeout` を制御して検証する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E030-01**: `claude.ts` の branch カバレッジが 90% 以上に到達すること
- [ ] **AC-E030-02**: リトライロジック（`MAX_RETRIES=2`）の全分岐（成功・非transientエラー・transientエラー・deadセッションエラー・中断）がテストされていること
- [ ] **AC-E030-03**: `isTransientError` 関数の全パターン（exit code 1 + 短い stderr、各 TRANSIENT_PATTERNS 正規表現）がテストされていること
- [ ] **AC-E030-04**: streaming モードと非 streaming モード両方の正常終了パスがテストされていること
- [ ] **AC-E030-05**: `kill()` によるプロセス中断後、結果が `Interrupted` エラーとして返されることがテストされていること
- [ ] **AC-E030-06**: `proc.on("error")` イベント（spawn 失敗）が reject を引き起こすことがテストされていること
- [ ] **AC-E030-07**: `parseClaudeJsonOutput` が配列・オブジェクト・rate_limit_event を含む各種出力形式を正しく解析することがテストされていること
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E030-01〜07）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `normalizeRateLimitInfo`・`signalProcess`・`kill` タイムアウト | private メソッドは型安全キャストでアクセス |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: モック spawn ベースの単体テストのみで完結できる | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（インフラ/エンジン層） |
| サブドメイン種別 | 汎用 → E2E 中心（ただし本 Task は UT のみ） |

- 参照 Epic 仕様書: ES-030 Story 1（AC-E030-01〜04）
- 参照コード: `src/engines/claude.ts §normalizeRateLimitInfo`・`§signalProcess`・`§kill`
- 参照コード: `src/engines/__tests__/claude.test.ts §buildCleanEnv`（private メソッドアクセスパターン参照）
- 参照 ADR: 該当なし
- 既存テストパターン: `claude.test.ts` の `describe("buildCleanEnv")` で使用している private メソッドアクセス手法を踏襲する

### 実装のヒント

**`normalizeRateLimitInfo` のテスト:**
```typescript
const normalize = (engine as unknown as {
  normalizeRateLimitInfo(raw: unknown): unknown;
}).normalizeRateLimitInfo.bind(engine);

// AC-E030-01
expect(normalize(null)).toBeUndefined();
expect(normalize("string")).toBeUndefined();
expect(normalize([1, 2, 3])).toBeUndefined();

// AC-E030-02
const result = normalize({
  status: "ok",
  resetsAt: 999,
  rateLimitType: "daily",
  overageStatus: "active",
  overageDisabledReason: "none",
  isUsingOverage: true,
});
expect(result).toMatchObject({ status: "ok", resetsAt: 999, ... });
// 型不一致フィールド
const result2 = normalize({ status: 123, resetsAt: "not-a-number" });
expect((result2 as any).status).toBeUndefined();
expect((result2 as any).resetsAt).toBeUndefined();
```

**`kill` タイムアウトのテスト（vi.useFakeTimers 使用）:**
```typescript
vi.useFakeTimers();
// proc.exitCode = null のままで kill()
engine.kill("sess-id", "reason");
vi.advanceTimersByTime(2001);
// signalProcess が SIGKILL で呼ばれることを検証
// → proc.kill が 2 回呼ばれる（SIGTERM + SIGKILL）
vi.useRealTimers();
```

**`signalProcess` の `proc.kill` パス:**
`proc.pid` が 0 の場合、`process.kill(-0, signal)` は platform を問わず正常動作しない可能性がある。
`pid === 0` を `!!proc.pid` の false 側として扱い、`proc.kill(signal)` パスに落ちることを確認する。

## 依存

- 先行 Task: なし（--）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E030-01〜04）が完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベル S（~200 行）の目安に収まっている
- [ ] 規約ドキュメント（testing.md・prohibitions.md）にこの Task で使う規約が記載されている
- [ ] Epic から委ねられた詳細が転記されている
