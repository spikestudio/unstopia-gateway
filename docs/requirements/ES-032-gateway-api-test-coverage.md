# ES-032: src/gateway/api テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 例外承認の場合のみ: #xxx, #yyy --> |
| Issue | #225 |
| Phase 定義書 | PD-003 |
| Epic | E4 |
| 所属 BC | gateway/api（HTTP ルーティング層） |
| ADR 参照 | <!-- 該当なし --> |

## 対応ストーリー

<!-- Phase 定義書 PD-003 の E4 から転記 -->

- S1: src/gateway/api（31.22% → 90%以上）のテスト追加

## 概要

`src/gateway/api` 配下の HTTP ハンドラー群（misc.ts / connectors.ts / org.ts / sessions.ts / cron.ts / utils.ts / api-types.ts）に対してユニットテストを追加し、branch カバレッジを現状 31.22% から 90% 以上に引き上げる。対象ファイルのうち misc.ts（0%）・connectors.ts（0%）・sessions.ts（0%）は未テストのため優先的にカバーする。なお session-crud / session-fallback / session-message / session-queue-handlers / session-rate-limit / session-resume / session-runner は ES-026 で対応済みのため本 Epic のスコープ外とする。

## ストーリーと受入基準

### Story 1.1: misc.ts のテストカバレッジ向上

> As a **開発者**, I want to `misc.ts` の HTTP ハンドラーに対するテストを追加する, so that リグレッションを検知できるようにするため.

**受入基準:**

- [ ] **AC-E032-01**: `misc.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E032-02**: `GET /api/status` ハンドラーが正常系（sessions / engines / connectors の組み合わせ）で期待するレスポンス構造を返すことが検証される ← S1
- [ ] **AC-E032-03**: `GET /api/instances` ハンドラーが各インスタンスの health 結果を含むリストを返すことが検証される ← S1
- [ ] **AC-E032-04**: `GET /api/config` が設定オブジェクトを返し、token / botToken / signingSecret / appToken フィールドが `***` にマスクされることが検証される ← S1
- [ ] **AC-E032-05**: `PUT /api/config` が既存 YAML と deep-merge して保存することが検証され、不正キーや不正型に対して 400 を返すことが検証される ← S1
- [ ] **AC-E032-06**: `GET /api/logs` が最大 `n` 行のログ行を返し、ファイル不在時に `{ lines: [] }` を返すことが検証される ← S1
- [ ] **AC-E032-07**: `GET /api/activity` がセッションのトランスポート状態（running / queued / idle / error）に応じたイベント種別を含む配列を返すことが検証される ← S1
- [ ] **AC-E032-08**: `GET /api/onboarding` が `needed` フラグを正しく計算することが検証される（未オンボーディング / オンボーディング済み / セッションあり の各条件分岐） ← S1
- [ ] **AC-E032-09**: `POST /api/onboarding` がポータル設定を YAML に保存し、CLAUDE.md / AGENTS.md のアイデンティティ行を書き換えることが検証される ← S1（AI 補完: ファイル書き換えロジックが 100 行超の複雑な実装であり未テスト時の回帰リスクが高い）
- [ ] **AC-E032-10**: `GET /api/goals` / `POST /api/goals` / `GET /api/goals/:id` / `PUT /api/goals/:id` / `DELETE /api/goals/:id` / `GET /api/goals/tree` が正常系・異常系でそれぞれ期待する HTTP ステータスとレスポンスを返すことが検証される ← S1
- [ ] **AC-E032-11**: `GET /api/costs/summary` / `GET /api/costs/by-employee` が `period` クエリパラメータ（day / week / month）を正しく処理することが検証される ← S1
- [ ] **AC-E032-12**: `GET /api/budgets` / `PUT /api/budgets` / `POST /api/budgets/:employee/override` / `GET /api/budgets/events` が正常系で期待するレスポンスを返すことが検証される ← S1

### Story 1.2: connectors.ts のテストカバレッジ向上

> As a **開発者**, I want to `connectors.ts` の HTTP ハンドラーに対するテストを追加する, so that コネクター操作の回帰を検知できるようにするため.

**受入基準:**

- [ ] **AC-E032-13**: `connectors.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E032-14**: `POST /api/connectors/reload` が `reloadConnectorInstances` を呼び出し成功時にその結果を返し、非対応時に 501 を返すことが検証される ← S1
- [ ] **AC-E032-15**: `GET /api/connectors/whatsapp/qr` が WhatsApp コネクター不在時に 404 を返し、QR コードなし時に `{ qr: null }` を返し、QR コードあり時に data URL を返すことが検証される ← S1（AI 補完: 3 分岐すべて未テストで回帰リスクが高い）
- [ ] **AC-E032-16**: `GET /api/connectors` が全コネクターのリストを instanceId / name / employee / health 情報とともに返すことが検証される ← S1
- [ ] **AC-E032-17**: `POST /api/connectors/:id/incoming` が Discord コネクターに対してメッセージを deliverMessage で配送し、不在時に 404 を返し、リモートモード未対応時に 400 を返すことが検証される ← S1
- [ ] **AC-E032-18**: `POST /api/connectors/:id/proxy` が全プロキシアクション（sendMessage / replyMessage / editMessage / addReaction / removeReaction / setTypingStatus）を正しくディスパッチし、未知アクション時に 400 を返すことが検証される ← S1（AI 補完: switch 文の各 case が未テストであり branch カバレッジへの影響が大きい）
- [ ] **AC-E032-19**: `POST /api/connectors/:name/send` が channel / text 必須バリデーションを通過した後にコネクターの `sendMessage` を呼び出すことが検証される ← S1

### Story 1.3: org.ts のテストカバレッジ向上

> As a **開発者**, I want to `org.ts` の HTTP ハンドラーに対するテストを追加する, so that 組織 API の回帰を検知できるようにするため.

**受入基準:**

- [ ] **AC-E032-20**: `org.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E032-21**: `GET /api/org` が ORG_DIR 不在時に空の応答を返し、存在時に departments / employees / hierarchy を含む応答を返すことが検証される ← S1
- [ ] **AC-E032-22**: `GET /api/org/services` がサービスレジストリをリストとして返すことが検証される ← S1
- [ ] **AC-E032-23**: `POST /api/org/cross-request` が必須フィールド（fromEmployee / service / prompt）の欠落時に 400 を返し、存在しない fromEmployee / service に対して 404 を返し、正常時にセッション作成結果を返すことが検証される ← S1
- [ ] **AC-E032-24**: `GET /api/org/employees/:name` が不在時に 404 を返し、存在時に hierarchy 情報付きで employee を返すことが検証される ← S1
- [ ] **AC-E032-25**: `PATCH /api/org/employees/:name` が alwaysNotify を更新し、不在時に 404 を返すことが検証される ← S1

### Story 1.4: sessions.ts のテストカバレッジ向上

> As a **開発者**, I want to `sessions.ts` の HTTP ハンドラーに対するテストを追加する, so that セッション API の回帰を検知できるようにするため.

**受入基準:**

- [ ] **AC-E032-26**: `sessions.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E032-27**: `GET /api/sessions` がセッション一覧を返すことが検証される ← S1
- [ ] **AC-E032-28**: `GET /api/sessions/interrupted` が中断済みセッション一覧を返すことが検証される ← S1
- [ ] **AC-E032-29**: `POST /api/sessions/bulk-delete` が ids 必須バリデーションを通過し、エンジンを kill してからセッションを削除し、削除数を返すことが検証される ← S1（AI 補完: エンジン kill + 削除の複合処理が未テストで回帰リスクが高い）
- [ ] **AC-E032-30**: `POST /api/sessions/stub` がデフォルトの greeting でスタブセッションを作成し、assistant メッセージを挿入することが検証される ← S1
- [ ] **AC-E032-31**: `POST /api/sessions` が prompt 必須バリデーションを通過し、エンジン不在時にエラーステータスで 201 を返し、正常時にセッションを作成してキューに追加することが検証される ← S1
- [ ] **AC-E032-32**: `GET /api/sessions/:id` / `PUT /api/sessions/:id` / `DELETE /api/sessions/:id` / `POST /api/sessions/:id/stop` / `POST /api/sessions/:id/reset` / `POST /api/sessions/:id/duplicate` が各 sub-handler に委譲されることが検証される ← S1（AI 補完: sessions.ts が session-crud.ts に委譲しているため委譲パスが通ることを確認する必要がある）

### Story 1.5: cron.ts の残存カバレッジ向上

> As a **開発者**, I want to `cron.ts` の未カバーブランチをテストする, so that branch 86% から 90% 以上に引き上げるため.

**受入基準:**

- [ ] **AC-E032-33**: `cron.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E032-34**: `GET /api/cron/:id/runs` でラストラン JSON のパースに失敗した場合（`try {}` の空のエラーハンドラー部）の振る舞いが検証される ← S1（AI 補完: 現状カバーされていない例外ブランチ）
- [ ] **AC-E032-35**: `POST /api/cron/:id/trigger` がジョブ不在時に 404 を返し、正常時に triggered フラグとともに即座に 200 を返すことが検証される ← S1

### Story 1.6: utils.ts の残存カバレッジ向上

> As a **開発者**, I want to `utils.ts` の未カバーブランチをテストする, so that branch 68% から 90% 以上に引き上げるため.

**受入基準:**

- [ ] **AC-E032-36**: `utils.ts` の branch カバレッジが 90% 以上に達する ← S1
- [ ] **AC-E032-37**: `resolveAttachmentPaths` がファイル ID 不正 / ファイルメタ不在 / disk 上のファイル不在 の各条件でパスを除外することが検証される ← S1（AI 補完: 68% ブランチにおける未カバー部分の主因）
- [ ] **AC-E032-38**: `deepMerge` が `***` プレースホルダーを持つ sanitized キーを上書きしないことが検証される ← S1
- [ ] **AC-E032-39**: `checkInstanceHealth` が正常応答（200）時に true を返し、タイムアウトや接続拒否時に false を返すことが検証される ← S1
- [ ] **AC-E032-40**: `readBodyRaw` が Buffer を返すことが検証される ← S1（AI 補完: readBody との対称性のため）

**インターフェース:** src/gateway/api/__tests__/ 以下にテストファイルを追加。依存モジュールはすべてモック化する。

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | 該当なし | — |
| DB スキーマ骨格 | 該当なし | — |
| API spec 骨格 | 該当なし | — |

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| PUT /api/config の body | plain object（非配列）であること | 400 Bad Request |
| PUT /api/config の body.gateway.port | number であること | 400 Bad Request |
| PUT /api/config の body キー | KNOWN_KEYS 内であること | 400 Bad Request |
| POST /api/sessions の prompt / message | どちらか必須 | 400 Bad Request |
| POST /api/sessions/bulk-delete の ids | 空でない配列 | 400 Bad Request |
| POST /api/connectors/:name/send の channel / text | 両方必須 | 400 Bad Request |
| POST /api/org/cross-request の fromEmployee / service / prompt | すべて必須 | 400 Bad Request |

## ステータス遷移（該当する場合）

該当なし（HTTP ハンドラーのテスト追加 Epic のため）

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| connectors/reload 非対応 | `context.reloadConnectorInstances` が undefined | 501 を返す | |
| コネクター不在 | `context.connectors.get(id)` が undefined | 404 を返す | |
| WhatsApp QR なし | `getQrCode()` が null | `{ qr: null }` を返す | |
| org cross-request fromEmployee 不在 | `orgRegistry.get(fromEmployee)` が null | 404 を返す | |
| org cross-request service 不在 | `services.get(service)` が undefined | `{ error: ... }` + 404 | |
| sessions bulkDelete ids 空 | `ids.length === 0` | 400 を返す | |
| sessions POST エンジン不在 | `sessionManager.getEngine(engine)` が null | status: error で 201 を返す | |

## 非機能要件

| 項目 | 基準 |
|------|------|
| カバレッジ（branch） | 各対象ファイルで 90% 以上 / src/gateway/api 全体で 90% 以上 |
| テスト実行時間 | 既存テストスイート全体の実行時間を 20% 以上増加させない |
| 外部依存 | ファイルシステム・HTTP 接続・cron scheduler はすべてモック化する |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 後続 Epic および Phase の開発者 |
| デリバリーする価値 | src/gateway/api の主要 HTTP ハンドラーが自動テストで保護され、機能追加・リファクタリング時のリグレッション検知が可能になる |
| デモシナリオ | `pnpm test --coverage` 実行後に src/gateway/api の branch カバレッジが 90% 以上と表示される |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | `pnpm test --coverage` で全 AC のカバレッジ条件を確認する。各 AC はユニットテストとして自動検証される |
| 検証環境 | ローカル環境（ファイルシステム・HTTP・cron はすべてモック。実サービス不要） |
| 前提条件 | `pnpm build` が通ること。各依存モジュール（sessions/registry, cron/jobs, 等）がモック可能であること |

## 他 Epic への依存・影響

- **依存**: ES-026（session-crud / session-message 等は ES-026 で対応済み）
- **依存**: ES-031（sessions.ts の呼び出し先 session-crud.ts のテストが整備済み）
- **影響**: なし（テスト追加のみ、実装コードは変更しない）

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `POST /api/org/cross-request` のセッション作成・エンジン実行部はモック境界でどこまでカバーするか | 未決定 | Task 実装時に判断 |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている
- [ ] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（権限制御なし: テスト追加のみ）
- [x] 関連 ADR が参照されている（該当なし）
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-ENNN-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [x] 所属 BC が記載されている
- [x] 設計成果物セクションが記入されている（該当なし）
