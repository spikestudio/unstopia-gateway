# Task: [ES-031] Task 1 — fork.ts テスト追加

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #219 |
| Epic 仕様書 | ES-031 |
| Story | 1 |
| Complexity | S |
| PR | <!-- PR 作成後に記入 --> |

## 責務

`fork.ts` の Codex/Gemini フォーク機能（0% → 90% 以上）に対するテストを追加する。
一時ディレクトリを使用して実ファイルシステム操作を検証し、エラーケースもカバーする。

## スコープ

対象ファイル:

- `packages/jimmy/src/sessions/__tests__/fork.test.ts`（新規作成）

対象外（隣接 Task との境界）:

- `forkClaudeSession`: 実 `claude` バイナリが必要なため本 Task では対象外とする（AC に含まない）
- manager.ts / engine-runner.ts: TASK-094, TASK-097 で対応

## Epic から委ねられた詳細

- Codex/Gemini テストは `os.tmpdir()` 以下に一時ディレクトリを作成し、`~/.codex` / `~/.gemini` を汚染しない
- Gemini のファイル名は `session-<ts>-<uuid-prefix>.json` 形式（sessionId の先頭8文字）
- JSONL メタ書き換え: 先頭行の `payload.id` が存在する場合は新しい UUID で置換される（AC-E031-08）
- `forkEngineSession` は `engine="claude"` を渡すと `forkClaudeSession` に委譲するため、claude は別モック戦略が必要。本 Task では codex/gemini/unknown のみテストする

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E031-01**: `forkCodexSession` が正常動作（新 UUID ファイル作成・返り値確認）
- [ ] **AC-E031-02**: `forkCodexSession` でファイル不在時エラースロー
- [ ] **AC-E031-03**: `forkGeminiSession` が正常動作（新 UUID・startTime 更新確認）
- [ ] **AC-E031-04**: `forkGeminiSession` でファイル不在時エラースロー
- [ ] **AC-E031-05**: `forkEngineSession("codex", ...)` が `forkCodexSession` に委譲
- [ ] **AC-E031-06**: `forkEngineSession("gemini", ...)` が `forkGeminiSession` に委譲
- [ ] **AC-E031-07**: `forkEngineSession("unknown", ...)` が `Unsupported engine for fork` エラー
- [ ] **AC-E031-08**: Codex の JSONL 先頭行 `payload.id` が新 UUID で置換される
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E031-01〜08）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| 統合テスト（ファイルシステム） | `forkCodexSession`, `forkGeminiSession` | `os.tmpdir()` 以下の一時ディレクトリを使用 |
| ユニットテスト | `forkEngineSession` の switch 分岐 | codex/gemini は vi.fn() でスパイ化、unknown はエラー確認 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | sessions — セッションフォーク |
| サブドメイン種別 | 汎用 |

- 参照 Epic 仕様書: ES-031 Story 1（AC-E031-01〜08）
- 参照コード: `src/sessions/fork.ts` 全体

### 実装のヒント

**Codex テストのセットアップ:**
```typescript
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tmpRoot: string;
let codexRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fork-test-"));
  codexRoot = path.join(tmpRoot, ".codex", "sessions");
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

**Codex セッションファイル作成例:**
```typescript
const sessionId = "test-session-uuid";
const sessDir = path.join(codexRoot, "2026", "04", "28");
fs.mkdirSync(sessDir, { recursive: true });
const meta = { payload: { id: sessionId }, timestamp: new Date().toISOString() };
const content = `${JSON.stringify(meta)}\n{"type":"message"}\n`;
fs.writeFileSync(path.join(sessDir, `rollout-2026-04-28T00-00-00-${sessionId}.jsonl`), content);

// モンキーパッチ: os.homedir() を一時ディレクトリに向ける
vi.spyOn(os, "homedir").mockReturnValue(tmpRoot);
```

**Gemini セッションファイル作成例:**
```typescript
const sessionId = "abcdef01-0000-0000-0000-000000000000";
const chatsDir = path.join(tmpRoot, ".gemini", "tmp", "proj-hash", "chats");
fs.mkdirSync(chatsDir, { recursive: true });
const data = {
  sessionId,
  startTime: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  messages: [{ id: "msg-001", text: "hello" }],
};
const prefix = sessionId.slice(0, 8);
fs.writeFileSync(path.join(chatsDir, `session-2026-04-28T00-00-${prefix}.json`), JSON.stringify(data, null, 2));
```

## 依存

- 先行 Task: なし

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E031-01〜08）が完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 規約ドキュメント（testing.md・prohibitions.md）にこの Task で使う規約が記載されている
