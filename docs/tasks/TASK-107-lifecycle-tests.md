# Task: [ES-033] Story 1.1 — lifecycle.ts テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #237 |
| Epic 仕様書 | ES-033 |
| Story | 1.1 |
| Complexity | M |
| PR | #TBD |

## 責務

`src/gateway/lifecycle.ts` の `stop()` / `getStatus()` 関数（PID ファイル・ポートフォールバック・ESRCH 分岐）のユニットテストを追加し、branch カバレッジを 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/__tests__/lifecycle.test.ts`（新規作成）
- `packages/jimmy/src/gateway/lifecycle.ts`（読み取りのみ、変更なし）

対象外（隣接 Task との境界）:

- `startForeground()` / `startDaemon()`: server.ts への依存が深く統合テストが必要なため本 Task のスコープ外。カバレッジ対象は `stop()` / `getStatus()` / `resolvePort()` / `findPidOnPort()` を優先する
- files.ts / watcher.ts のテスト: TASK-108 / TASK-109 が担当

## Epic から委ねられた詳細

- `stop()` の ESRCH ハンドリング（AC-E033-03）: `process.kill` が `ESRCH` コードで失敗した場合、PID ファイルを削除してポートフォールバックに移行する分岐をモックで再現する
- `stop()` のポートフォールバック（AC-E033-04）: `findPidOnPort()` は `execSync` を使用しているため `node:child_process` をモックする
- `getStatus()` のスタレ PID（AC-E033-07）: `process.kill(pid, 0)` が失敗した場合にポートフォールバックを試みる分岐をテストする
- `fs.existsSync` / `fs.readFileSync` / `fs.unlinkSync` / `fs.writeFileSync` は `node:fs` をモックして PID ファイルの有無を制御する
- `process.kill` は `vi.spyOn(process, "kill")` でモックする

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E033-01: `lifecycle.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E033-02: `stop()` 関数で PID ファイルが存在し、プロセスが生きている場合に `SIGTERM` を送り `true` を返す
- [ ] AC-E033-03: `stop()` 関数で PID ファイルが存在するが、プロセスが見つからない（ESRCH）場合に PID ファイルを削除してポートフォールバックに移行する
- [ ] AC-E033-04: `stop()` 関数で PID ファイルが存在しない場合にポートスキャンにフォールバックし、プロセスが見つかれば `true` を返す
- [ ] AC-E033-05: `stop()` 関数でポートにもプロセスが存在しない場合に `false` を返す
- [ ] AC-E033-06: `getStatus()` 関数で PID ファイルが存在しプロセスが生きている場合に `{ running: true, pid }` を返す
- [ ] AC-E033-07: `getStatus()` 関数で PID ファイルが存在するがプロセスが死んでいる場合にポートフォールバックを試みる
- [ ] AC-E033-08: `getStatus()` 関数で PID ファイルが存在しない場合にポートフォールバックを試みる
- [ ] Epic 仕様書の AC-E033-01〜08 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `stop()` / `getStatus()` の全分岐（PID ファイル有無・ESRCH・ポートフォールバック） | `node:fs` / `node:child_process` / `process.kill` をモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: プロセス管理の単体ロジックテスト。E2E は TASK-111 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway（HTTP サーバー・ライフサイクル管理層） |
| サブドメイン種別 | 支援 — 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-033 §Story 1.1 AC-E033-01〜08
- 参照コード: `packages/jimmy/src/gateway/lifecycle.ts`（全体 165 行）
- 参照コード: `packages/jimmy/src/gateway/__tests__/budgets.test.ts`（モック構成・JINN_HOME 設定の参考）

**モック対象一覧:**

```typescript
vi.mock("node:fs")
vi.mock("node:child_process") // execSync のモック
vi.spyOn(process, "kill")    // SIGTERM 送信・ESRCH エラーのシミュレーション
vi.mock("../shared/paths.js", () => ({ PID_FILE: "/tmp/test.pid", JINN_HOME: "/tmp" }))
vi.mock("../shared/config.js", () => ({ loadConfig: vi.fn().mockReturnValue({ gateway: { port: 7777 } }) }))
vi.mock("../shared/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))
```

**ESRCH エラーのシミュレーション方法:**

```typescript
const err = Object.assign(new Error("ESRCH"), { code: "ESRCH" });
vi.spyOn(process, "kill").mockImplementationOnce(() => { throw err; });
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
