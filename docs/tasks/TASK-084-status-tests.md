# Task: [ES-029] Story 11 — status.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #206 |
| Epic 仕様書 | ES-029 |
| Story | S11 |
| Complexity | M |
| PR | #195 |

## 責務

`status.ts` の `runStatus` 関数に対するユニットテストを実装し、`instances.ts` / `fs` / `getStatus()` / `fetch` をモックすることで、Gateway ステータス表示の各パス（未setup・停止中・stale PID・実行中・HTTP 応答あり）を外部依存なしに検証する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/status.test.ts`（新規作成）
- `packages/jimmy/src/cli/status.ts`（参照のみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-083（stop.ts のテスト）: Gateway 停止ロジックのテストは含まない
- TASK-085（migrate.ts 追加テスト）: マイグレーションロジックのテストは含まない

## Epic から委ねられた詳細

該当なし（設計成果物なし — テストカバレッジ Epic のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-58: `runStatus()` を呼び出し `GATEWAY_HOME` が存在しないとき、"Gateway is not set up" を含むメッセージが `console.log` で出力されること
- [ ] AC-E029-59: `runStatus()` を呼び出し `getStatus()` が `{ running: false }` を返すとき、"Gateway: stopped" が `console.log` で出力されること
- [ ] AC-E029-60: `runStatus()` を呼び出し `getStatus()` が `{ running: false, pid: 123 }` を返すとき、stale PID の警告が `console.log` で出力されること
- [ ] AC-E029-61: `runStatus()` を呼び出し `getStatus()` が `{ running: true, pid: 456 }` を返すとき、"Gateway: running" と PID が `console.log` で出力されること
- [ ] AC-E029-62: `runStatus()` を呼び出しゲートウェイが HTTP で応答するとき（`fetch` モック）、セッション数とポートが `console.log` で出力されること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | runStatus（未setup・停止中・stale PID・実行中・HTTP 応答 各パス）| `vi.mock('../instances')`, `vi.mock('node:fs')`, `getStatus` モック, `globalThis.fetch` スパイ |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: 内部ロジックのみ。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 11: status.ts のテスト（AC-E029-58〜62）
- 参照コード: `packages/jimmy/src/cli/status.ts`
- 参照テスト例: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: TASK-074（instances.ts の理解のため参照）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-58〜62）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（M: ~400行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（該当なし）
