# Task: [ES-027] Story 7 — resolver.ts: resolveEnvVar export 追加 + テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #181 |
| Epic 仕様書 | ES-027 |
| Story | S7 |
| Complexity | S |
| PR | #177 |

## 責務

`resolver.ts` の `resolveEnvVar` 関数に `export` を追加し、全 5 ブランチ（`${VAR}` / `$VAR` / 未設定 / プレーン文字列 / undefined）をユニットテストで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/mcp/resolver.ts`（`resolveEnvVar` への `export` 追加のみ）
- `packages/jimmy/src/mcp/__tests__/resolver.test.ts`（新規作成）

対象外（隣接 Task との境界）:

- TASK-064: `resolveMcpServers` / `buildAvailableServers` は別 Task（resolveEnvVar が export されていることを前提とする）
- TASK-065: `writeMcpConfigFile` / `cleanupMcpConfigFile` は別 Task

## Epic から委ねられた詳細

- **export 追加の方式（AC 仕様書 §未決定事項 #2 確定）**: `resolver.ts` の `function resolveEnvVar` を `export function resolveEnvVar` に変更して直接テストする方式を採用（Step 1 承認済み）
- **環境変数のモック**: `process.env` を `vi.stubEnv` または直接代入で制御し、テスト後に `vi.unstubAllEnvs()` でリストアする

## 完了条件

**機能面（AC-ID 参照）:**

- [x] **AC-E027-38**: `resolveEnvVar` に `${VAR_NAME}` 形式の文字列を渡すと、環境変数 `VAR_NAME` の値が返る
- [x] **AC-E027-39**: `resolveEnvVar` に `$VAR_NAME` 形式の文字列を渡すと、環境変数 `VAR_NAME` の値が返る
- [x] **AC-E027-40**: `resolveEnvVar` に `${VAR_NAME}` 形式で環境変数が未設定のとき `undefined` が返る
- [x] **AC-E027-41**: `resolveEnvVar` にプレーンな文字列（`$` なし）を渡すと、その文字列がそのまま返る
- [x] **AC-E027-42**: `resolveEnvVar` に `undefined` を渡すと `undefined` が返る
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E027-38〜42）

### 品質面

- [x] ユニットテストが追加・通過している（vitest）
- [x] コードレビューが承認されている
- [x] CI パイプラインがグリーン
- [x] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `resolveEnvVar`: 5 ブランチ（${} 形式 / $ 形式 / 未設定 / プレーン / undefined） | `vi.stubEnv` で環境変数をモック |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 純粋関数のため E2E 不要 | |

**テストファイル配置**: `packages/jimmy/src/mcp/__tests__/resolver.test.ts`

**環境変数モック方針**:

```ts
import { vi, afterEach } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); });

it("${VAR_NAME} 形式", () => {
  vi.stubEnv("MY_VAR", "my_value");
  expect(resolveEnvVar("${MY_VAR}")).toBe("my_value");
});
```

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（テスト専用 Epic） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-027 Story S7（AC-E027-38〜42）、§未決定事項 #2（export 追加の確定事項）
- 参照設計: `docs/domain/mcp-test-coverage-ac-mapping.md` §Part 2（AC-E027-38〜42 ドメイン要素マッピング）
- 参照 ADR: 該当なし
- 参照コード: `packages/jimmy/src/mcp/resolver.ts`（`resolveEnvVar` 関数末尾）

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E027-38〜42）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（依存なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
