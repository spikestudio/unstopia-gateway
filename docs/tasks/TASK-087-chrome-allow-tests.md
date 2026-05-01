# Task: [ES-029] Story 14 — chrome-allow.ts テスト実装

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #209 |
| Epic 仕様書 | ES-029 |
| Story | S14 |
| Complexity | L |
| PR | #195 |

## 責務

`chrome-allow.ts` のビジネスロジック（runChromeAllow / getExtensionDbPath / isBrowserRunning / allowAllForBrowser）に対するユニットテストを実装し、`classic-level` / `child_process` / `os` / `fs` / `process` をモックすることで、Extension DB パス解決・ブラウザ生死確認・ワイルドカード権限書き込みロジックを外部依存なしに検証する。

**重要**: 未エクスポート関数（getExtensionDbPath / isBrowserRunning / quitBrowser / openBrowser）は、テストのために export を追加する。

## スコープ

対象ファイル:

- `packages/jimmy/src/cli/__tests__/chrome-allow.test.ts`（新規作成）
- `packages/jimmy/src/cli/chrome-allow.ts`（エクスポート追加のため変更あり）

対象外（隣接 Task との境界）:

- TASK-086（skills.ts のテスト）: スキル管理ロジックのテストは含まない
- TASK-088（E2E 検証）: カバレッジ測定・全体 E2E は含まない

## Epic から委ねられた詳細

- **エクスポート追加判断（未決定事項 #1 の解決）**: `getExtensionDbPath` / `isBrowserRunning` / `quitBrowser` / `openBrowser` を `export` してテスト可能にする。`allowAllForBrowser` / `runChromeAllow` 経由の統合テストではブランチカバレッジ 90% を達成できないため、個別 export が必要と判断する。

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E029-79: `runChromeAllow({})` を呼び出し `classic-level` のインポートが失敗するとき、`console.error` で "classic-level is required" メッセージが出力され `process.exit(1)` が呼ばれること
- [ ] AC-E029-80: `getExtensionDbPath(chromeBrowser)` を呼び出し macOS かつ Default プロファイルに DB が存在するとき、そのパスを返すこと
- [ ] AC-E029-81: `getExtensionDbPath(chromeBrowser)` を呼び出し全候補パスが存在しないとき、`null` を返すこと
- [ ] AC-E029-82: `isBrowserRunning(browser)` を呼び出し `execSync` が成功するとき（darwin: "true" を返す場合）、`true` を返すこと
- [ ] AC-E029-83: `isBrowserRunning(browser)` を呼び出し `execSync` が例外をスローするとき、`false` を返すこと
- [ ] AC-E029-84: `allowAllForBrowser` を呼び出し Extension DB が見つからないとき、"Claude extension not found" の警告メッセージが `console.log` で出力されること
- [ ] AC-E029-85: `allowAllForBrowser` を呼び出し DB が存在しブラウザが停止中のとき、全 TLD ワイルドカードが LevelDB に書き込まれ成功メッセージが出力されること
- [ ] AC-E029-86: `allowAllForBrowser` を呼び出し全ワイルドカードが既に存在するとき、"Nothing to do" を含むメッセージが出力されること
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] `chrome-allow.ts` への export 追加が行われている
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | runChromeAllow / getExtensionDbPath / isBrowserRunning / allowAllForBrowser | `vi.mock('classic-level')`, `vi.mock('node:child_process')`, `vi.mock('node:fs')`, `vi.mock('node:os')`, `vi.spyOn(process, 'exit')` でモック |
| ドメインロジックテスト | 該当なし | CLI/インフラ層のため |
| 統合テスト | 該当なし | 全依存をモック |
| E2E テスト | 該当なし — 理由: LevelDB のモックが必要。E2E 検証は TASK-088 で一括実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（CLI/インフラ層） |
| サブドメイン種別 | 該当なし |

- 参照 Epic 仕様書: ES-029 §Story 14: chrome-allow.ts のテスト（AC-E029-79〜86）
- 参照コード: `packages/jimmy/src/cli/chrome-allow.ts`（10,765 バイト — 全文読み込み推奨）
- 参照コード: `packages/jimmy/src/cli/__tests__/migrate.test.ts`（モックパターン参照）

## 依存

- 先行 Task: なし（独立実装可能）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E029-79〜86）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安（L: ~800行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている（未決定事項 #1 の解決を記載済み）
