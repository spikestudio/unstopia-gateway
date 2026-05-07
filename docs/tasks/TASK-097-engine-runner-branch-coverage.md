# Task: [ES-031] Task 5 — engine-runner.ts 未カバーブランチ補完

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #223 |
| Epic 仕様書 | ES-031 |
| Story | 6 |
| Complexity | S |
| PR | <!-- PR 作成後に記入 --> |

## 責務

`engine-runner.ts` の主要な未カバーブランチ（エンジン不在・予算超過・cron ソース・`checkBudgetResult`）をテストし、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/sessions/__tests__/engine-runner.test.ts`（既存ファイルにテストケースを追加）

## Epic から委ねられた詳細

- `runSession` の呼び出しには多くのモックが必要（engine, connector, repos, config）
- `checkBudget` は `vi.mock("../../gateway/budgets.js")` でモックする
- `decorateMessages = session.source !== "cron"` 分岐: source="cron" のとき reactions を追加しない
- エンジン不在は `engines.get(session.engine)` が undefined を返すよう engines Map を空にする

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E031-26**: `runSession` でエンジンが存在しない場合、エラーメッセージがコネクターに返信されて処理が終了する
- [ ] **AC-E031-27**: `runSession` で予算が `paused` の場合、セッションが error ステータスに更新されコネクターにエラーメッセージが返信される
- [ ] **AC-E031-28**: `runSession` でセッションソースが `cron` の場合、reactions を追加しない（`addReaction` が呼ばれない）
- [ ] **AC-E031-29**: `checkBudgetResult` で budgetStatus="paused" のとき BUDGET_EXCEEDED エラーの Result が返る
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E031-26〜29）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `checkBudgetResult` | 純粋関数のため直接テスト可能 |
| 統合テスト（モックあり） | `runSession` エラーパス・cron | checkBudget・engines・connector をモック |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | sessions — engine-runner |
| サブドメイン種別 | 汎用 |

- 参照 Epic 仕様書: ES-031 Story 6（AC-E031-26〜29）
- 参照コード: `src/sessions/engine-runner.ts` §runSession（先頭部分）, §checkBudgetResult
- 参照コード: `src/sessions/__tests__/engine-runner.test.ts`（既存のモック構造を踏襲）

### 実装のヒント

**AC-E031-26: エンジン不在:**
```typescript
it("engines.get が undefined を返すとき、エラーメッセージがコネクターに返信される", async () => {
  const emptyEngines = new Map<string, Engine>();
  await runSession(session, msg, [], connector, target, emptyEngines, config, () => new Map(), undefined, repos);
  expect(vi.mocked(connector.replyMessage)).toHaveBeenCalledWith(
    expect.anything(),
    expect.stringContaining("not available"),
  );
});
```

**AC-E031-29: checkBudgetResult — 純粋関数テスト:**
```typescript
import { checkBudgetResult } from "../engine-runner.js";

describe("checkBudgetResult", () => {
  it("paused のとき BUDGET_EXCEEDED エラーを返す", () => {
    const result = checkBudgetResult("alice", {}, "paused");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BUDGET_EXCEEDED");
    }
  });

  it("ok のとき ok Result を返す", () => {
    const result = checkBudgetResult("alice", {}, "ok");
    expect(result.ok).toBe(true);
  });
});
```

## 依存

- 先行 Task: TASK-093（独立しているため並行実行可）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E031-26〜29）が完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
