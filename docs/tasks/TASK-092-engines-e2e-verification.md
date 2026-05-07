# Task: [ES-030] E2E 検証 — src/engines テストカバレッジ向上 E2E 検証

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #216 |
| Epic 仕様書 | ES-030 |
| Story | S1, S2, S3（全ストーリー） |
| Complexity | S |
| PR | <!-- PR 作成後に記入 --> |

## 責務

TASK-089〜091 の実装完了後、全エンジン（claude.ts・codex.ts・gemini.ts）の branch カバレッジが 90% 以上に到達していることを確認し、Epic の全 AC が少なくとも 1 つのテストでカバーされていることを検証する。

## スコープ

対象ファイル:

- `src/engines/__tests__/claude.test.ts`（カバレッジ確認のみ）
- `src/engines/__tests__/codex.test.ts`（カバレッジ確認のみ）
- `src/engines/__tests__/gemini.test.ts`（カバレッジ確認のみ）

対象外:

- 新規テストの実装（TASK-089〜091 で対応済み）

## Epic から委ねられた詳細

- 該当なし（E2E 検証 Task のため）

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E030-01〜07（ClaudeEngine 全 AC）が少なくとも 1 つのテストでカバーされていること
- [ ] AC-E030-08〜15（CodexEngine 全 AC）が少なくとも 1 つのテストでカバーされていること
- [ ] AC-E030-16〜24（GeminiEngine 全 AC）が少なくとも 1 つのテストでカバーされていること
- [ ] `pnpm test --coverage` を実行して以下のカバレッジが全て 90% 以上であること:
  - `src/engines/claude.ts` の branch カバレッジ
  - `src/engines/codex.ts` の branch カバレッジ
  - `src/engines/gemini.ts` の branch カバレッジ
- [ ] Epic 仕様書（ES-030）の全 AC チェックボックスが更新されていること

### 品質面

- [ ] `pnpm test` が全件 PASS であること
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | 全 engines テストの一括 PASS 確認 | `pnpm test --coverage` で確認 |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 全 AC カバレッジ検証 | カバレッジレポート（branch 列）で確認 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし |
| サブドメイン種別 | 汎用 |

- 参照 Epic 仕様書: ES-030（全 AC）
- 確認コマンド: `cd packages/jimmy && pnpm test --coverage 2>&1 | grep "src/engines"`
- 未カバー AC がある場合は TASK-089〜091 に差し戻す

### カバレッジ確認手順

```bash
cd packages/jimmy
pnpm test --coverage 2>&1 | grep "src/engines"
# 期待出力例:
#  claude.ts        |   88.35 |    90.x  |   93.54 |   90.95 |
#  codex.ts         |   91.66 |    90.x  |   93.75 |   93.26 |
#  gemini.ts        |   86.59 |    90.x  |   94.44 |    88.5 |
# branch（2 列目）が全て 90.00 以上であれば OK
```

## 依存

- 先行 Task: TASK-089（ClaudeEngine テスト）・TASK-090（CodexEngine テスト）・TASK-091（GeminiEngine テスト）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（全 AC）が完了条件と対応づけられている
- [ ] 先行 Task（TASK-089〜091）が全て完了していること
