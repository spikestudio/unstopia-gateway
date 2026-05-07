# Task: [ES-027] Story 3・4 — resolver.ts: resolveMcpServers / buildAvailableServers テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #182 |
| Epic 仕様書 | ES-027 |
| Story | S3, S4 |
| Complexity | L |
| PR | #177 |

## 責務

`resolver.ts` の `resolveMcpServers`（S3: 4 AC）と `buildAvailableServers`（S4: 9 AC）の全ブランチをユニットテストで検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/mcp/__tests__/resolver.test.ts`（TASK-063 で作成済みのファイルに追記）

対象外（隣接 Task との境界）:

- TASK-063: `resolveEnvVar` は別 Task（本 Task では `resolveEnvVar` が export 済みであることを前提とする）
- TASK-065: `writeMcpConfigFile` / `cleanupMcpConfigFile` は別 Task

## Epic から委ねられた詳細

- **`buildAvailableServers` のモック方式**: `resolver.ts` は `buildAvailableServers` が unexported のため、`resolveMcpServers` 経由でテストする（または `vi.spyOn` でモジュール内部を観測）。`globalMcp` 設定を変えてテストすることで各 `buildAvailableServers` の分岐をカバーする
- **`logger.warn` のスパイ（AC-E027-26）**: `vi.spyOn(logger, "warn")` で警告ログの呼び出しを確認する
- **ファイルシステム依存（`gateway` サーバー設定）**: `buildAvailableServers` 内の `gateway` サーバー設定は `fs.existsSync` を呼ぶ。`vi.mock("node:fs")` または実際のファイルパスが存在しないことを前提にして `scriptPath` フォールバックの動作を確認する
- **`import.meta.url` の取り扱い**: テスト環境では `import.meta.url` が通常のテストファイル URL になるため、`gateway` サーバーのパス解決の結果は environment によって異なる。AC-E027-28 の検証では「`command: "node"` が設定されること」を確認すれば十分

## 完了条件

**機能面（AC-ID 参照）:**

- [x] **AC-E027-18**: `globalMcp` が `undefined` のとき `resolveMcpServers` は `{ mcpServers: {} }` を返す
- [x] **AC-E027-19**: `employee.mcp === false` のとき `resolveMcpServers` は全サーバーを除外した `{ mcpServers: {} }` を返す
- [x] **AC-E027-20**: `employee.mcp` が文字列配列のとき `resolveMcpServers` は指定サーバーのみを返す
- [x] **AC-E027-21**: `employee.mcp` が指定されていないとき（デフォルト）`resolveMcpServers` は有効な全サーバーを返す
- [x] **AC-E027-22**: `config.browser.enabled !== false`（デフォルト）かつ `provider: "playwright"` のとき `browser` サーバーが `@anthropic-ai/mcp-server-playwright` として登録される
- [x] **AC-E027-23**: `config.browser.provider === "puppeteer"` のとき `browser` サーバーが `@anthropic-ai/mcp-server-puppeteer` として登録される
- [x] **AC-E027-24**: `config.browser.enabled === false` のとき `browser` サーバーが登録されない
- [x] **AC-E027-25**: `config.search.enabled === true` かつ `apiKey` が解決できるとき `search` サーバーが `BRAVE_API_KEY` 付きで登録される
- [x] **AC-E027-26**: `config.search.enabled === true` かつ `apiKey` が未設定（解決不可）のとき `search` サーバーが登録されず警告ログが出力される
- [x] **AC-E027-27**: `config.fetch.enabled === true` のとき `fetch` サーバーが `@anthropic-ai/mcp-server-fetch` として登録される
- [x] **AC-E027-28**: `config.gateway.enabled !== false`（デフォルト）のとき `gateway` サーバーが `node` コマンドで登録される
- [x] **AC-E027-29**: `config.custom` にエントリが存在し `enabled !== false` かつ URL ベースのとき `type: "sse"` が付与されて登録される
- [x] **AC-E027-30**: `config.custom` のエントリが `enabled === false` のとき登録されない
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E027-18〜30）

### 品質面

- [x] ユニットテストが追加・通過している（vitest）
- [x] コードレビューが承認されている
- [x] CI パイプラインがグリーン
- [x] リンター/静的解析がクリーン（biome-ignore 禁止）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `resolveMcpServers`: 4 ブランチ（AC-E027-18〜21）+ `buildAvailableServers` を通じた各サーバー種別 9 ブランチ（AC-E027-22〜30） | `vi.spyOn(logger, "warn")` で警告ログ確認 |
| ドメインロジックテスト | 該当なし | テスト専用 Epic |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: 純粋関数（ファイルシステム呼び出し除く）のため E2E 不要 | |

**モック方針**:

```ts
import { vi } from "vitest";
import { logger } from "../../shared/logger.js";

vi.spyOn(logger, "warn").mockImplementation(() => {});
vi.stubEnv("BRAVE_API_KEY", "test-key"); // AC-E027-25 用
```

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（テスト専用 Epic） |
| サブドメイン種別 | 支援: テスト追加 |

- 参照 Epic 仕様書: ES-027 Story S3（AC-E027-18〜21）・S4（AC-E027-22〜30）
- 参照設計: `docs/domain/mcp-test-coverage-ac-mapping.md` §Part 2（AC-E027-18〜30 ドメイン要素マッピング）
- 参照 ADR: 該当なし
- 参照コード: `packages/jimmy/src/mcp/resolver.ts`（`resolveMcpServers`・`buildAvailableServers` 関数）

## 依存

- 先行 Task: TASK-063（`resolveEnvVar` が export 済みであること。ただし本 Task は `resolver.ts` 内部の `buildAvailableServers` 経由で `resolveEnvVar` を間接的に呼ぶため、TASK-063 のファイルが存在することが前提）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E027-18〜30）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（L: ~800 行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task（TASK-063）が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
