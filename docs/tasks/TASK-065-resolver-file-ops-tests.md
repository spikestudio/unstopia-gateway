# Task: [ES-027] Story 5 — resolver.ts: writeMcpConfigFile / cleanupMcpConfigFile テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #183 |
| Epic 仕様書 | ES-027 |
| Story | S5 |
| Complexity | S |
| PR | #177 |

## 責務

`resolver.ts` の `writeMcpConfigFile` / `cleanupMcpConfigFile` 関数を、一時ディレクトリを使ったファイルシステム操作のユニットテストで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/mcp/__tests__/resolver.test.ts`（TASK-063/064 で作成済みのファイルに追記）

対象外（隣接 Task との境界）:

- TASK-063: `resolveEnvVar` テストは別 Task
- TASK-064: `resolveMcpServers` / `buildAvailableServers` テストは別 Task

## Epic から委ねられた詳細

- **JINN_HOME の一時ディレクトリ化**: テスト内で `process.env.JINN_HOME` を `os.tmpdir()` 配下の一意なディレクトリに置き換え、テスト後に `fs.rmSync` でクリーンアップする。`JINN_HOME` 定数は `shared/paths.ts` からインポートされており、テスト前に環境変数を設定してから resolver をインポートする（または `vi.mock`）
- **実際のファイルシステム操作**: `fs.writeFileSync` / `fs.unlinkSync` は実際のファイルシステムを使用する（`node:fs` のモックは不要）。`os.tmpdir()` 配下の安全な場所を使う
- **AC-E027-33（ファイル不在でのクリーンアップ）**: 存在しないセッションIDで `cleanupMcpConfigFile` を呼び出し、例外が発生しないことを `expect(() => ...).not.toThrow()` で確認する

## 完了条件

**機能面（AC-ID 参照）:**

- [x] **AC-E027-31**: `writeMcpConfigFile` を呼び出すと `JINN_HOME/tmp/mcp/{sessionId}.json` が生成され、内容は渡した `ResolvedMcpConfig` と一致する
- [x] **AC-E027-32**: `cleanupMcpConfigFile` を呼び出すと `JINN_HOME/tmp/mcp/{sessionId}.json` が削除される
- [x] **AC-E027-33**: `cleanupMcpConfigFile` を存在しないセッションIDで呼び出してもエラーが発生しない（サイレント無視）
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E027-31〜33）

### 品質面

- [x] ユニットテストが追加・通過している（vitest）
- [x] コードレビューが承認されている
- [x] CI パイプラインがグリーン
- [x] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `writeMcpConfigFile`: ファイル生成・内容確認 / `cleanupMcpConfigFile`: ファイル削除・不在時サイレント | 実際の一時ディレクトリを使用。テスト後にクリーンアップ |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: ファイルシステム操作のみ、サービス連携なし | |

**テスト構造**:

```ts
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

let tmpJinnHome: string;

beforeEach(() => {
  tmpJinnHome = fs.mkdtempSync(path.join(os.tmpdir(), "jinn-test-"));
  vi.stubEnv("JINN_HOME", tmpJinnHome);
});

afterEach(() => {
  fs.rmSync(tmpJinnHome, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
```

注意: `JINN_HOME` 定数は `shared/paths.ts` でモジュールロード時に確定するため、`vi.mock` を使うか、動的インポートで解決する必要がある場合は実装者が判断する。

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（テスト専用 Epic） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-027 Story S5（AC-E027-31〜33）・§非機能要件（JINN_HOME 一時ディレクトリ使用）
- 参照設計: `docs/domain/mcp-test-coverage-ac-mapping.md` §Part 2（AC-E027-31〜33 ドメイン要素マッピング）
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/mcp/resolver.ts`（`writeMcpConfigFile`・`cleanupMcpConfigFile` 関数）
  - `packages/jimmy/src/shared/paths.ts`（`JINN_HOME` 定数の定義）

## 依存

- 先行 Task: --（`resolver.ts` への変更は TASK-063 で `resolveEnvVar` の export 追加のみであり、ファイル操作関数はそれ以前から export 済み）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E027-31〜33）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（依存なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
