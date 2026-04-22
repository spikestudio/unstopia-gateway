# テスト規約

技術スタック: Vitest / Playwright / TypeScript 5.8

## テストフレームワーク

| 種別 | フレームワーク | 配置先 |
|------|-------------|--------|
| ユニットテスト | Vitest | `packages/jimmy/src/**/__tests__/*.test.ts` |
| E2E テスト | Playwright | `e2e/*.spec.ts` |

## テストファイルの配置ルール

```
packages/jimmy/src/
├── engines/
│   ├── claude.ts
│   └── __tests__/
│       └── claude.test.ts      ← 対応するソースと同階層の __tests__/
├── sessions/
│   └── __tests__/
│       └── registry.test.ts
└── shared/
    └── __tests__/
        └── types.test.ts
```

- テストファイルは対象ファイルと同じサブディレクトリの `__tests__/` に置く（MUST）
- ファイル名: `<対象ファイル名>.test.ts`（MUST）

## テストの命名パターン

```ts
// 正
describe("ClaudeEngine", () => {
  describe("run", () => {
    it("should return EngineResult with sessionId on success", async () => {});
    it("should retry on transient error up to MAX_RETRIES times", async () => {});
    it("should return error in EngineResult when process exits non-zero", async () => {});
  });
});

// 誤
describe("test1", () => {
  it("works", () => {});           // 意図が不明
  it("should be correct", () => {}); // 何が correct か不明
});
```

## テスト構造（AAA パターン）

```ts
it("should kill the engine process when kill() is called", async () => {
  // Arrange: テスト対象を準備
  const engine = new ClaudeEngine();
  const mockProc = createMockProcess();

  // Act: 操作を実行
  engine.kill("session-123", "Interrupted");

  // Assert: 結果を検証
  expect(mockProc.killed).toBe(true);
});
```

## レイヤー別のモック方針

| レイヤー | モック対象 | モック手法 |
|---------|----------|----------|
| `engines/` | `spawn`（子プロセス） | `vi.spyOn(childProcess, "spawn")` |
| `sessions/` | SQLite DB | インメモリ DB（`:memory:`）を使用 |
| `gateway/` | Engine, Connector | `vi.fn()` でインターフェースをモック |
| `connectors/` | 外部 SDK（Slack Bolt 等） | `vi.mock()` でモジュールを差し替え |

- モックは外部依存（子プロセス・DB・外部 SDK）のみに限定する（MUST）
- テスト対象のロジック自体をモックしない（MUST）

```ts
// 正: 外部依存（spawn）のみモック
vi.spyOn(childProcess, "spawn").mockReturnValue(mockChildProcess);
const result = await engine.run(opts); // 実際のロジックを実行

// 誤: テスト対象のメソッドをモック
vi.spyOn(engine, "run").mockResolvedValue(fakeResult); // テストにならない
```

## テストピラミッド

```
    E2E テスト (少)
   ───────────────   主要フロー: Gateway 起動 → Slack メッセージ → Engine 応答
  統合テスト (中)
 ───────────────────  セッション管理、API エンドポイント
ユニットテスト (多)
─────────────────────  Engine ロジック、ストリームパーサー、ユーティリティ
```

- Engine のユニットテストは必須（MUST）
- ドメインロジック（triage 判定・コスト計算・セッション管理）はユニットテスト必須（MUST）
- E2E は主要フロー（Slack → Claude 応答）のみ（SHOULD）

## カバレッジ基準

| 対象 | 目標 | 強度 |
|------|------|------|
| `engines/` | 80% 以上 | SHOULD |
| `sessions/` | 70% 以上 | SHOULD |
| `shared/` | 90% 以上 | SHOULD |
| `connectors/` | ユニットテスト不要（E2E でカバー） | MAY |
