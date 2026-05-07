# Task: [ES-032] Story 1.1 — misc.ts 基本 API テスト（status / instances / config / logs / activity / onboarding）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #227 |
| Epic 仕様書 | ES-032 |
| Story | 1.1 |
| Complexity | M |
| PR | #226 |

## 責務

`src/gateway/api/misc.ts` の status / instances / config / logs / activity / onboarding の各 HTTP ハンドラーに対するユニットテストを追加する。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/misc.test.ts`（新規作成）
- `packages/jimmy/src/gateway/api/misc.ts`（読み取りのみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-100: goals / costs / budgets の API テスト（misc.ts の後半部分）
- TASK-101〜: connectors / org / sessions / cron / utils のテスト

## Epic から委ねられた詳細

- モック構成: HttpRequest / ServerResponse / ApiContext / context.getConfig / context.sessionManager / context.connectors はすべてモックで実装する
- CLAUDE.md / AGENTS.md ファイルの書き換えテストは tmp ディレクトリに一時ファイルを作成してテストする（実ファイルを変更しない）
- `POST /api/onboarding` の CLAUDE.md / AGENTS.md アイデンティティ行書き換えはファイルの存在有無で分岐する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E032-01: `misc.ts` の branch カバレッジが 90% 以上に達する（本 Task 後に TASK-100 完了でトータル達成）
- [ ] AC-E032-02: `GET /api/status` ハンドラーが正常系（sessions / engines / connectors の組み合わせ）で期待するレスポンス構造を返すことが検証される
- [ ] AC-E032-03: `GET /api/instances` ハンドラーが各インスタンスの health 結果を含むリストを返すことが検証される
- [ ] AC-E032-04: `GET /api/config` が設定オブジェクトを返し、token / botToken / signingSecret / appToken フィールドが `***` にマスクされることが検証される
- [ ] AC-E032-05: `PUT /api/config` が既存 YAML と deep-merge して保存することが検証され、不正キーや不正型に対して 400 を返すことが検証される
- [ ] AC-E032-06: `GET /api/logs` が最大 `n` 行のログ行を返し、ファイル不在時に `{ lines: [] }` を返すことが検証される
- [ ] AC-E032-07: `GET /api/activity` がセッションのトランスポート状態に応じたイベント種別を返すことが検証される
- [ ] AC-E032-08: `GET /api/onboarding` が `needed` フラグを正しく計算することが検証される
- [ ] AC-E032-09: `POST /api/onboarding` がポータル設定を YAML に保存し、CLAUDE.md / AGENTS.md を書き換えることが検証される
- [ ] Epic 仕様書の AC チェックボックス更新（TASK-100 完了時に一括更新）

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | handleMiscRequest の各ルート分岐 | HttpRequest / ServerResponse / 外部依存はすべてモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: HTTP ハンドラーの単体テストのみ。E2E は TASK-106 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway/api（HTTP ルーティング層） |
| サブドメイン種別 | 支援 — 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-032 §Story 1.1
- 参照コード: `packages/jimmy/src/gateway/api/misc.ts`
- 参照コード: `packages/jimmy/src/gateway/api/__tests__/session-crud.test.ts`（モック構成の参考）
- 参照コード: `packages/jimmy/src/gateway/api/utils.ts`（json / badRequest / notFound の実装）

**モック対象一覧:**

- `../../cli/instances` → `loadInstances`
- `../../sessions/registry` → `listSessions`
- `../../shared/logger` → `logger`
- `../../shared/paths` → `CONFIG_PATH`, `JINN_HOME`, `LOGS_DIR`, `ORG_DIR`
- `../files` → `handleFilesRequest`
- `node:fs` → `existsSync`, `readFileSync`, `writeFileSync`, `statSync`, `openSync`, `readSync`, `closeSync`, `readdirSync`
- `js-yaml` → `load`, `dump`
- `../goals`, `../costs`, `../budgets` → 各関数（TASK-100 スコープ）
- `../../sessions/registry` → `initDb`

**テスト記述パターン（既存テストから踏襲）:**

```typescript
function makeReq(method: string, url: string, body?: unknown): { req: IncomingMessage; res: ServerResponse; getBody: () => unknown }
```

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（E2E シナリオ）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なしを含む）
