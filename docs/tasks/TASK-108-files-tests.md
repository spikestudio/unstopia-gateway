# Task: [ES-033] Story 1.2 — files.ts テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #238 |
| Epic 仕様書 | ES-033 |
| Story | 1.2 |
| Complexity | L |
| PR | #TBD |

## 責務

`src/gateway/files.ts` の HTTP ハンドラー（ファイルアップロード・ダウンロード・一覧・削除・転送）のユニットテストを追加し、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/__tests__/files.test.ts`（新規作成）
- `packages/jimmy/src/gateway/files.ts`（読み取りのみ、変更なし・533 行）

対象外（隣接 Task との境界）:

- lifecycle.ts のテスト: TASK-107 が担当
- watcher.ts のテスト: TASK-109 が担当
- multipart ファイルアップロードの完全な実FS操作: vi.mock でモック（ファイルサイズ上限テストは除外可）

## Epic から委ねられた詳細

- `handleFilesRequest(req, res, pathname, method, context)` はルーティング型ハンドラーなので、req/res/context を mock オブジェクトで構築してテストする
- `ensureFilesDir()` は `node:fs` の `mkdirSync` をモックして検証する（AC-E033-10）
- ファイル一覧（AC-E033-11）: `readdirSync` + `statSync` をモックして返却値を制御する
- ダウンロード存在チェック（AC-E033-12〜13）: DB 取得結果と `fs.existsSync` をモックして 200/404 の分岐を制御する
- JSON ボディバリデーション（AC-E033-16〜18）: `filename`/`content`/`url` フィールドを操作して 400 エラーを再現する
- transfer ホワイトリスト（AC-E033-19）: `resolveDestination` は `config.yaml remotes` を使用。`loadConfig` をモックしてホワイトリスト外 URL で 403 を返す分岐を検証する
- `context` オブジェクトは `{ db: initDb() }` 形式。`initDb` はモックしてテスト用 DB インスタンスを返す
- `http-test-helpers.ts` が `packages/jimmy/src/gateway/__tests__/` に存在するため、それを活用する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E033-09: `files.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E033-10: `ensureFilesDir()` を呼び出すと FILES_DIR が作成される
- [ ] AC-E033-11: `handleFilesRequest` で `GET /api/files` を呼び出すとファイル一覧を含む JSON レスポンスが返る
- [ ] AC-E033-12: `handleFilesRequest` で `GET /api/files/:id` を呼び出すと、存在するファイルがダウンロードできる
- [ ] AC-E033-13: `handleFilesRequest` で存在しない `id` を `GET /api/files/:id` で取得すると 404 が返る
- [ ] AC-E033-14: `handleFilesRequest` で `GET /api/files/:id/meta` を呼び出すとメタデータ JSON が返る
- [ ] AC-E033-15: `handleFilesRequest` で JSON ボディの `POST /api/files`（base64 content）を呼び出すとファイルが保存され 201 と FileMeta が返る
- [ ] AC-E033-16: JSON ボディで `filename` が欠落している場合に 400 が返る
- [ ] AC-E033-17: JSON ボディで `content` と `url` の両方が指定された場合に 400 が返る
- [ ] AC-E033-18: JSON ボディで `content` も `url` も指定されない場合に 400 が返る
- [ ] AC-E033-19: `resolveDestination` でホワイトリスト外の URL を指定した `POST /api/files/transfer` が 403 を返す
- [ ] Epic 仕様書の AC-E033-09〜19 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `handleFilesRequest` の全ルート分岐（GET/POST/DELETE・バリデーション・エラーケース） | `node:fs` / `node:crypto` / `initDb` / `loadConfig` をモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: HTTP ハンドラーの単体テスト。E2E は TASK-111 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway（HTTP サーバー・ライフサイクル管理層） |
| サブドメイン種別 | 支援 — 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-033 §Story 1.2 AC-E033-09〜19
- 参照コード: `packages/jimmy/src/gateway/files.ts`（全体 533 行）
- 参照コード: `packages/jimmy/src/gateway/__tests__/http-test-helpers.ts`（req/res モック構成の参考）
- 参照コード: `packages/jimmy/src/gateway/__tests__/services.test.ts`（context オブジェクトのモック例）

**モック対象一覧:**

```typescript
vi.mock("node:fs")
vi.mock("node:crypto", () => ({ randomUUID: vi.fn().mockReturnValue("test-uuid") }))
vi.mock("../sessions/registry.js", () => ({ initDb: vi.fn().mockReturnValue(mockDb) }))
vi.mock("../shared/config.js", () => ({ loadConfig: vi.fn().mockReturnValue({ remotes: [] }) }))
vi.mock("../shared/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock("../shared/paths.js", () => ({ FILES_DIR: "/tmp/test-files", GATEWAY_HOME: "/tmp" }))
```

**DB モックの構成（SQLite の prepare.get 形式）:**

```typescript
const mockDb = {
  prepare: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(null), // ファイルなし → 404
    run: vi.fn(),
    all: vi.fn().mockReturnValue([]),
  })
};
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
