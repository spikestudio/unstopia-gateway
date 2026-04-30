# AC マッピングマトリクス — ES-027: src/mcp テストカバレッジ向上

## 概要

- Epic: ES-027
- 対象ファイル: `src/mcp/gateway-server.ts` / `src/mcp/resolver.ts`
- 総 AC 件数: 42 件
- 生成日: 2026-04-28

> **テスト専用 Epic の特性**: このEpicは既存実装の振る舞いを自動テストで検証するもの。
> 新規ドメインモデル・DB スキーマ・API スキーマの変更はない。
> 全 AC は「実装の振る舞いが仕様通りであることを検証するテストケース」として解釈する。

---

## Part 1: AC パターン分類

### パターン分類テーブル

| AC-ID | AC 概要 | 分類パターン |
|-------|---------|------------|
| AC-E027-01 | `initialize` リクエストで protocolVersion・capabilities・serverInfo が正しく返る | 操作 |
| AC-E027-02 | `tools/list` で 12 個のツール定義が返る | 操作 |
| AC-E027-03 | `tools/call` で有効ツールを呼び出すと `content[0].type === "text"` のレスポンスが返る | 操作 |
| AC-E027-04 | `notifications/initialized` を送信すると stdout への書き込みが発生しない | 不変条件 |
| AC-E027-05 | 未知メソッドで `error.code: -32601` が返る | 不変条件 |
| AC-E027-06 | `send_message` が `/api/connectors/{connector}/send` に POST する | 操作 |
| AC-E027-07 | `list_sessions` が `status` フィルターで結果を絞り込む | 操作（+ 計算ロジック） |
| AC-E027-08 | `get_session` が `/api/sessions/{sessionId}` の結果を返す | 操作 |
| AC-E027-09 | `create_child_session` が `/api/sessions` に POST する | 操作 |
| AC-E027-10 | `send_to_session` が `/api/sessions/{sessionId}/message` に POST する | 操作 |
| AC-E027-11 | `list_employees` が `/api/org` の結果を返す | 操作 |
| AC-E027-12 | `get_employee` が `/api/org/employees/{name}` の結果を返す | 操作 |
| AC-E027-13 | `update_board` が `/api/org/departments/{department}/board` に PUT する | 操作 |
| AC-E027-14 | `get_board` が `/api/org/departments/{department}/board` の結果を返す | 操作 |
| AC-E027-15 | `list_cron_jobs` が `/api/cron` の結果を返す | 操作 |
| AC-E027-16 | `trigger_cron_job` が jobId でジョブを検索し `triggered: true` を返す | 操作（+ 計算ロジック） |
| AC-E027-17 | `update_cron_job` が `/api/cron/{jobId}` に指定フィールドを PUT する | 操作 |
| AC-E027-18 | `globalMcp` が `undefined` のとき `{ mcpServers: {} }` を返す | 不変条件 |
| AC-E027-19 | `employee.mcp === false` のとき全サーバーを除外する | 不変条件 |
| AC-E027-20 | `employee.mcp` が文字列配列のとき指定サーバーのみ返す | 計算ロジック |
| AC-E027-21 | `employee.mcp` 未指定のとき有効な全サーバーを返す | 不変条件 |
| AC-E027-22 | `browser.provider: "playwright"` のとき playwright が登録される | 不変条件 |
| AC-E027-23 | `browser.provider === "puppeteer"` のとき puppeteer が登録される | 不変条件 |
| AC-E027-24 | `browser.enabled === false` のとき browser が登録されない | 不変条件 |
| AC-E027-25 | `search.enabled + apiKey` が有効のとき search サーバーが登録される | 不変条件 |
| AC-E027-26 | `search.enabled` だが `apiKey` が未設定のとき search が登録されず警告ログが出力される | 不変条件（+ 操作） |
| AC-E027-27 | `fetch.enabled === true` のとき fetch サーバーが登録される | 不変条件 |
| AC-E027-28 | `gateway.enabled !== false`（デフォルト）のとき gateway サーバーが登録される | 不変条件 |
| AC-E027-29 | `custom` エントリが有効かつ URL ベースのとき `type: "sse"` が付与されて登録される | 不変条件（+ 計算ロジック） |
| AC-E027-30 | `custom` エントリが `enabled === false` のとき登録されない | 不変条件 |
| AC-E027-31 | `writeMcpConfigFile` が `JINN_HOME/tmp/mcp/{sessionId}.json` を生成する | 操作 |
| AC-E027-32 | `cleanupMcpConfigFile` がファイルを削除する | 操作 |
| AC-E027-33 | `cleanupMcpConfigFile` を存在しないセッションIDで呼び出してもエラーが発生しない | 不変条件 |
| AC-E027-34 | 存在しないツール名で `result.isError: true` が返る | 不変条件 |
| AC-E027-35 | ツールハンドラーが例外をスローしたとき `result.isError: true` が返る | 不変条件 |
| AC-E027-36 | gateway API が非 2xx のとき `result.isError: true` が返る | 不変条件 |
| AC-E027-37 | `trigger_cron_job` で存在しない jobId を指定すると `error: "Job not found"` を含む JSON が返る | 不変条件 |
| AC-E027-38 | `resolveEnvVar` に `${VAR_NAME}` 形式を渡すと env 値が返る | 操作（+ 計算ロジック） |
| AC-E027-39 | `resolveEnvVar` に `$VAR_NAME` 形式を渡すと env 値が返る | 操作（+ 計算ロジック） |
| AC-E027-40 | `resolveEnvVar` に `${VAR_NAME}` で未設定のとき `undefined` が返る | 不変条件 |
| AC-E027-41 | `resolveEnvVar` にプレーン文字列を渡すとそのまま返る | 不変条件 |
| AC-E027-42 | `resolveEnvVar` に `undefined` を渡すと `undefined` が返る | バリデーション |

### パターン分布

| パターン | AC 件数 |
|---------|--------|
| 操作 | 15 件（AC-01〜03, 06〜17, 31〜32, 38〜39） |
| 不変条件 | 24 件（AC-04〜05, 18〜30, 33〜37, 40〜41） |
| 計算ロジック | 2 件（AC-20, 16 は操作主で計算ロジック補足） |
| バリデーション | 1 件（AC-42） |

---

## Part 2: AC-ドメイン要素マッピングマトリクス

> **テスト専用 Epic における「ドメイン要素」の解釈**:
> このEpicは実装変更なし（外部インターフェースなし）のため、
> 通常の「集約・エンティティ・値オブジェクト・ドメインサービス」に相当するものはない。
> 代わりに「被テスト関数/モジュール」をドメイン要素として扱い、
> テストが検証する「ロジックセット」を「要素種別」として記録する。

| AC-ID | AC 概要 | ドメイン要素（被テスト関数/モジュール） | 要素種別 |
|-------|---------|--------------------------------------|---------|
| AC-E027-01 | `initialize` リクエストで正しいレスポンスが返る | `gateway-server.handleRequest` | 操作 |
| AC-E027-02 | `tools/list` で 12 ツール定義が返る | `gateway-server.handleRequest` | 操作 |
| AC-E027-03 | `tools/call` で `content[0].type === "text"` が返る | `gateway-server.handleRequest` + `handleTool` | 操作 |
| AC-E027-04 | `notifications/initialized` で stdout 書き込みなし | `gateway-server.handleRequest` | 不変条件（MCP 仕様: 通知は応答不要） |
| AC-E027-05 | 未知メソッドで `-32601` が返る | `gateway-server.handleRequest` | 不変条件（JSON-RPC エラーコード仕様） |
| AC-E027-06 | `send_message` が `/api/connectors/{connector}/send` に POST | `gateway-server.handleTool["send_message"]` | 操作 |
| AC-E027-07 | `list_sessions` が `status` フィルターで絞り込む | `gateway-server.handleTool["list_sessions"]` | 操作（+ 計算ロジック: フィルタリング） |
| AC-E027-08 | `get_session` が `/api/sessions/{sessionId}` を返す | `gateway-server.handleTool["get_session"]` | 操作 |
| AC-E027-09 | `create_child_session` が `/api/sessions` に POST | `gateway-server.handleTool["create_child_session"]` | 操作 |
| AC-E027-10 | `send_to_session` が `/api/sessions/{sessionId}/message` に POST | `gateway-server.handleTool["send_to_session"]` | 操作 |
| AC-E027-11 | `list_employees` が `/api/org` を返す | `gateway-server.handleTool["list_employees"]` | 操作 |
| AC-E027-12 | `get_employee` が `/api/org/employees/{name}` を返す | `gateway-server.handleTool["get_employee"]` | 操作 |
| AC-E027-13 | `update_board` が `/api/org/departments/{department}/board` に PUT | `gateway-server.handleTool["update_board"]` | 操作 |
| AC-E027-14 | `get_board` が `/api/org/departments/{department}/board` を返す | `gateway-server.handleTool["get_board"]` | 操作 |
| AC-E027-15 | `list_cron_jobs` が `/api/cron` を返す | `gateway-server.handleTool["list_cron_jobs"]` | 操作 |
| AC-E027-16 | `trigger_cron_job` が jobId でジョブを検索し `triggered: true` を返す | `gateway-server.handleTool["trigger_cron_job"]` | 操作（+ 計算ロジック: job lookup） |
| AC-E027-17 | `update_cron_job` が `/api/cron/{jobId}` に PUT | `gateway-server.handleTool["update_cron_job"]` | 操作 |
| AC-E027-18 | `globalMcp === undefined` のとき `{ mcpServers: {} }` を返す | `resolver.resolveMcpServers` | 不変条件（early return ガード） |
| AC-E027-19 | `employee.mcp === false` のとき全除外 | `resolver.resolveMcpServers` | 不変条件（opt-out ロジック） |
| AC-E027-20 | `employee.mcp` が配列のとき指定サーバーのみ | `resolver.resolveMcpServers` | 計算ロジック（フィルタリング） |
| AC-E027-21 | `employee.mcp` 未指定のとき全サーバー | `resolver.resolveMcpServers` | 不変条件（デフォルト挙動） |
| AC-E027-22 | `browser.provider: "playwright"` で playwright 登録 | `resolver.buildAvailableServers` | 不変条件（provider 分岐） |
| AC-E027-23 | `browser.provider === "puppeteer"` で puppeteer 登録 | `resolver.buildAvailableServers` | 不変条件（provider 分岐） |
| AC-E027-24 | `browser.enabled === false` で browser 未登録 | `resolver.buildAvailableServers` | 不変条件（enabled フラグ） |
| AC-E027-25 | `search.enabled + apiKey` 有効で search 登録 | `resolver.buildAvailableServers` | 不変条件（条件付き登録） |
| AC-E027-26 | `search.enabled` だが `apiKey` 未設定で search 未登録 + 警告 | `resolver.buildAvailableServers` | 不変条件（フォールバック + 副作用） |
| AC-E027-27 | `fetch.enabled === true` で fetch 登録 | `resolver.buildAvailableServers` | 不変条件（enabled フラグ） |
| AC-E027-28 | `gateway.enabled !== false` で gateway 登録 | `resolver.buildAvailableServers` | 不変条件（デフォルト有効） |
| AC-E027-29 | custom エントリが URL ベースで `type: "sse"` 付与 | `resolver.buildAvailableServers` | 不変条件（+ 計算ロジック: URL 判定） |
| AC-E027-30 | custom エントリが `enabled === false` で除外 | `resolver.buildAvailableServers` | 不変条件（enabled フラグ） |
| AC-E027-31 | `writeMcpConfigFile` がファイルを生成する | `resolver.writeMcpConfigFile` | 操作 |
| AC-E027-32 | `cleanupMcpConfigFile` がファイルを削除する | `resolver.cleanupMcpConfigFile` | 操作 |
| AC-E027-33 | `cleanupMcpConfigFile` でファイル不在でもエラーなし | `resolver.cleanupMcpConfigFile` | 不変条件（サイレント無視） |
| AC-E027-34 | 存在しないツール名で `result.isError: true` | `gateway-server.handleRequest["tools/call"]` | 不変条件（Unknown tool エラー） |
| AC-E027-35 | ツールハンドラーが例外スローで `result.isError: true` | `gateway-server.handleRequest["tools/call"]` | 不変条件（エラー伝播） |
| AC-E027-36 | 非 2xx API レスポンスで `result.isError: true` | `gateway-server.apiGet` / `apiPost` / `apiPut` | 不変条件（HTTP エラー伝播） |
| AC-E027-37 | `trigger_cron_job` で存在しない jobId のとき `error: "Job not found"` | `gateway-server.handleTool["trigger_cron_job"]` | 不変条件（not-found ロジック） |
| AC-E027-38 | `resolveEnvVar("${VAR_NAME}")` で env 値が返る | `resolver.resolveEnvVar` | 操作（+ 計算ロジック: ${} パース） |
| AC-E027-39 | `resolveEnvVar("$VAR_NAME")` で env 値が返る | `resolver.resolveEnvVar` | 操作（+ 計算ロジック: $ パース） |
| AC-E027-40 | `resolveEnvVar("${VAR_NAME}")` で未設定のとき `undefined` | `resolver.resolveEnvVar` | 不変条件（未設定 env のフォールバック） |
| AC-E027-41 | `resolveEnvVar("plainString")` でそのまま返る | `resolver.resolveEnvVar` | 不変条件（パスルー） |
| AC-E027-42 | `resolveEnvVar(undefined)` で `undefined` が返る | `resolver.resolveEnvVar` | バリデーション（undefined ガード） |

---

## セルフレビュー

### 全件チェック

- [x] 総 AC 件数: 42 件
- [x] マッピング済み AC 件数: 42 件
- [x] 未マップ AC: **0 件**

### 「該当なし」AC の確認

- 全 42 AC に少なくとも 1 つのドメイン要素（被テスト関数）が紐付いている
- 「該当なし」として処理した AC はゼロ

### 同一ドメイン要素への複数 AC マッピングの矛盾チェック

- `gateway-server.handleRequest` に AC-E027-01〜05, 34〜35 が紐付く → 矛盾なし（各メソッド分岐を個別に検証）
- `resolver.buildAvailableServers` に AC-E027-22〜30 が紐付く → 矛盾なし（各 enabled フラグ・provider 分岐を個別に検証）
- `resolver.resolveEnvVar` に AC-E027-38〜42 が紐付く → 矛盾なし（各構文パターンを個別に検証）
