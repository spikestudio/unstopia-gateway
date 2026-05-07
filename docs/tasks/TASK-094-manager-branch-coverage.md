# Task: [ES-031] Task 2 — manager.ts 未カバーブランチ補完

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #220 |
| Epic 仕様書 | ES-031 |
| Story | 2 |
| Complexity | S |
| PR | <!-- PR 作成後に記入 --> |

## 責務

`manager.ts` の未カバーブランチ（running 状態のキュー検出・opts.engine/opts.employee 指定・engineOverride 戻し処理・コマンドのサブブランチ）をテストし、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/sessions/__tests__/manager.test.ts`（既存ファイルにテストケースを追加）

対象外（隣接 Task との境界）:

- fork.ts: TASK-093 で対応
- engine-runner.ts: TASK-097 で対応

## Epic から委ねられた詳細

- `maybeRevertEngineOverride` は `route` 経由でのみ呼ばれるため、間接的にテストする
- engineOverride.until が未来の場合は override が維持される（session.engine が変わらない）
- engineOverride.until が過去の場合は originalEngine に戻される（session.engine = originalEngine）
- Gemini エンジンの `/doctor` テストは `config.engines.gemini` が存在する場合のみ表示される

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E031-09**: `route` で session.status="running" + キュー実行中 + reactions 対応時に `clock1` リアクションが追加される
- [ ] **AC-E031-10**: `route` で `opts.engine` 指定時、新規セッションがその engine で作成される
- [ ] **AC-E031-11**: `route` で `opts.employee` 指定時、新規セッションがその employee で作成される
- [ ] **AC-E031-12**: `/new <text>` コマンド（スペースあり）でセッションがリセットされ true が返る
- [ ] **AC-E031-13**: `/status <text>` コマンド（スペースあり）でセッション情報が返信されて true が返る
- [ ] **AC-E031-14**: `/doctor` で Gemini 設定ありの場合、応答に Gemini 情報が含まれる
- [ ] **AC-E031-15**: `maybeRevertEngineOverride` で `engineOverride.until` が未来 → override 維持、過去 → originalEngine に戻る
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E031-09〜15）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `route`・`handleCommand`・`maybeRevertEngineOverride` | InMemorySessionRepository を使用 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | sessions — SessionManager |
| サブドメイン種別 | 汎用 |

- 参照 Epic 仕様書: ES-031 Story 2（AC-E031-09〜15）
- 参照コード: `src/sessions/manager.ts` §maybeRevertEngineOverride, §route, §handleCommand
- 参照コード: `src/sessions/__tests__/manager.test.ts`（既存テストのヘルパー関数を活用）

### 実装のヒント

**AC-E031-09: running + キュー実行中のリアクション:**
```typescript
it("status が running でキューが実行中かつ reactions 対応のとき clock1 を追加する", async () => {
  const session = sessionRepo.createSession({ engine: "claude", source: "telegram", sourceRef: "k1", sessionKey: "k1" });
  sessionRepo.updateSession(session.id, { status: "running" });
  // キューに先行タスクを積む（非同期）
  const connector = makeConnector({ getCapabilities: vi.fn().mockReturnValue({ reactions: true, threading: false, messageEdits: false, attachments: false }) });
  let resolveFirst!: () => void;
  vi.mocked(runSession).mockImplementationOnce(() => new Promise<void>((r) => { resolveFirst = r; }));
  manager.route(baseMsg as never, connector); // 先行タスクが待機中
  await new Promise((r) => setTimeout(r, 10)); // キューに入るまで待機
  vi.mocked(runSession).mockResolvedValue(undefined);
  await manager.route(baseMsg as never, connector);
  expect(vi.mocked(connector.addReaction)).toHaveBeenCalledWith(expect.anything(), "clock1");
  resolveFirst();
});
```

**AC-E031-15: engineOverride.until で originalEngine に戻す:**
```typescript
it("engineOverride.until が過去の場合 originalEngine に戻す", async () => {
  const session = sessionRepo.createSession({ engine: "codex", source: "telegram", sourceRef: "k-override", sessionKey: "k-override" });
  const pastUntil = new Date(Date.now() - 1000).toISOString();
  sessionRepo.updateSession(session.id, {
    transportMeta: {
      engineOverride: { originalEngine: "claude", until: pastUntil },
    },
  });
  await manager.route({ ...baseMsg, sessionKey: "k-override" } as never, makeConnector());
  const updated = unwrap(sessionRepo.getSessionBySessionKey("k-override"));
  expect(updated?.engine).toBe("claude");
});
```

## 依存

- 先行 Task: TASK-093（fork.ts テスト、独立しているため並行実行可）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E031-09〜15）が完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
