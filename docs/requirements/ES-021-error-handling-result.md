<!-- 配置先: docs/requirements/ES-021-error-handling-result.md -->
# ES-021: エラーハンドリング統一 — Result<T,E> パターン導入

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #133 |
| Phase 定義書 | docs/requirements/PD-002-code-restructuring.md |
| Epic | E10（エラーハンドリング統一） |
| 所属 BC | — （既存コード構造改善。新ドメインモデルなし） |
| ADR 参照 | — |

## 対応ストーリー

- S15: As a **開発者**, I want to エラーハンドリングを型付き `Result<T, E>` パターンに統一したい, so that 例外フローと正常フローが型レベルで区別され、握り潰しを防げる.

## 概要

現在のコードベースには 162 箇所の `try/catch` と 90 箇所の `throw` が存在し、エラーの扱い方が統一されていない。
このEpicでは `shared/result.ts` に軽量な `Result<T, E>` 型と `ok`/`err` ユーティリティを定義し、
新規コードから Result パターンを適用する。既存コードは段階的に移行するための指針を整備する。

## ストーリーと受入基準

### Story 21.1: Result<T,E> 型定義と基本ユーティリティの実装（S15）

> As a **開発者**, I want to `shared/result.ts` に `Result<T, E>` 型と `ok`/`err` ヘルパーを実装したい, so that 型安全なエラーハンドリングの基盤を用意できる.

**受入基準:**

- [ ] **AC-E021-01**: 開発者が `ok(value)` を呼ぶと `{ success: true, value }` の `Ok<T>` 型が返る. ← S15
- [ ] **AC-E021-02**: 開発者が `err(error)` を呼ぶと `{ success: false, error }` の `Err<E>` 型が返る. ← S15
- [ ] **AC-E021-03**: 開発者が `Result<T, E>` 型を引数に取る関数を定義すると、TypeScript が `result.success` による型ナローイングを認識し、`result.value`（Ok 時）および `result.error`（Err 時）に型安全にアクセスできる. ← S15（AI 補完: 型ナローイングが動作しないと Result パターンの恩恵が得られないため必須）
- [ ] **AC-E021-04**: 開発者が `shared/result.ts` を `import` するだけで利用でき、外部ライブラリへの依存を追加しない. ← S15（AI 補完: 依存追加なしの軽量実装が望ましい — neverthrow 等の採用はユーザー判断が必要）

**インターフェース:** `packages/jimmy/src/shared/result.ts`（新規作成）

### Story 21.2: 新規コードへの Result パターン適用（S15）

> As a **開発者**, I want to `sessions/repositories/` 境界の主要関数に `Result<T, E>` を適用したい, so that Repository の失敗が型レベルで表現され、呼び出し元が握り潰しを防げる.

**受入基準:**

- [ ] **AC-E021-05**: 開発者が `ISessionRepository` の `findById` / `findByKey` を呼ぶと、セッションが存在する場合 `Ok<Session>` が返り、存在しない場合 `Ok<null>` が返る（not-found は正常系として扱う）. ← S15
- [ ] **AC-E021-06**: 開発者が `ISessionRepository` の `save` / `update` を呼ぶと、成功時 `Ok<void>` が返り、DB 制約違反などの永続化エラー時 `Err<RepositoryError>` が返る. ← S15（AI 補完: 永続化エラーを型表現することで呼び出し元が強制的にハンドリングできる）
- [ ] **AC-E021-07**: 開発者が `SqliteSessionRepository` と `InMemorySessionRepository` の両実装で同一のシグネチャが保たれていることを TypeScript のコンパイルで確認できる. ← S15（AI 補完: インターフェース整合性の保証はリファクタリング安全性の核心）
- [ ] **AC-E021-08**: 既存の Repository 利用箇所（`engine-runner.ts` など）が Result を受け取る形に更新され、`pnpm build && pnpm test` が PASS する. ← S15

**インターフェース:** `packages/jimmy/src/sessions/repositories/ISessionRepository.ts`（更新）、`SqliteSessionRepository.ts`（更新）、`InMemorySessionRepository.ts`（更新）

### Story 21.3: 移行指針の整備と engine-runner 境界への試験適用（S15）

> As a **開発者**, I want to 既存コードの段階的移行指針を `docs/` に記録し、`engine-runner.ts` の主要関数に Result を試験適用したい, so that 今後の移行で一貫した判断基準を参照できる.

**受入基準:**

- [ ] **AC-E021-09**: 開発者が `docs/conventions/error-handling.md` を読むと、「いつ Result を使うか（公開 API 境界・Repository 境界）」と「いつ throw を使うか（プログラムバグ・致命的エラー）」の基準が明示されている. ← S15
- [ ] **AC-E021-10**: 開発者が `engine-runner.ts` の `runEngine` 関数を呼ぶと、エンジン実行エラー（rate limit / dead session 等）が `Err<EngineError>` として返り、正常完了が `Ok<EngineResult>` として返る. ← S15（AI 補完: engine-runner は最もエラーハンドリングが重要な境界であり試験適用の対象として適切）
- [ ] **AC-E021-11**: 既存の呼び出し元（`SessionManager` 相当のコード）が Result を受け取る形に更新され、`pnpm build && pnpm test` が PASS する. ← S15

**インターフェース:** `docs/conventions/error-handling.md`（新規作成または更新）、`packages/jimmy/src/sessions/engine-runner.ts`（更新）

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | — | 該当なし（既存コード構造改善のみ） |
| DB スキーマ骨格 | — | 該当なし |
| API spec 骨格 | — | 該当なし |

## バリデーションルール

該当なし（型定義・関数実装 Epic のため）

## ステータス遷移（該当する場合）

該当なし

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| Repository 永続化エラー | DB 制約違反・SQLite エラー | `Err<RepositoryError>` を返す。throw しない | 呼び出し元が強制的にエラーハンドリングできるよう型で強制 |
| engine-runner: rate limit | `detectRateLimit` が `limited: true` を返す | `Err<EngineError>` (`kind: "rate_limit"`) を返す | 既存の `detectRateLimit` ロジックを Result で包む |
| engine-runner: dead session | `isDeadSessionError` が true を返す | `Err<EngineError>` (`kind: "dead_session"`) を返す | 同上 |
| ok/err の型推論 | `ok(undefined)` / `err(undefined)` | `Ok<undefined>` / `Err<undefined>` として推論される（never は使わない） | エッジケースの型安全性 |

## 非機能要件

| 項目 | 基準 |
|------|------|
| ビルド・テスト | `pnpm build && pnpm test` が全て PASS すること |
| 外部依存 | `neverthrow` 等の新規ライブラリを追加しないこと（ユーザー承認なし） |
| biome-ignore 禁止 | eslint-disable / biome-ignore 等の抑制コメントを使用しないこと |
| 後方互換 | 既存の `try/catch` コードをすべて移行するものではない（段階的移行） |
| 型安全 | `result.success` によるナローイングが TypeScript 5.x で動作すること |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 開発者（このリポジトリをメンテナンスする人） |
| デリバリーする価値 | 公開 API 境界（Repository・engine-runner）のエラーが型レベルで表現され、将来のリファクタリングでエラー握り潰しをコンパイル時に検知できる |
| デモシナリオ | `pnpm build && pnpm test` が PASS し、`ISessionRepository.findById` の戻り値が `Result<Session \| null, RepositoryError>` として型推論される |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | 全 AC を `pnpm build && pnpm test` (TypeScript コンパイル + vitest) で自動検証。特に Result 型ナローイングは TypeScript コンパイルで確認 |
| 検証環境 | ローカル + CI（GitHub Actions）。外部接続不要 |
| 前提条件 | `pnpm build` が PASS すること。biome ゼロ警告 |

## 他 Epic への依存・影響

- **依存**: ES-017（Repository パターン — sessions/registry.ts 抽象化）— 完了済み。`ISessionRepository` インターフェースが存在する前提
- **影響**: 後続 Epic で Result パターンを活用する際の型基盤を提供する。E11（型安全性向上）と連携

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `neverthrow` 等の外部ライブラリを採用するか、自前実装にするか | 未決定（AC-E021-04 は自前実装を前提にしているが、外部ライブラリへの変更はユーザー承認が必要） | Task 実装前にユーザーと確認 |
| 2 | `IQueueRepository` / `IFileRepository` / `IMessageRepository` にも Result を適用するか | 未決定（スコープ拡大になる可能性。まず `ISessionRepository` のみを対象とし、後続で判断） | Task 実装時に判断 |
| 3 | `engine-runner.ts` の `runEngine`（AC-E021-10）はどのスコープまで Result 化するか（関数全体か、サブ関数のみか） | 未決定 | Task 実装時に判断 |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている（型定義 Epic のため該当なし）
- [x] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（開発者向け内部実装 Epic のため該当なし）
- [x] 関連 ADR が参照されている（該当なし — ADR 作成は Task で判断）
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-E021-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [x] 所属 BC が記載されている（該当なし — 既存コード構造改善のみ）
- [x] 設計成果物セクションが記入されている（該当なし）
