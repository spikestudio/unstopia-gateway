# ES-027: src/mcp テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #176 |
| Phase 定義書 | PD-003 |
| Epic | E1 |
| 所属 BC | <!-- 該当なし（インフラ/テスト Epic） --> |
| ADR 参照 | <!-- 該当なし --> |

## 対応ストーリー

- S1: gateway-server.ts MCP プロトコルハンドリング（initialize/tools/list/tools/call）テスト
- S2: gateway-server.ts 全12ツールハンドラーテスト
- S3: resolver.ts resolveMcpServers テスト
- S4: resolver.ts buildAvailableServers 各サーバー種別テスト
- S5: resolver.ts writeMcpConfigFile/cleanupMcpConfigFile テスト
- S6: gateway-server.ts エラーハンドリングテスト
- S7: resolver.ts resolveEnvVar テスト

## 概要

`src/mcp` モジュール（`gateway-server.ts` / `resolver.ts`）のブランチカバレッジを現状 0% から 90% 以上に向上させる。gateway-server.ts は MCP プロトコル（JSON-RPC 2.0）のハンドリングと 12 種のツールハンドラーを実装しており、resolver.ts は MCP サーバー設定の解決・ファイル書き込み・環境変数展開を担う。

## ストーリーと受入基準

### Story 1: MCP プロトコルハンドリングテスト（S1）

> As a **開発者**, I want to `gateway-server.ts` の MCP プロトコルハンドリング（initialize / tools/list / tools/call）を自動テストで検証できる, so that MCP プロトコル仕様への準拠が回帰時に自動で検出される.

**受入基準:**

- [ ] **AC-E027-01**: `initialize` リクエストを送信すると、`protocolVersion: "2024-11-05"`・`capabilities.tools: {}`・`serverInfo.name: "jinn-gateway"` を含む JSON-RPC レスポンスが返る ← S1
- [ ] **AC-E027-02**: `tools/list` リクエストを送信すると、12 個のツール定義（name・description・inputSchema を含む）が `result.tools` 配列に返る ← S1
- [ ] **AC-E027-03**: `tools/call` リクエストで有効なツール名と引数を送信すると、`result.content[0].type === "text"` のレスポンスが返る ← S1
- [ ] **AC-E027-04**: `notifications/initialized` を送信すると、stdout への書き込みが発生しない（通知への応答不要が保証される）← S1（AI 補完: MCP 仕様上 notification は応答不要。この分岐の実装を明示的に検証する必要がある。sendResponse のスパイで観測可能）
- [ ] **AC-E027-05**: 未知のメソッドを送信すると、`error.code: -32601`（Method not found）を含む JSON-RPC エラーレスポンスが返る ← S1

### Story 2: 全12ツールハンドラーテスト（S2）

> As a **開発者**, I want to `gateway-server.ts` の全 12 ツールハンドラーが正しく gateway API を呼び出すことを自動テストで検証できる, so that ツールの引数マッピングや API 呼び出し先の回帰が検出される.

<!-- 注: 12 ツール × 1 AC の構成のため AC 数が 12 件となり通常の上限（8件）を超えるが、
     各ツールは独立した API エンドポイントに対応するため、これ以上細分化できない最小単位である。
     ストーリー分割（S2-a: メッセージ系、S2-b: セッション系 等）は Step 0 承認済みの範囲外のため見送る。 -->

**受入基準:**

- [ ] **AC-E027-06**: `send_message` ツールを呼び出すと、`/api/connectors/{connector}/send` に `channel`・`text` が POST される ← S2
- [ ] **AC-E027-07**: `list_sessions` ツールを `status` フィルター付きで呼び出すと、`/api/sessions` のレスポンスから該当ステータスのセッションのみが返る ← S2
- [ ] **AC-E027-08**: `get_session` ツールを呼び出すと、`/api/sessions/{sessionId}` の結果が返る ← S2
- [ ] **AC-E027-09**: `create_child_session` ツールを呼び出すと、`/api/sessions` に `employee`・`prompt` が POST される ← S2
- [ ] **AC-E027-10**: `send_to_session` ツールを呼び出すと、`/api/sessions/{sessionId}/message` に `message` が POST される ← S2
- [ ] **AC-E027-11**: `list_employees` ツールを呼び出すと、`/api/org` の結果が返る ← S2
- [ ] **AC-E027-12**: `get_employee` ツールを呼び出すと、`/api/org/employees/{name}` の結果が返る ← S2
- [ ] **AC-E027-13**: `update_board` ツールを呼び出すと、`/api/org/departments/{department}/board` に `board` が PUT される ← S2
- [ ] **AC-E027-14**: `get_board` ツールを呼び出すと、`/api/org/departments/{department}/board` の結果が返る ← S2
- [ ] **AC-E027-15**: `list_cron_jobs` ツールを呼び出すと、`/api/cron` の結果が返る ← S2
- [ ] **AC-E027-16**: `trigger_cron_job` ツールを `jobId` で呼び出すと、`/api/cron` から一致するジョブを検索し `triggered: true` が返る ← S2
- [ ] **AC-E027-17**: `update_cron_job` ツールを呼び出すと、`/api/cron/{jobId}` に指定フィールドが PUT される ← S2

### Story 3: resolveMcpServers テスト（S3）

> As a **開発者**, I want to `resolver.ts` の `resolveMcpServers` 関数の各ブランチを自動テストで検証できる, so that MCP サーバー設定の解決ロジックの回帰が検出される.

**受入基準:**

- [ ] **AC-E027-18**: `globalMcp` が `undefined` のとき `resolveMcpServers` は `{ mcpServers: {} }` を返す ← S3
- [ ] **AC-E027-19**: `employee.mcp === false` のとき `resolveMcpServers` は全サーバーを除外した `{ mcpServers: {} }` を返す ← S3
- [ ] **AC-E027-20**: `employee.mcp` が文字列配列のとき `resolveMcpServers` は指定サーバーのみを返す ← S3
- [ ] **AC-E027-21**: `employee.mcp` が指定されていないとき（デフォルト）`resolveMcpServers` は有効な全サーバーを返す ← S3

### Story 4: buildAvailableServers 各サーバー種別テスト（S4）

> As a **開発者**, I want to `resolver.ts` の `buildAvailableServers` 内部関数の各サーバー種別（browser / search / fetch / gateway / custom）のブランチを自動テストで検証できる, so that MCP サーバー追加・削除ロジックの回帰が検出される.

**受入基準:**

- [ ] **AC-E027-22**: `config.browser.enabled !== false`（デフォルト）かつ `provider: "playwright"` のとき `browser` サーバーが `@anthropic-ai/mcp-server-playwright` として登録される ← S4
- [ ] **AC-E027-23**: `config.browser.provider === "puppeteer"` のとき `browser` サーバーが `@anthropic-ai/mcp-server-puppeteer` として登録される ← S4
- [ ] **AC-E027-24**: `config.browser.enabled === false` のとき `browser` サーバーが登録されない ← S4
- [ ] **AC-E027-25**: `config.search.enabled === true` かつ `apiKey` が解決できるとき `search` サーバーが `BRAVE_API_KEY` 付きで登録される ← S4
- [ ] **AC-E027-26**: `config.search.enabled === true` かつ `apiKey` が未設定（解決不可）のとき `search` サーバーが登録されず警告ログが出力される ← S4（AI 補完: APIキー未設定時の警告ブランチはカバレッジ上重要なパスである）
- [ ] **AC-E027-27**: `config.fetch.enabled === true` のとき `fetch` サーバーが `@anthropic-ai/mcp-server-fetch` として登録される ← S4
- [ ] **AC-E027-28**: `config.gateway.enabled !== false`（デフォルト）のとき `gateway` サーバーが `node` コマンドで登録される ← S4
- [ ] **AC-E027-29**: `config.custom` にエントリが存在し `enabled !== false` かつ URL ベースのとき `type: "sse"` が付与されて登録される ← S4
- [ ] **AC-E027-30**: `config.custom` のエントリが `enabled === false` のとき登録されない ← S4（AI 補完: enabled フラグの除外ロジックは明示的にテストが必要）

### Story 5: writeMcpConfigFile / cleanupMcpConfigFile テスト（S5）

> As a **開発者**, I want to `resolver.ts` の `writeMcpConfigFile` / `cleanupMcpConfigFile` 関数を自動テストで検証できる, so that 一時ファイルの書き込み・削除の回帰が検出される.

**受入基準:**

- [ ] **AC-E027-31**: `writeMcpConfigFile` を呼び出すと `JINN_HOME/tmp/mcp/{sessionId}.json` が生成され、内容は渡した `ResolvedMcpConfig` と一致する ← S5
- [ ] **AC-E027-32**: `cleanupMcpConfigFile` を呼び出すと `JINN_HOME/tmp/mcp/{sessionId}.json` が削除される ← S5
- [ ] **AC-E027-33**: `cleanupMcpConfigFile` を存在しないセッションIDで呼び出してもエラーが発生しない（サイレント無視） ← S5（AI 補完: ファイル不在時のサイレント無視は明示的な仕様であり、テストで保証する必要がある）

### Story 6: エラーハンドリングテスト（S6）

> As a **開発者**, I want to `gateway-server.ts` のエラーハンドリング（ツールエラー・JSON パースエラー・API エラー）を自動テストで検証できる, so that エラー応答の形式が仕様通りであることが回帰時に検出される.

**受入基準:**

- [ ] **AC-E027-34**: 存在しないツール名で `tools/call` を呼び出すと、`result.isError: true` かつエラーメッセージを含む `content[0].text` が返る ← S6
- [ ] **AC-E027-35**: ツールハンドラーが例外をスローしたとき、`result.isError: true` かつ例外メッセージが `content[0].text` に含まれる ← S6
- [ ] **AC-E027-36**: gateway API が非 2xx レスポンスを返したとき、ツール呼び出しが `result.isError: true` のレスポンスを返す ← S6
- [ ] **AC-E027-37**: `trigger_cron_job` で存在しない jobId を指定すると `error: "Job not found"` を含む JSON が返る ← S6（AI 補完: trigger_cron_job の not-found ブランチは他のエラーハンドラーと異なりエラーではなく通常 result で返す実装になっており、明示的な検証が必要）

### Story 7: resolveEnvVar テスト（S7）

> As a **開発者**, I want to `resolver.ts` の `resolveEnvVar` 関数の全ブランチを自動テストで検証できる, so that 環境変数展開ロジックの回帰が検出される.

**受入基準:**

- [ ] **AC-E027-38**: `resolveEnvVar` に `${VAR_NAME}` 形式の文字列を渡すと、環境変数 `VAR_NAME` の値が返る ← S7
- [ ] **AC-E027-39**: `resolveEnvVar` に `$VAR_NAME` 形式の文字列を渡すと、環境変数 `VAR_NAME` の値が返る ← S7
- [ ] **AC-E027-40**: `resolveEnvVar` に `${VAR_NAME}` 形式で環境変数が未設定のとき `undefined` が返る ← S7
- [ ] **AC-E027-41**: `resolveEnvVar` にプレーンな文字列（`$` なし）を渡すと、その文字列がそのまま返る ← S7
- [ ] **AC-E027-42**: `resolveEnvVar` に `undefined` を渡すと `undefined` が返る ← S7（AI 補完: undefined ガードは実装にあるが、テストで明示的に検証されていない）

**インターフェース:** なし（テスト専用 Epic、外部インターフェース変更なし）

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| AC マッピングマトリクス | `docs/domain/mcp-test-coverage-ac-mapping.md` | 生成済み（G3 Step 1） |
| ドメインモデル詳細 | 該当なし（テスト専用 Epic） | — |
| 集約モデル詳細 | 該当なし | — |
| DB スキーマ骨格 | 該当なし | — |
| API spec 骨格 | 該当なし | — |

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| （テスト Epic のためバリデーションルールなし） | — | — |

## ステータス遷移（該当する場合）

該当なし（テスト Epic）

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| 不正な JSON 行 | stdin に JSON でない行が届く | エラーを無視（サイレントスキップ） | gateway-server.ts の readline ハンドラー |
| 未知ツール名 | `tools/call` に未知の name | `result.isError: true` で応答 | handleTool の default ケース |
| API 非 2xx | fetch の応答が非 2xx | `result.isError: true` で応答 | apiGet/apiPost のエラー伝播 |
| クリーンアップ対象ファイル不在 | `cleanupMcpConfigFile` でファイルなし | エラーを無視（サイレント） | try-catch でラップ済み |

## 非機能要件

| 項目 | 基準 |
|------|------|
| ブランチカバレッジ | `src/mcp` モジュール全体で 90% 以上 |
| テスト実行時間 | 全テストが 30 秒以内に完了する |
| 外部依存 | `fetch` は vi.fn() / msw でモックし、ネットワーク不要 |
| ファイルシステム | `JINN_HOME` は `os.tmpdir()` 配下の一時ディレクトリを使用し、テスト後にクリーンアップ |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 後続 Epic の開発者・CI パイプライン |
| デリバリーする価値 | `src/mcp` の全ロジックが自動テストでカバーされ、MCP プロトコル実装・サーバー設定解決・ファイル管理の回帰が CI で自動検出される |
| デモシナリオ | `pnpm test --filter=jimmy` を実行し `src/mcp` のブランチカバレッジが 90% 以上と表示される |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | 全 42 AC をユニットテストで自動検証。カバレッジレポートで 90% 以上を確認 |
| 検証環境 | ローカル CI（vitest + c8 カバレッジ）。ネットワーク不要（fetch モック） |
| 前提条件 | `pnpm build` 不要（テストは TypeScript ソースを直接実行）、`JINN_HOME` は一時ディレクトリを使用 |

## 他 Epic への依存・影響

- **依存なし**: このテスト Epic は実装変更を伴わないため、他 Epic への影響はない
- **後続 Epic への貢献**: Phase 3 の全体ブランチカバレッジ 90% 達成に貢献する

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `gateway-server.ts` の stdin/stdout は process.stdin/stdout 依存のため、ユニットテストでのモック方法（readline モック vs ヘルパー関数切り出し）| **確定**: `handleRequest` を直接呼び出し、`sendResponse` をスパイしてモックする方式を採用（Step 1 承認済み） | — |
| 2 | `resolver.ts` の `resolveEnvVar` はファイル内部 unexported 関数のため、テスト方法（再エクスポート vs 内部アクセス）| **確定**: `resolver.ts` に `export` を追加して直接テストする方式を採用（Step 1 承認済み） | — |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている（テスト Epic のため該当なし）
- [x] ステータス遷移が図示されている（テスト Epic のため該当なし）
- [x] 権限が各操作で明記されている（テスト Epic のため該当なし）
- [x] 関連 ADR が参照されている（該当なし）
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-ENNN-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [x] 所属 BC が記載され、BC キャンバスが docs/domain/ に存在する（テスト Epic のため BC なし）
- [x] 設計成果物セクションが記入されている（該当なし）
