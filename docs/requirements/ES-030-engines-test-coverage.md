<!-- 配置先: docs/requirements/ES-030-engines-test-coverage.md — 相対リンクはこの配置先を前提としている -->
# ES-030: src/engines テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #211 |
| Phase 定義書 | PD-003 |
| Epic | E7 |
| 所属 BC | <!-- 該当なし（インフラ/テスト Epic） --> |
| ADR 参照 | — |

## 対応ストーリー

<!-- Phase 定義書のストーリーへの逆参照 -->

- S1: claude.ts（76.22% branch）の未カバー分岐にテストを追加し、90% 以上に到達する
- S2: codex.ts（78.57% branch）の未カバー分岐にテストを追加し、90% 以上に到達する
- S3: gemini.ts（72.8% branch）の未カバー分岐にテストを追加し、90% 以上に到達する

## 概要

Phase 3 (PD-003) E7 に対応する Epic。`src/engines` モジュールの branch カバレッジを 90% 以上に向上させる。対象は claude.ts・codex.ts・gemini.ts の 3 ファイルで、既存テスト（`src/engines/__tests__/`）を拡充する形で追加テストを実装する。claude-stream-processor.ts・mock.ts はすでに 100% に到達しているため対象外。

## ストーリーと受入基準

### Story 1: claude.ts テストカバレッジ向上

> As a **開発者**, I want to `claude.ts` の branch カバレッジが 90% 以上である状態にする, so that リグレッションを早期に検出できる。

**受入基準:**

- [ ] **AC-E030-01**: `claude.ts` の branch カバレッジが 90% 以上に到達する ← S1
- [ ] **AC-E030-02**: リトライロジック（`MAX_RETRIES=2`）の全分岐（成功・非transientエラー・transientエラー・deadセッションエラー・中断）がテストされている ← S1
- [ ] **AC-E030-03**: `isTransientError` 関数の全パターン（exit code 1 + 短い stderr、各 TRANSIENT_PATTERNS 正規表現）がテストされている ← S1（AI 補完: カバレッジレポートで branch 未到達が確認される関数）
- [ ] **AC-E030-04**: streaming モードと非 streaming モード両方の正常終了パスがテストされている ← S1
- [ ] **AC-E030-05**: `kill()` によるプロセス中断後、結果が `Interrupted` エラーとして返されることがテストされている ← S1（AI 補完: 既存テストで SIGTERM → SIGKILL の setTimeout フローが未カバーの可能性）
- [ ] **AC-E030-06**: `proc.on("error")` イベント（spawn 失敗）が reject を引き起こすことがテストされている ← S1（AI 補完: spawn エラーパスは重要な障害シナリオ）
- [ ] **AC-E030-07**: `parseClaudeJsonOutput` が配列・オブジェクト・rate_limit_event を含む各種出力形式を正しく解析することがテストされている ← S1（AI 補完: JSON パース分岐が branch カバレッジのボトルネック）

**インターフェース:** 内部実装テスト（`spawn` を vi.mock でモック）

### Story 2: codex.ts テストカバレッジ向上

> As a **開発者**, I want to `codex.ts` の branch カバレッジが 90% 以上である状態にする, so that リグレッションを早期に検出できる。

**受入基準:**

- [ ] **AC-E030-08**: `codex.ts` の branch カバレッジが 90% 以上に到達する ← S2
- [ ] **AC-E030-09**: `processJsonlLine` の全イベントタイプ（`thread.started`, `item.started` の command_execution/file_edit/file_read, `item.completed` の全種別, `turn.completed`, `turn.failed`, `error`）がテストされている ← S2
- [ ] **AC-E030-10**: `item.started` イベントで `item` が undefined の場合、null を返すことがテストされている ← S2（AI 補完: null チェック分岐は branch カバレッジに影響）
- [ ] **AC-E030-11**: `item.completed` の `agent_message` タイプで text が空の場合の分岐がテストされている ← S2（AI 補完: 空文字列パスが未カバー）
- [ ] **AC-E030-12**: `item.completed` の `error` タイプで "Under-development features" を含む場合に null を返すことがテストされている ← S2（AI 補完: suppress ロジックの分岐）
- [ ] **AC-E030-13**: `buildResumeArgs` で `resumeSessionId` が未指定の場合に throw することがテストされている ← S2（AI 補完: エラー分岐が未カバーの可能性）
- [ ] **AC-E030-14**: 残余 lineBuf のフラッシュ処理（`close` イベント時に lineBuf.trim() が非空の場合）がテストされている ← S2（AI 補完: close 時の lineBuf 残余処理は特殊ケース）
- [ ] **AC-E030-15**: `terminationReason` が設定されている状態でプロセスが終了した場合、中断エラーとして返されることがテストされている ← S2

**インターフェース:** 内部実装テスト（`spawn` を vi.mock でモック）

### Story 3: gemini.ts テストカバレッジ向上

> As a **開発者**, I want to `gemini.ts` の branch カバレッジが 90% 以上である状態にする, so that リグレッションを早期に検出できる。

**受入基準:**

- [ ] **AC-E030-16**: `gemini.ts` の branch カバレッジが 90% 以上に到達する ← S3
- [ ] **AC-E030-17**: `processStreamLine` の全イベントタイプ（`session.start`/`session.started`, `text`/`content.text`/`text_delta`, `tool.start`/`tool_use`/`function_call`, `tool.end`/`tool_result`/`function_response`, `turn.complete`/`turn.completed`, `error`, `result`, 未知タイプ）がテストされている ← S3
- [ ] **AC-E030-18**: `processStreamLine` で `session_id` が空の場合に null を返すことがテストされている ← S3（AI 補完: 空 session_id の分岐）
- [ ] **AC-E030-19**: `processStreamLine` で `text` イベントの text が空の場合に null を返すことがテストされている ← S3（AI 補完: 空文字列パス）
- [ ] **AC-E030-20**: `parseJsonOutput` が配列形式（result イベントあり・なし）およびオブジェクト形式および文字列形式を正しく解析することがテストされている ← S3（AI 補完: JSON パース分岐が branch カバレッジのボトルネック）
- [ ] **AC-E030-21**: 非 streaming モードで JSON パースに失敗した場合、error 付きの結果が返されることがテストされている ← S3（AI 補完: parseJsonOutput の catch 分岐）
- [ ] **AC-E030-22**: streaming モードで `terminationReason` が設定された状態でプロセス終了した場合、中断エラーとして返されることがテストされている ← S3
- [ ] **AC-E030-23**: streaming モードで close 時に lineBuf に残余データがある場合にフラッシュされることがテストされている ← S3（AI 補完: streaming 残余 lineBuf 処理）
- [ ] **AC-E030-24**: `proc.on("error")` イベント（spawn 失敗）が reject を引き起こすことがテストされている ← S3（AI 補完: spawn エラーパスは重要な障害シナリオ）

**インターフェース:** 内部実装テスト（`spawn` を vi.mock でモック）

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | 該当なし | — |
| DB スキーマ骨格 | 該当なし | — |
| API spec 骨格 | 該当なし | — |

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| — | — | — |

## ステータス遷移（該当する場合）

該当なし

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| spawn 失敗 | `proc.on("error")` が発火 | Promise が reject される | spawn 自体が失敗したケース |
| transient エラー | stderr が TRANSIENT_PATTERNS にマッチ | MAX_RETRIES まで再試行される | claude.ts のリトライロジック |
| dead session | `isDeadSessionError` が true | リトライなしで即時返却 | claude.ts の dead session 判定 |

## 非機能要件

| 項目 | 基準 |
|------|------|
| branch カバレッジ（claude.ts） | 90% 以上 |
| branch カバレッジ（codex.ts） | 90% 以上 |
| branch カバレッジ（gemini.ts） | 90% 以上 |
| テスト追加方法 | 既存テストファイルを拡充（新規ファイル作成なし） |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 後続 Epic の開発者・メンテナー |
| デリバリーする価値 | engines モジュールのリグレッション検出率が向上し、claude/codex/gemini エンジンの各エラーパス・エッジケースが自動テストで保護される |
| デモシナリオ | `pnpm test` 実行後、claude.ts・codex.ts・gemini.ts の branch カバレッジがそれぞれ 90% 以上であることをカバレッジレポートで確認する |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | AC-E030-01・AC-E030-08・AC-E030-16（各ファイルのカバレッジ 90% 以上）を vitest カバレッジレポートで確認 |
| 検証環境 | ローカル環境。`spawn` は vi.mock でモック。外部 CLI への接続不要 |
| 前提条件 | `pnpm test --coverage` が実行できる状態 |

## 他 Epic への依存・影響

- ES-003（test-coverage-improvement）: 先行する engines テスト基盤 Epic。既存の `__tests__/` ファイルを拡充する
- 依存なし（後続 Epic への影響もなし）

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `engine-runner.ts` の有無 | 解決済み（存在しない。カバレッジレポートに記載なし） | — |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている
- [x] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（テスト実装のみ、権限不要）
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
- [x] 所属 BC が記載され、BC キャンバスが docs/domain/ に存在する（テスト Epic のため BC なし）
- [x] 設計成果物セクションが記入されている（該当なし）
