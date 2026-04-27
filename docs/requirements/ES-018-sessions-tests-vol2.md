<!-- 配置先: docs/requirements/ES-018-sessions-tests-vol2.md -->
# ES-018: E7-vol.2 — sessions テスト拡充 vol.2（context.ts / engine-runner.ts）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #117 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |
| Epic | E7（テスト拡充 sessions）の継続 |
| 所属 BC | — （設計ステップスキップ: 既存コードへのテスト追加のみ） |
| ADR 参照 | — |

## 対応ストーリー

- S11: As a **開発者**, I want to `sessions/` モジュールのテストカバレッジを拡充したい, so that manager / context / registry の主要パスが自動検証される.
- S14: As a **開発者**, I want to Phase 2 完了時に branch カバレッジを 40% 以上に引き上げたい, so that リファクタリング後のリグレッションを定量的に検知できる.

## 概要

ES-015（sessions テスト拡充 vol.1）で注記した「engine-runner.ts のテスト追加は別 Epic で実施予定」の実施 Epic。
`sessions/context.ts`（825行・branch カバレッジ 1.16%）と `sessions/engine-runner.ts`（678行・branch カバレッジ 3.39%）を主なターゲットとして、
純粋関数・ユーティリティ関数を中心にテストを追加し、Phase 2 の branch カバレッジ 40% 達成に貢献する。

ES-016 完了時点での全体 branch カバレッジ: **32.61%**。本 Epic で 40% 達成を目指す。

## ストーリーと受入基準

### Story 18.1: context.ts の純粋関数・ユーティリティをテスト済みにする

> As a **開発者**, I want to `sessions/context.ts` の主要な純粋関数（`buildContext` など）をテスト済みにしたい, so that コンテキスト構築ロジックのリグレッションが自動検知される.

**受入基準:**

<!-- AC はユーザー視点の E2E シナリオとして記述する -->

- [ ] **AC-E018-01**: `buildContext` に employee なし・config なしの最小引数を渡すと、`## Current session` セクションを含む文字列が返される ← S11
- [ ] **AC-E018-02**: `buildContext` に employee ありの引数を渡すと、`# You are` で始まるアイデンティティセクションが出力に含まれる ← S11
- [ ] **AC-E018-03**: `buildContext` に config.context.maxChars を小さい値（例: 100）で渡すと、返却文字列が maxChars 以内に収まる（trimContext が機能する）← S11（AI 補完: budget trimming は分岐が多いため重要テスト対象）
- [ ] **AC-E018-04**: `buildContext` に language が "English" 以外の config を渡すと、「When following skill instructions」セクションが出力に含まれる ← S11（AI 補完: 言語オーバーライド分岐のカバレッジ向上）
- [ ] **AC-E018-05**: `buildContext` に channelName を渡すと、`- Channel: #<channelName>` の形式で出力される ← S11
- [ ] **AC-E018-06**: `buildContext` に source="slack" かつ channel が "D" 始まりを渡すと、「Direct Message」と出力される ← S11（AI 補完: チャンネル種別分岐のカバレッジ）
- [ ] **AC-E018-07**: `buildContext` に thread を渡すと `- Thread: <thread>` が出力に含まれる ← S11

**インターフェース:** `sessions/context.ts` の `buildContext` 関数（エクスポート済み）

### Story 18.2: engine-runner.ts のエンジン不在・budget 超過パスをテスト済みにする

> As a **開発者**, I want to `sessions/engine-runner.ts` の主要エラーパス・ガード節をテスト済みにしたい, so that エンジン不在・budget 超過などの境界条件が自動検証される.

**受入基準:**

- [ ] **AC-E018-08**: `runSession` に engines Map に存在しないエンジン名を持つ session を渡すと、`connector.replyMessage` が呼ばれ、関数が早期終了する ← S11
- [ ] **AC-E018-09**: `runSession` で session.employee が budget を超過している場合（checkBudget が "paused" を返す）、`connector.replyMessage` にエラーメッセージが送られ、session の status が "error" に更新される ← S11（AI 補完: budget 超過は重要なガード節）
- [ ] **AC-E018-10**: `runSession` で session.source が "cron" の場合、`connector.addReaction` が呼ばれない（`decorateMessages = false`） ← S11（AI 補完: cron ソース分岐のカバレッジ向上）
- [ ] **AC-E018-11**: `pnpm test` が全 PASS する ← S11, S14
- [ ] **AC-E018-12**: 本 Epic 完了後の全体 branch カバレッジが 40% 以上になる ← S14

**インターフェース:** `sessions/engine-runner.ts` の `runSession` 関数（エクスポート済み）

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | — | 該当なし（既存コードへのテスト追加のみ） |
| DB スキーマ骨格 | — | 該当なし |
| API spec 骨格 | — | 該当なし |

> **設計ステップスキップ理由:** 本 Epic は既存モジュール（context.ts / engine-runner.ts）へのテスト追加のみであり、新たなドメインモデル・DB・API は発生しない。Step 2-3 をスキップして Step 1 のみで完結する。

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| テストファイル名 | `sessions/__tests__/context.test.ts`, `sessions/__tests__/engine-runner.test.ts` に追加 | — |
| モック境界 | fs モジュール・gateway/org・gateway/services を vi.mock で分離する | — |

## ステータス遷移（該当する場合）

該当なし

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| engine-runner: エンジン不在 | engines.get(session.engine) が undefined | connector.replyMessage でエラー通知・即時 return | AC-E018-08 |
| engine-runner: budget 超過 | checkBudget が "paused" を返す | session status を "error" に更新・replyMessage で通知 | AC-E018-09 |
| context: maxChars 超過 | 生成テキストが maxChars を超える | OPTIONAL → STANDARD の順に要約に置換して収める | AC-E018-03 |

## 非機能要件

| 項目 | 基準 |
|------|------|
| テスト実行 | `pnpm test` が全 PASS する |
| カバレッジ | Phase 2 完了時に branch 40% 以上 |
| biome | 警告・エラーゼロ |
| 型チェック | `pnpm typecheck` PASS |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 開発者（自分）: sessions モジュールを変更する際にリグレッションを自動検知したい |
| デリバリーする価値 | context.ts / engine-runner.ts の主要パス・エラーパスが自動検証され、Phase 2 の branch カバレッジ 40% 目標が達成される |
| デモシナリオ | `pnpm test --coverage` を実行し、branch カバレッジが 40% 以上になることを確認する |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | `pnpm test` 全 PASS + `pnpm test --coverage` で branch 40% 以上 |
| 検証環境 | ローカル（外部依存なし。fs・gateway モジュールは vi.mock で分離） |
| 前提条件 | `pnpm build` PASS、既存テストが全 PASS していること |

## 他 Epic への依存・影響

- **依存:** ES-015（sessions テスト拡充 vol.1 — mergeTransportMeta / SessionManager）、ES-016（gateway テスト拡充）の完了が前提（カバレッジベースライン 32.61%）
- **依存:** ES-017（Repository パターン — Repositories 型が engine-runner.ts のモック設計に影響する）
- **影響:** Phase 2 の成功基準「branch カバレッジ 40% 以上」の達成に直接貢献する

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | engine-runner.ts の `runSession` はレートリミット・fallback エンジン切替などの複雑なロジックを含む。モック設計が複雑になる可能性がある | 未決定 | 実装中に判断 |
| 2 | context.ts の `buildOrgContext` は fs.readdirSync を呼ぶ。vi.mock で fs を分離するか、tempdir を使うか | 未決定 | 実装中に判断（vi.mock 推奨） |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている
- [ ] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（開発者ローカル実行のみ）
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
- [x] 所属 BC が記載され（該当なし）
- [x] 設計成果物セクションが記入されている（該当なし）
