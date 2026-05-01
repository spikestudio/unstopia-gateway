# Task: [ES-032] Story 1.2 — connectors.ts テスト

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #229 |
| Epic 仕様書 | ES-032 |
| Story | 1.2 |
| Complexity | M |
| PR | #226 |

## 責務

`src/gateway/api/connectors.ts` の全 HTTP ハンドラー（reload / whatsapp/qr / list / incoming / proxy / send）に対するユニットテストを追加し、branch カバレッジを 0% から 90% 以上に引き上げる。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/__tests__/connectors.test.ts`（新規作成）
- `packages/jimmy/src/gateway/api/connectors.ts`（読み取りのみ、変更なし）

対象外（隣接 Task との境界）:

- TASK-099〜100: misc.ts のテスト

## Epic から委ねられた詳細

- `context.connectors` は `Map<string, Connector>` として実装する。各コネクターは `getHealth`, `getEmployee`, `sendMessage`, `replyMessage`, `editMessage`, `addReaction`, `removeReaction`, `setTypingStatus`, `deliverMessage` をモックで提供する
- `POST /api/connectors/:id/proxy` の switch 文は 6 ケース（sendMessage / replyMessage / editMessage / addReaction / removeReaction / setTypingStatus / unknown）すべてを個別テストケースでカバーする
- `POST /api/connectors/:id/incoming` の Discord メッセージ deliverMessage パスでは `downloadAttachment` を `../../connectors/discord/format.js` からモックする
- WhatsApp コネクターは `getQrCode()` メソッドを持つオブジェクトとしてモックする

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] AC-E032-13: `connectors.ts` の branch カバレッジが 90% 以上に達する
- [ ] AC-E032-14: `POST /api/connectors/reload` が `reloadConnectorInstances` を呼び出し成功時にその結果を返し、非対応時に 501 を返すことが検証される
- [ ] AC-E032-15: `GET /api/connectors/whatsapp/qr` が WhatsApp コネクター不在 / QR なし / QR あり の 3 分岐すべてで検証される
- [ ] AC-E032-16: `GET /api/connectors` が全コネクターのリストを返すことが検証される
- [ ] AC-E032-17: `POST /api/connectors/:id/incoming` が deliverMessage で配送し、不在 / リモート未対応 の各ケースで検証される
- [ ] AC-E032-18: `POST /api/connectors/:id/proxy` が全プロキシアクションと未知アクション時の 400 を含めて検証される
- [ ] AC-E032-19: `POST /api/connectors/:name/send` が channel / text バリデーション後に sendMessage を呼ぶことが検証される
- [ ] Epic 仕様書の AC-E032-13〜19 チェックボックス更新

### 品質面

- [ ] ユニットテストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | handleConnectorsRequest の全ルート分岐 | Map コネクター・QRCode・discord/format はモック |
| ドメインロジックテスト | 該当なし | |
| 統合テスト | 該当なし | |
| E2E テスト | 該当なし — 理由: HTTP ハンドラーの単体テストのみ。E2E は TASK-106 で実施 | |

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | gateway/api（HTTP ルーティング層） |
| サブドメイン種別 | 支援 |

- 参照 Epic 仕様書: ES-032 §Story 1.2
- 参照コード: `packages/jimmy/src/gateway/api/connectors.ts`
- 参照コード: `packages/jimmy/src/gateway/api/__tests__/session-crud.test.ts`（ApiContext モック構成の参考）

**モック対象一覧:**

- `qrcode` → `toDataURL`
- `../../connectors/whatsapp/index` → WhatsAppConnector 型
- `../../connectors/discord/format` → `downloadAttachment`
- `../../shared/paths` → `TMP_DIR`

## 依存

- 先行 Task: --

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] コンテキスト量が複雑度レベルの目安に収まっている
- [ ] Epic から委ねられた詳細が転記されている
