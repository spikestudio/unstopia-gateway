# Task: [ES-020] Story 20.1〜20.6 — E2E 検証（全テスト PASS）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #132 |
| Epic 仕様書 | ES-020 |
| Story | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6 |
| Complexity | S |
| PR | #144 |

## 責務

TASK-039〜041 で追加した全コネクターテストが `pnpm test` で PASS し、biome ゼロ警告・CI グリーンの状態を確認する。

## スコープ

対象ファイル:

- `packages/jimmy/src/connectors/discord/__tests__/index.test.ts`（TASK-039 成果物）
- `packages/jimmy/src/connectors/slack/__tests__/index.test.ts`（TASK-040 成果物）
- `packages/jimmy/src/connectors/whatsapp/__tests__/index.test.ts`（TASK-041 成果物）

対象外（隣接 Task との境界）:

- TASK-039: DiscordConnector テスト実装（先行 Task）
- TASK-040: SlackConnector テスト実装（先行 Task）
- TASK-041: WhatsAppConnector テスト実装（先行 Task）

## Epic から委ねられた詳細

- `pnpm build && pnpm test` が全件 PASS すること
- biome ゼロ警告（biome-ignore 等の抑制コメント使用禁止）
- CI パイプライン（GitHub Actions）グリーン

## 完了条件

**機能面（AC-ID 参照）:**

- [x] **AC-E020-01〜09**: Discord コネクターの全 AC が vitest で PASS
- [x] **AC-E020-10〜19**: Slack コネクターの全 AC が vitest で PASS
- [x] **AC-E020-20〜28**: WhatsApp コネクターの全 AC が vitest で PASS
- [x] Epic 仕様書の AC チェックボックス更新

### 品質面

- [x] ユニットテスト/統合テストが追加・通過している
- [x] コードレビューが承認されている
- [x] CI パイプラインがグリーン
- [x] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | 全 AC（AC-E020-01〜28） | `pnpm test` で確認 |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | AC-E020-01〜28 全件 | vitest ユニットテストで代替。`pnpm build && pnpm test` でローカル PASS 確認 |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし |
| サブドメイン種別 | 汎用 |

- 参照 Epic 仕様書: ES-020 §E2E 検証計画
- 参照設計: `docs/requirements/ES-020-connector-index-tests.md` §E2E 検証計画
- 参照 ADR: 該当なし
- 参照コード:
  - TASK-039〜041 で作成したテストファイル群

## 依存

- 先行 Task: TASK-039（DiscordConnector テスト）, TASK-040（SlackConnector テスト）, TASK-041（WhatsAppConnector テスト）

## 引き渡し前チェック

- [x] 完了条件が全て検証可能な形で記述されている
- [x] 対応する Epic AC（E2E シナリオ）が特定され、完了条件と対応づけられている
- [x] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [x] 参照設計にセクション番号/名（§）が記載されている
- [x] コンテキスト量が複雑度レベルの目安に収まっている
- [x] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [x] 先行 Task が完了しコードがマージ済みである
- [x] ドキュメントに書かれていない暗黙の要件がない
- [x] Epic から委ねられた詳細が転記されている（該当なしを含む）
