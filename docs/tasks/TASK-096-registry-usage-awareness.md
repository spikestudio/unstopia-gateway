# Task: [ES-031] Task 4 — registry.ts + usageAwareness.ts ブランチ補完

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #222 |
| Epic 仕様書 | ES-031 |
| Story | 4, 5 |
| Complexity | S |
| PR | <!-- PR 作成後に記入 --> |

## 責務

`registry.ts` の migration 既存カラム分岐・`usageAwareness.ts` の全未カバーブランチをテストし、それぞれ branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/sessions/__tests__/registry.test.ts`（既存ファイルにテストケースを追加）
- `packages/jimmy/src/shared/__tests__/usageAwareness.test.ts`（新規作成、または既存があれば追加）

## Epic から委ねられた詳細

- `registry.ts` の `initDb` singleton（`if (_db) return _db`）は module-level 変数のため、`vi.resetModules()` でモジュールを再ロードして初期化をリセットする
- `usageAwareness.ts` は `fs` を使用するため、`vi.spyOn(fs, 'existsSync')` 等でファイルシステムをモックする
- `recordClaudeRateLimit` は実際にファイルを書き込むため、`fs.writeFileSync` / `fs.renameSync` をモックしてファイルシステムを汚染しないようにする（または一時ディレクトリを使用）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E031-19**: `migrateSessionsSchema` を全カラム済みのテーブルに適用しても ALTER TABLE が実行されない
- [ ] **AC-E031-20**: `initDb` を2回呼び出したとき同じ Database インスタンスが返される
- [ ] **AC-E031-21**: `recordClaudeRateLimit` を resetsAtSeconds なしで呼ぶと lastResetsAt が記録されない
- [ ] **AC-E031-22**: `recordClaudeRateLimit` を有限な resetsAtSeconds で呼ぶと lastResetsAt が記録される
- [ ] **AC-E031-23**: `isLikelyNearClaudeUsageLimit` で lastResetsAt が未来のとき true が返る（6時間以内）
- [ ] **AC-E031-24**: `isLikelyNearClaudeUsageLimit` で lastResetsAt が過去のとき false が返る
- [ ] **AC-E031-25**: `readClaudeUsageState` でファイル不在は `{}`、不正 JSON も `{}` を返す
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E031-19〜25）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `migrateSessionsSchema`（already-migrated ケース） | better-sqlite3 :memory: DB を使用 |
| ユニットテスト | `initDb` singleton | vi.resetModules() でモジュール再ロード |
| ユニットテスト | `recordClaudeRateLimit`, `readClaudeUsageState` | fs モックまたは一時ディレクトリ |
| ユニットテスト | `isLikelyNearClaudeUsageLimit` | now パラメータを制御 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | sessions/registry — DB 管理；shared/usageAwareness — 使用量追跡 |
| サブドメイン種別 | 汎用 |

- 参照 Epic 仕様書: ES-031 Story 4（AC-E031-19〜20）, Story 5（AC-E031-21〜25）
- 参照コード: `src/sessions/registry.ts` §migrateSessionsSchema, §initDb
- 参照コード: `src/shared/usageAwareness.ts` 全体
- 参照コード: `src/sessions/__tests__/registry.test.ts`（migrateSessionsSchema の既存テスト）

### 実装のヒント

**AC-E031-19: 全カラム済みの migration:**
```typescript
it("全カラムが既に存在する場合、ALTER TABLE は実行されない", () => {
  const db = new Database(":memory:");
  // 全カラムを含むテーブルを作成
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, engine TEXT NOT NULL, engine_session_id TEXT,
      source TEXT NOT NULL, source_ref TEXT NOT NULL, connector TEXT,
      session_key TEXT, reply_context TEXT, message_id TEXT, transport_meta TEXT,
      employee TEXT, model TEXT, title TEXT, parent_session_id TEXT,
      status TEXT DEFAULT 'idle', created_at TEXT NOT NULL, last_activity TEXT NOT NULL,
      last_error TEXT, total_cost REAL DEFAULT 0, total_turns INTEGER DEFAULT 0, effort_level TEXT
    )
  `);
  // マイグレーションを実行しても例外が発生しない
  expect(() => migrateSessionsSchema(db)).not.toThrow();
});
```

**AC-E031-25: readClaudeUsageState — 不正 JSON:**
```typescript
it("不正な JSON ファイルがある場合は {} を返す", () => {
  vi.spyOn(fs, "existsSync").mockReturnValue(true);
  vi.spyOn(fs, "readFileSync").mockReturnValue("not-json{{{");
  expect(readClaudeUsageState()).toEqual({});
});
```

**AC-E031-23〜24: isLikelyNearClaudeUsageLimit:**
```typescript
it("lastResetsAt が未来のとき false を返す（リセット済み）", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 1000).toISOString();
  vi.spyOn(fs, "existsSync").mockReturnValue(true);
  vi.spyOn(fs, "readFileSync").mockReturnValue(
    JSON.stringify({ lastRateLimitAt: past, lastResetsAt: future })
  );
  const now = new Date();
  // lastResetsAt が未来 → reset まだ → true
  expect(isLikelyNearClaudeUsageLimit(now)).toBe(false); // ← resetAt が未来なのでリセット済みとみなされない... 実コードを確認してから実装
});
```
> 注意: `isLikelyNearClaudeUsageLimit` の `lastResetsAt` 判定ロジック（`now.getTime() > resetAt.getTime()` なら false）を実コードで再確認してから実装すること。

## 依存

- 先行 Task: なし（独立）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E031-19〜25）が完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
