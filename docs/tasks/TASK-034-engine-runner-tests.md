# Task: [ES-018] Story 18.2 — engine-runner.ts runSession エラーパステスト追加

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #120 |
| Epic 仕様書 | ES-018 |
| Story | 18.2 |
| Complexity | M |
| PR | #118 |

## 責務

`sessions/engine-runner.ts` の `runSession` 関数に対して、エンジン不在・budget 超過・cron ソース分岐のガード節テストを追加する。

## スコープ

対象ファイル:

- `packages/jimmy/src/sessions/__tests__/engine-runner.test.ts`（新規作成）

対象外（隣接 Task との境界）:

- TASK-033: context.ts のテストは対象外
- `engine-runner-utils.test.ts` の既存テスト（mergeTransportMeta）は変更しない
- レートリミット・fallback エンジン切替などの複雑なフローは対象外（後続 Epic）

## Epic から委ねられた詳細

- `engines` Map をモックして存在しないエンジン名のケースをテスト（engine-runner.ts L65-69）
- `checkBudget` を `vi.mock("../gateway/budgets.js")` でモックして "paused" を返す
- budget 超過ケース: `repos?.sessions.updateSession` が `status: "error"` で呼ばれることを確認（L162-174）
- cron ソース判定: `decorateMessages = session.source !== "cron"` の分岐（L75）で `connector.addReaction` が呼ばれないことを確認
- `repos` は InMemory 実装を利用するか vi.fn() でモックする

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E018-08: engines Map に存在しないエンジン名を持つ session を渡すと `connector.replyMessage` が呼ばれ早期終了する
- [ ] AC-E018-09: session.employee が budget を超過している場合（checkBudget が "paused"）、`connector.replyMessage` にエラーメッセージが送られ `repos.sessions.updateSession` が `status: "error"` で呼ばれる
- [ ] AC-E018-10: session.source が "cron" の場合、`connector.addReaction` が呼ばれない
- [ ] AC-E018-11: `pnpm test` が全 PASS する
- [ ] Epic 仕様書の AC チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `runSession` 関数（engine-runner.ts エクスポート関数）| 外部依存を vi.mock で分離 |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: ガード節のみのユニットテスト | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | — （テスト追加のみ）|
| サブドメイン種別 | コア（SessionManager・エンジン実行ロジック）|

- 参照 Epic 仕様書: ES-018 Story 18.2 §受入基準
- 参照コード:
  - `packages/jimmy/src/sessions/engine-runner.ts` §runSession（L53-）
    - L65-69: エンジン不在ガード節（AC-E018-08）
    - L75: decorateMessages = source !== "cron"（AC-E018-10）
    - L158-175: budget 超過ガード節（AC-E018-09）
  - `packages/jimmy/src/sessions/__tests__/engine-runner-utils.test.ts`（既存モック参考）
  - `packages/jimmy/src/gateway/budgets.ts`（checkBudget のシグネチャ確認）

## 依存

- 先行 Task: なし（TASK-033 と並行実装可能だが順番に実装）

## 引き渡し前チェック

- [x] 完了条件が全て検証可能な形で記述されている
- [x] 対応する Epic AC（AC-E018-08〜11）が特定され完了条件と対応づけられている
- [x] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている（行番号含む）
- [x] コンテキスト量が複雑度 M の目安に収まっている
- [x] Epic から委ねられた詳細（モック設計方針）が転記されている
