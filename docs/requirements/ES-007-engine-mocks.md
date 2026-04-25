<!-- 配置先: docs/requirements/ES-007-engine-mocks.md — 相対リンクはこの配置先を前提としている -->
# ES-007: テストカバレッジ改善 — グループA（エンジン child_process モック）

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #74 |
| Phase 定義書 | PD-002 |
| Epic | E7（テスト拡充 — engines サブグループ） |
| 所属 BC | — （テスト追加のみ。ドメインモデルなし） |
| ADR 参照 | — （テスト方針は docs/conventions/testing.md に記載済み） |

## 対応ストーリー

<!-- Phase 定義書 PD-002 §3 から転記 -->

- S10: As a **開発者**, I want to `engines/claude.ts`（89条件分岐）のストリーミング処理を状態機械に整理したい, so that デルタ処理の条件分岐が追跡しやすくなり、新エンジン追加時の参考実装になる.

> **スコープ注記:** ES-007 は S10 の「リファクタリング」部分は対象外（後続 Epic で対応）。
> `engines/claude.ts`・`engines/codex.ts` に `vi.mock("node:child_process")` パターンでテストを追加し、主要ロジックを先に検証可能にすることに集中する。
> これにより、今後のリファクタリング（状態機械整理）を安全に進める土台を作る。
> `engines/gemini.ts` は同手法で 86% カバレッジ達成済み（`engines/__tests__/gemini.test.ts` 参照）。

## 概要

`engines/claude.ts`（622行）・`engines/codex.ts`（391行）に `vi.mock("node:child_process")` パターンでテストを追加し、両エンジンの branch カバレッジを 70% 以上に引き上げる。`gemini.ts` と同じ `InterruptibleEngine` インターフェースを実装しているため、同一テストパターンが適用可能。

現状（テスト追加前）0% → 目標 70%+。

## ストーリーと受入基準

### Story 1: `engines/claude.ts` のテスト追加

> As a **開発者**, I want to `engines/claude.ts` に `vi.mock("node:child_process")` パターンでテストを追加したい, so that エンジンの主要ロジック（ストリーミング・ライフサイクル・エラー処理）が自動検証され、将来のリファクタリングを安全に行えるようになる.

**受入基準:**

- [ ] **AC-E007-01**: 開発者が `packages/jimmy` で `pnpm test` を実行すると、`engines/__tests__/claude.test.ts` が認識・実行され、identity / lifecycle / run（非ストリーミング） / run（引数構築） / run（エラーシナリオ） / run（ストリーミング） の全テストグループが PASS する。 ← S10
- [ ] **AC-E007-02**: `vi.mock("node:child_process")` で spawn をモックした `claude.test.ts` が作成されており、`createMockProcess()` ヘルパーを使って EventEmitter ベースの擬似プロセスを生成し、stdout / stderr / close / error イベントを任意のタイミングで発行できる。 ← S10（AI 補完: テストインフラの構造を AC 化することでテスト方針を明確化）
- [ ] **AC-E007-03**: `pnpm test --coverage` を実行すると `engines/claude.ts` の branch カバレッジが **70% 以上**になる。 ← S10

**インターフェース:** `InterruptibleEngine` (`src/shared/types.ts`) — `run(opts: EngineRunOpts): Promise<EngineResult>` / `kill(sessionId: string)` / `isAlive(sessionId: string): boolean` / `killAll()`

### Story 2: `engines/codex.ts` のテスト追加

> As a **開発者**, I want to `engines/codex.ts` に同一パターンでテストを追加したい, so that claude.ts と同様に主要ロジックが自動検証され、2エンジンのテスト基盤が揃う.

**受入基準:**

- [ ] **AC-E007-04**: `engines/__tests__/codex.test.ts` が作成されており、identity / lifecycle / buildFreshArgs / buildResumeArgs / processJsonlLine / run（成功） / run（ストリーミング） / run（エラー）/ run（kill） の全テストグループが PASS する。 ← S10（AI 補完: codex の JSONL 解析ロジックは複数の分岐を持つため個別グループとして明示）
- [ ] **AC-E007-05**: `pnpm test --coverage` を実行すると `engines/codex.ts` の branch カバレッジが **70% 以上**になる。 ← S10

### Story 3: 既存テストへの非干渉

> As a **開発者**, I want to 両エンジンのテスト追加後も既存テストが全 PASS することを確認したい, so that テスト追加がリグレッションを引き起こしていないことを担保できる.

**受入基準:**

- [ ] **AC-E007-06**: `pnpm test` を実行すると、`gemini.test.ts`・`mock.test.ts` 等の既存テストが全て引き続き PASS する。 ← S10（AI 補完: テスト追加時の副作用チェックは品質保証上必須）
- [ ] **AC-E007-07**: `pnpm build` が PASS し、既存コードの構造（`engines/claude.ts`・`engines/codex.ts` の実装本体）が変更されていないことを確認できる。 ← S10（AI 補完: テスト追加でソースを変更しないことの検証）

**インターフェース:** カバレッジレポート（HTML / テキスト出力）。外部 API なし。

## 設計成果物

<!-- テスト追加のみ Epic のため、ドメインモデル・DB スキーマ・API spec は該当なし -->

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | — | 該当なし（ドメインモデルなし） |
| DB スキーマ骨格 | — | 該当なし（データ永続化なし） |
| API spec 骨格 | — | 該当なし（API 変更なし） |

**スキップ理由:** ES-007 はテスト追加のみ。新しいドメイン概念・DB テーブル・API エンドポイントを導入しないため、Step 2-3 をスキップする。

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| vi.mock のスコープ | `vi.mock("node:child_process")` はファイルの先頭で宣言し、ホイスティングにより全テストに適用される | ホイスティング順を誤るとモックが効かないため、import 順を調整する |
| EventEmitter ベースのモック | `createMockProcess()` が stdout / stderr / EventEmitter を正しく持つこと | 必要プロパティが欠けていると型エラーまたはランタイムエラーが発生する |
| カバレッジ閾値 | branch 70%（claude.ts・codex.ts それぞれ） | 閾値未達の場合は未カバーの条件分岐にテストを追加する |

## ステータス遷移（該当なし）

テスト追加のみ。エンティティのステータス遷移なし。

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| spawn エラー | `proc.emit("error", new Error("ENOENT"))` | `engine.run()` が rejected または error を含む EngineResult を返す | claude.ts は spawn error を error EngineResult に変換する |
| 非ゼロ終了コード | `proc.emit("close", 1)` | エラーメッセージを含む EngineResult が返る | exit code 非ゼロでも stdout JSON が有効な場合は JSON を優先する |
| セッション kill 後の run | `engine.kill(sessionId)` 後に close | terminationReason を含む EngineResult が返る | kill フラグで正常終了と区別する |
| JSON パース失敗 | stdout に不正 JSON | エラー EngineResult を返す（例外を投げない） | claude.ts は JSON parse 失敗をハンドルして error 扱いにする |
| processJsonlLine 不明イベント | codex の JSONL に未知の type | null を返し無視する | codex.ts は未知イベントを安全に無視する設計 |

## 非機能要件

| 項目 | 基準 |
|------|------|
| テスト実行時間 | `pnpm test --coverage` が 120 秒以内に完了する |
| テストの独立性 | `vi.clearAllMocks()` を `beforeEach` で呼び出し、各テストが独立して実行できる |
| モック方針 | `vi.mock("node:child_process")` でグローバルモックを使用（`node:child_process` は引数注入が困難な外部 I/O のため例外的に許容。`docs/conventions/testing.md` の `suppress-approved: node:child_process グローバルモックは引数注入不可の OS 依存 I/O のため許容` に準拠） |
| リファクタリング禁止 | `engines/claude.ts`・`engines/codex.ts` の実装本体を変更しない。テストコードのみ追加する |
| 型安全 | `MockProcess` インターフェースを定義し `vi.mocked()` でモックの型付けを行う |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 開発者（自分） |
| デリバリーする価値 | `engines/claude.ts`・`engines/codex.ts` の branch カバレッジが 0% → 70%+ に向上し、両エンジンの主要ロジック（ライフサイクル・ストリーミング・エラー処理）が自動検証される。E6（engines/claude 整理）等の後続リファクタリングを安全に進める土台が整う。 |
| デモシナリオ | 1. `packages/jimmy` で `pnpm test --coverage` を実行する → 2. `engines/claude.ts` の branch カバレッジが 70% 以上を示す → 3. `engines/codex.ts` の branch カバレッジが 70% 以上を示す → 4. 既存テスト（gemini.test.ts 等）が全 PASS することを確認する |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | AC-E007-01〜07: `packages/jimmy` で `pnpm test --coverage` を実行し全テスト PASS + claude.ts・codex.ts の branch カバレッジ 70% 以上を確認（自動検証）。`pnpm build` が PASS することを確認（手動デモ）。 |
| 検証環境 | ローカル開発環境（Node.js + pnpm）。外部サービス・gateway 起動は不要。`node:child_process` は vitest の `vi.mock` で完全モック。 |
| 前提条件 | `pnpm install` 完了。`@vitest/coverage-v8` インストール済み（ES-002 で対応済み）。`engines/__tests__/gemini.test.ts` が参照実装として存在すること。 |

## 他 Epic への依存・影響

- **ES-003（テスト拡充基盤）に依存（完了済み）**: vitest 設定・`@vitest/coverage-v8` が整備されている前提
- **ES-004（CI 品質ゲート）に依存（完了済み）**: CI でのカバレッジ閾値チェックが有効であることを前提
- **E6（engines/claude 整理, S10）に依存される**: engines テスト（本 Epic）が揃ってからリファクタリングを安全に実施できる
- **E7（テスト拡充 sessions）と並行可能**: sessions テストとは独立して実施可能
- **PD-002 成功基準（branch カバレッジ 40%）に貢献**: engines の 0% → 70% は全体カバレッジ向上に直接貢献する

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `engines/claude.ts` の streaming モードでの詳細デルタ処理の AC 網羅範囲（content_block_delta / tool_use / tool_result / text_snapshot） | 確定: 実装済みテストで対象グループを明示（AC-E007-01 に含む） | — |
| 2 | `vi.mock` グローバルモックの許容判断（testing.md の原則との兼ね合い） | 確定: `node:child_process` は引数注入不可な OS 依存 I/O のため例外的に許容（非機能要件に記載） | — |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている（S1: AC-E007-01〜03、S2: AC-E007-04〜05、S3: AC-E007-06〜07）
- [x] 正常系・異常系のレスポンスが定義されている（エラーケース: 5 件）
- [x] バリデーションルールが網羅されている（vi.mock スコープ・EventEmitter 構造・カバレッジ閾値）
- [x] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（開発者のみ — ローカル操作）
- [x] 関連 ADR が参照されている（ADR 不要。testing.md に方針記載済み）
- [x] 非機能要件が定義されている（実行時間・独立性・モック方針・リファクタリング禁止・型安全）
- [x] 他 Epic への依存・影響が明記されている（ES-003・ES-004・E6・E7・PD-002 成功基準）
- [x] 未決定事項が明示されている（2 件、いずれも確定）
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-E007-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている（S10）
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（AC-E007-02、AC-E007-04、AC-E007-06、AC-E007-07）
- [x] 所属 BC が記載されている（該当なし — ドメインモデルなし）
- [x] 設計成果物セクションが記入されている（該当なし、スキップ理由記載）
