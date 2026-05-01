# Task: [ES-032] Story 1.3 — org.ts テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #230 |
| Epic 仕様書 | ES-032 |
| Story | 1.3 |
| Complexity | M |
| PR | #226 |

## 責務

`src/gateway/api/org.ts` の全 HTTP ハンドラー（GET org / services / cross-request / employees / PATCH employees / departments board）に対するユニットテストを追加し、branch カバレッジを 36% から 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/org.test.ts`（新規作成）
- `packages/jimmy/src/gateway/api/org.ts`（読み取りのみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-099〜100: misc.ts のテスト
- TASK-101: connectors.ts のテスト

## Epic から委ねられた詳細

- `scanOrg`, `resolveOrgHierarchy`, `buildServiceRegistry`, `buildRoutePath`, `resolveManagerChain`, `updateEmployeeYaml` は動的 import されるためそれぞれ `vi.mock` でモックする
- `POST /api/org/cross-request` は sessionManager.getEngine を使わない（セッション作成後の run は行わない）ため、`createSession` / `insertMessage` のモックで十分
- `ORG_DIR` の存在チェックは `fs.existsSync` のモックで制御する

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E032-20: `org.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E032-21: `GET /api/org` が ORG_DIR 不在時に空応答を返し、存在時に departments / employees / hierarchy を含む応答を返すことが検証される
- [ ] AC-E032-22: `GET /api/org/services` がサービスレジストリをリストとして返すことが検証される
- [ ] AC-E032-23: `POST /api/org/cross-request` が必須フィールド欠落 / fromEmployee 不在 / service 不在 / 正常 の各ケースで検証される
- [ ] AC-E032-24: `GET /api/org/employees/:name` が不在時に 404 を返し、存在時に hierarchy 情報付きで返すことが検証される
- [ ] AC-E032-25: `PATCH /api/org/employees/:name` が alwaysNotify 更新と不在時 404 を検証される
- [ ] Epic 仕様書の AC-E032-20〜25 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | handleOrgRequest の全ルート分岐 | 動的 import・FS・sessions/registry はモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: HTTP ハンドラーの単体テストのみ。E2E は TASK-106 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway/api（HTTP ルーティング層） |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-032 §Story 1.3
- 参照コード: `packages/jimmy/src/gateway/api/org.ts`
- 参照コード: `packages/jimmy/src/gateway/api/__tests__/session-crud.test.ts`（ApiContext モック参考）

**モック対象一覧:**

- `node:fs` → `existsSync`, `readdirSync`
- `../../sessions/registry` → `createSession`, `insertMessage`
- `../../shared/logger` → `logger`
- `../../shared/paths` → `ORG_DIR`
- 動的 import: `../org`, `../org-hierarchy`, `../services`

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] Epic から委ねられた詳細が転記されている
