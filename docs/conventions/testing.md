# テスト規約

<!-- TODO: プロジェクトに合わせて記述してください -->

## テストフレームワーク

- ユニットテスト: Vitest (`packages/jimmy/src/**/__tests__/`)
- E2E テスト: Playwright (`e2e/`)

## 命名

- テストファイル: `*.test.ts`
- テスト名: `describe('ComponentName', () => { it('should ...') })`

## 方針

- エンジンの単体テストはモックを使用（実際の CLI は呼ばない）
- E2E テストは実際のデーモンプロセスを起動して検証

---

## process.exit・unhandled rejection パターン

lifecycle 系・daemon 系モジュールをテストする際、`process.exit` をモックしても
テスト関数が return した後に非同期チェーンが発火し Vitest が
`"process.exit unexpectedly called"` を unhandled rejection として報告するケースがある。

### 問題パターン

```ts
it("force-exit after timeout", async () => {
  const mockCleanup = vi.fn().mockImplementation(
    async () => new Promise<void>((r) => { resolveCleanup = r })
  );
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

  sigintHandler?.();
  await vi.advanceTimersByTimeAsync(6000); // forceTimer → process.exit(1) ← spy で捕捉

  expect(exitCode).toBe(1);

  resolveCleanup?.(); // ← ここで cleanup が解決され、await cleanup() の続きが走る
  exitSpy.mockRestore(); // spy 復元後に process.exit(0) が発火 → unhandled rejection!
});
```

`resolveCleanup()` を呼ぶと非同期チェーンが動き出し、spy 復元後に
`process.exit(0)` が実際に呼ばれてしまう。

### 解決策: cleanup Promise を未解決のまま残す

```ts
it("force-exit after timeout", async () => {
  const mockCleanup = vi.fn().mockImplementation(
    // 意図的に never-resolve — テスト終了時に GC される
    async () => new Promise<void>(() => {})
  );
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

  sigintHandler?.();
  await vi.advanceTimersByTimeAsync(6000); // forceTimer → process.exit(1)

  expect(exitCode).toBe(1);

  // resolveCleanup を呼ばない ← process.exit(0) は発火しない
  exitSpy.mockRestore();
});
```

**ポイント:**
- `process.exit` が実行されたらプロセスが終了するのが本来の動作。テストではその後の処理が走らないことを前提として書く
- cleanup を解決しても `process.exit(0)` が spy の外で発火しないよう、cleanup Promise は未解決のままにする
- `vi.useFakeTimers()` を使う場合は `vi.useRealTimers()` を spy 復元より先に呼ぶ

### `await Promise.resolve()` では不十分な理由

`resolveCleanup()` → `async cleanup()` が解決 → `await cleanup()` の続きが実行 → `process.exit(0)`
というチェーンは複数の microtask hop を経るため、`await Promise.resolve()` を1〜2回挟んでも
すべてのホップが終わる前に spy が復元されてしまう。cleanup を未解決のまま残す方が確実。
