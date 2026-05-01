# Task: [ES-034] Story 1 — RemoteDiscordConnector テスト追加（remote.ts）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #245 |
| Epic 仕様書 | ES-034 |
| Story | 1 |
| Complexity | S |
| PR | #TBD |

## 責務

`RemoteDiscordConnector`（`packages/jimmy/src/connectors/discord/remote.ts`）の全メソッドをユニットテストで検証し、branch カバレッジを 90% 以上に引き上げる（現在 0%）。

## スコープ

対象ファイル:

- `packages/jimmy/src/connectors/discord/__tests__/index.test.ts`（既存ファイルに追記、または `remote.test.ts` を新規作成）

対象外（隣接 Task との境界）:

- TASK-112: `DiscordConnector`（`index.ts`）のテストは別 Task
- TASK-113 は `remote.ts` のみに集中する

## Epic から委ねられた詳細

- `global.fetch` を `vi.stubGlobal` でモック化し、HTTP リクエスト/レスポンスをシミュレートすること
- 成功レスポンス（200 OK, `{ messageId: "xxx" }`）とエラーレスポンス（4xx/5xx, `fetch` 例外）の両方をテストすること
- `biome-ignore` コメントによる静的解析抑制は禁止

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E034-09**: `RemoteDiscordConnector` の `sendMessage`/`replyMessage`/`editMessage`/`addReaction`/`removeReaction`/`setTypingStatus` が、プロキシ URL にリクエストを送信し成功時は messageId を返す
- [ ] **AC-E034-10**: `RemoteDiscordConnector` の各操作で HTTP エラーが発生した場合に `undefined` を返す
- [ ] **AC-E034-11**: `RemoteDiscordConnector` の `deliverMessage` が、登録済みハンドラにメッセージを配信する
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | RemoteDiscordConnector の全メソッド（sendMessage/replyMessage/editMessage/addReaction/removeReaction/setTypingStatus/deliverMessage）正常系・HTTP エラー系・fetch 例外系 | `vi.stubGlobal("fetch", ...)` でモック化 |
| ドメインロジックテスト | 該当なし | ドメインロジック変更なし |
| 統合テスト | 該当なし | fetch モック化のため不要 |
| E2E テスト | AC-E034-09〜11 | vitest ユニットテストで代替。実 Discord 接続なし |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（設計ステップスキップ: 既存コードのテスト追加のみ） |
| サブドメイン種別 | 汎用 — 連携設計 + E2E 中心 |

- 参照 Epic 仕様書: ES-034 §Story 1: Discord コネクターのカバレッジ向上
- 参照設計: `docs/requirements/ES-034-connectors-test-coverage.md` §エラーケース（Discord: プロキシ HTTP エラー, プロキシ通信エラー）
- 参照 ADR: 該当なし
- 参照コード:
  - `packages/jimmy/src/connectors/discord/remote.ts`（110 行・実装本体）
  - `packages/jimmy/src/connectors/discord/__tests__/index.test.ts`（506 行・既存テスト・モックパターン参考）

## 依存

- 先行 Task: なし（TASK-112 と並行実装可能）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（E2E シナリオ）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なしを含む）
