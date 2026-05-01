# Task: [ES-033] Story 1.3 — watcher.ts テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #239 |
| Epic 仕様書 | ES-033 |
| Story | 1.3 |
| Complexity | M |
| PR | #TBD |

## 責務

`src/gateway/watcher.ts` の関数（`syncSkillSymlinks` / `startWatchers` / `stopWatchers`）のユニットテストを追加し、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/__tests__/watcher.test.ts`（新規作成）
- `packages/jimmy/src/gateway/watcher.ts`（読み取りのみ、変更なし・140 行）

対象外（隣接 Task との境界）:

- lifecycle.ts のテスト: TASK-107 が担当
- files.ts のテスト: TASK-108 が担当
- chokidar イベントの実際のファイルシステム変更トリガー: vi.mock でウォッチャー自体をモックして制御する

## Epic から委ねられた詳細

- chokidar の `watch()` は `vi.mock("chokidar")` でモックし、`FSWatcher` 型のフェイクを返す（AC-E033-24）
- フェイク FSWatcher: `on: vi.fn().mockReturnThis()` / `close: vi.fn().mockResolvedValue(undefined)` の形式
- `syncSkillSymlinks()` のシンボリックリンク作成（AC-E033-21）: `node:fs` をモックして `readdirSync`（skills ディレクトリ）と `existsSync`（リンク存在確認）を制御する
- ストールリンク除去（AC-E033-22）: `readdirSync(targetDir)` が削除対象のエントリを返し、`skillNames` に含まれない名前であれば `unlinkSync` が呼ばれることを確認する
- skills ディレクトリ不在（AC-E033-23）: `fs.existsSync(SKILLS_DIR)` が `false` を返すようにモックして、エラーなく完了することを確認する
- `stopWatchers()` の冪等性（AC-E033-25）: `stopWatchers()` を 2 回呼んでもエラーにならないことを確認する（2 回目は空配列の `Promise.all` になる）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E033-20: `watcher.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E033-21: `syncSkillSymlinks()` を呼び出すと `.claude/skills/` と `.agents/skills/` に `skills/` のサブディレクトリへのシンボリックリンクが作成される
- [ ] AC-E033-22: `syncSkillSymlinks()` で既存のシンボリックリンクが `skills/` に存在しないスキル名のものは削除される（ストールリンク除去）
- [ ] AC-E033-23: `syncSkillSymlinks()` で `skills/` ディレクトリが存在しない場合にエラーなく完了する
- [ ] AC-E033-24: `startWatchers()` を呼び出してから `stopWatchers()` を呼び出すとウォッチャーが正常に停止する
- [ ] AC-E033-25: `stopWatchers()` を複数回呼び出してもエラーにならない
- [ ] Epic 仕様書の AC-E033-20〜25 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `syncSkillSymlinks` の全分岐（スキルあり・なし・ストールリンク） / `startWatchers` / `stopWatchers` の冪等性 | `chokidar` / `node:fs` をモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: ウォッチャー管理の単体ロジックテスト。E2E は TASK-111 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway（HTTP サーバー・ライフサイクル管理層） |
| サブドメイン種別 | 支援 — 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-033 §Story 1.3 AC-E033-20〜25
- 参照コード: `packages/jimmy/src/gateway/watcher.ts`（全体 140 行）

**モック対象一覧:**

```typescript
vi.mock("chokidar", () => ({
  watch: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  })
}))
vi.mock("node:fs")
vi.mock("node:path")
vi.mock("../shared/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))
vi.mock("../shared/paths.js", () => ({
  CLAUDE_SKILLS_DIR: "/tmp/.claude/skills",
  AGENTS_SKILLS_DIR: "/tmp/.agents/skills",
  SKILLS_DIR: "/tmp/skills",
  CONFIG_PATH: "/tmp/config.yaml",
  CRON_JOBS: "/tmp/cron/jobs.json",
  ORG_DIR: "/tmp/org",
}))
```

**ストールリンク除去テストの構成:**

```typescript
// readdirSync(SKILLS_DIR) → skillNames = ["skill-a"]
// readdirSync(targetDir) → existing = [{ name: "skill-b", ... }] (ストール)
// unlinkSync("/tmp/.claude/skills/skill-b") が呼ばれることを確認
```

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
