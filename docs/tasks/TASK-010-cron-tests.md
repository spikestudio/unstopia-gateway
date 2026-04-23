# TASK-010: cron モジュールのテスト追加

| 項目 | 内容 |
|------|------|
| Epic | ES-003 |
| AC | AC-E003-04 |
| 複雑度 | M |
| 依存 | TASK-009 |

## 作業内容

`src/cron/` モジュールのユニットテストを追加する。外部依存を vi.mock でスタブし、純粋なビジネスロジックをテストする。

## 対象ファイル

- `src/cron/jobs.ts` — SQLite を使った cron job の CRUD
- `src/cron/scheduler.ts` — node-cron の schedule/stop ラッパー

## テスト配置先

- `src/cron/__tests__/jobs.test.ts`
- `src/cron/__tests__/scheduler.test.ts`

## モック方針

```typescript
// better-sqlite3 は vi.mock でスタブ
vi.mock("better-sqlite3", () => {
  const MockDb = vi.fn(() => ({
    prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })),
    pragma: vi.fn(),
  }));
  return { default: MockDb };
});

// node-cron は vi.mock でスタブ
vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(() => ({ stop: vi.fn() })),
    validate: vi.fn(() => true),
  },
}));
```

## テスト観点

**jobs.ts:**
- `loadJobs()` が DB から全件取得して返す
- `saveJobs()` が DB に書き込む
- `addJob(job)` が新規 job を追加する

**scheduler.ts:**
- `scheduleJobs()` が有効な job を schedule する
- 無効な cron 式の job をスキップする
- `stopScheduler()` が全タスクを停止する

## Acceptance Criteria

- [ ] `src/cron/__tests__/jobs.test.ts` が `pnpm test` で PASS する（AC-E003-04）
- [ ] `src/cron/__tests__/scheduler.test.ts` が `pnpm test` で PASS する（AC-E003-04）
- [ ] リファクタリングなし（既存コード変更禁止）
