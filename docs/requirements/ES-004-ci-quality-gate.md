<!-- 配置先: docs/requirements/ES-004-ci-quality-gate.md — 相対リンクはこの配置先を前提としている -->
# ES-004: CI 品質ゲート

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #60 |
| Phase 定義書 | PD-001 |
| Epic | E3 |
| 所属 BC | — （CI/DevOps 整備。ドメインモデルなし） |
| ADR 参照 | — （CI 設定は docs/conventions/ 参照） |

## 対応ストーリー

<!-- Phase 定義書 PD-001 §3 から転記 -->

- S8: As a **開発者**, I want to `pnpm biome check` がゼロ警告でパスすることを CI で検証したい, so that 品質劣化を自動検知できる.
- S9: As a **開発者**, I want to CI でテストカバレッジ閾値（branch 60%）を強制したい, so that カバレッジ低下を自動的に防げる.

> **スコープ注記:** E2E テストジョブは今回スコープ外（ES-002 調査で未整備と確定）。biome check と coverage 閾値の 2 つのゲートを追加する。coverage 閾値は `vitest.config.ts` の `thresholds` に委譲し、CI 側に数値を持たない。

## 概要

現状の `.github/workflows/ci.yml` には `typecheck`・`unit-tests`（coverage なし）・`build` の 3 ジョブが存在する。本 Epic では以下を追加し、PR ごとに品質が自動検証される状態を確立する:

1. **biome ジョブ追加** — `pnpm biome check` をゼロエラー・ゼロ警告で通過することを CI で強制
2. **unit-tests に `--coverage` フラグ追加** — `vitest.config.ts` の `thresholds`（branches: 18, functions: 26）を下回ると CI が FAIL

## ストーリーと受入基準

### Story 8: biome check CI 統合

> As a **開発者**, I want to `pnpm biome check` がゼロ警告でパスすることを CI で検証したい, so that 品質劣化を自動検知できる.

**受入基準:**

<!-- AC-ID 形式: AC-E004-NN -->

- [x] **AC-E004-01**: `.github/workflows/ci.yml` に `biome` ジョブが追加され、PR に対して `pnpm biome check` がゼロエラー・ゼロ警告で PASS する。Node.js 22・pnpm キャッシュ設定は既存ジョブと同一。 ← S8

### Story 9: coverage 閾値 CI 強制

> As a **開発者**, I want to CI でテストカバレッジ閾値（branch 60%）を強制したい, so that カバレッジ低下を自動的に防げる.

**受入基準:**

- [x] **AC-E004-02**: `.github/workflows/ci.yml` の `unit-tests` ジョブが `pnpm test --coverage --run` で実行され、`vitest.config.ts` の `thresholds`（branches: 18, functions: 26）を下回った場合に CI が FAIL する。 ← S9
- [x] **AC-E004-03**: `biome` ジョブ・coverage 付き `unit-tests` ジョブが Node.js 22・pnpm `action-setup`・`--frozen-lockfile` を使用し、既存ジョブと設定の一貫性を保つ。 ← S8, S9
- [x] **AC-E004-04**: `biome` ジョブと coverage 付き `unit-tests` ジョブが実際の PR で PASS することをブランチの GitHub Actions 実行で確認する。 ← S8, S9

**インターフェース:** `.github/workflows/ci.yml`。外部 API なし。

## 設計成果物

<!-- CI/DevOps 整備のため、ドメインモデル・DB スキーマ・API spec は該当なし -->

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| CI ワークフロー | `.github/workflows/ci.yml` | 実装予定 |
| 集約モデル詳細 | — | 該当なし |
| DB スキーマ骨格 | — | 該当なし |
| API spec 骨格 | — | 該当なし |

**スキップ理由:** ES-004 は CI 設定追加のみ。新しいドメイン概念・DB テーブル・API エンドポイントを導入しない。

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| biome check | ゼロエラー・ゼロ警告 | CI FAIL。修正なしでマージ不可 |
| coverage 閾値 | `vitest.config.ts` の thresholds 準拠 | CI FAIL（vitest が exit code 1 を返す） |

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| biome 違反あり | `pnpm biome check` が非ゼロ終了 | `biome` ジョブが FAIL し PR がマージ不可になる | 品質劣化の自動検知 |
| coverage 閾値未達 | `pnpm test --coverage` が thresholds を下回る | `unit-tests` ジョブが FAIL し PR がマージ不可になる | テスト品質の劣化防止 |
| ワークフロー設定ミス | YAML 構文エラー / 不正な action バージョン | CI がスタートアップ時に FAIL | ワークフロー追加前に構文確認が必要 |

## 非機能要件

| 項目 | 基準 |
|------|------|
| CI 実行時間 | biome ジョブ: 60 秒以内。coverage ジョブ: 120 秒以内（`pnpm test --coverage` の実測値 ~2秒） |
| キャッシュ活用 | `pnpm` パッケージキャッシュを使用し、インストール時間を最小化 |
| 設定の一貫性 | Node.js バージョン・pnpm セットアップは既存ジョブと同一設定を使用 |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 開発者（自分） |
| デリバリーする価値 | PR ごとに biome check と coverage 閾値が自動検証され、品質劣化がマージ前に自動検知される。手動確認のコストがなくなり、安心してコードを変更できる。 |
| デモシナリオ | 1. Biome 違反を含む変更を PR として作成する → 2. `biome` ジョブが FAIL して PR がマージ不可になることを確認する → 3. 違反を修正して再プッシュ → 4. 全ジョブ PASS でマージ可能になることを確認する |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | AC-E004-01〜04: 実際の PR で GitHub Actions が biome check PASS + coverage threshold PASS することを確認（自動検証）。 |
| 検証環境 | GitHub Actions（ubuntu-latest）。ローカル事前確認は `pnpm biome check && pnpm test --coverage` で代替。 |
| 前提条件 | GitHub Actions が有効。`secrets.GITHUB_TOKEN` 不要（標準ジョブのみ）。 |

## 他 Epic への依存・影響

- **E1 に依存する（完了済み）**: biome check がゼロ警告状態であることが前提
- **E2.5 に依存する（完了済み）**: `vitest.config.ts` に thresholds が設定済みであることが前提
- **E4 に関連する**: E4（lefthook 整備）はローカルでの事前チェック。E3 は CI でのゲート。両者は独立して実施可能
- **E5 と独立**: ドキュメント整備 Epic とは無依存

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | coverage 閾値の段階的引き上げ計画（18% → 30% → 45% → 60%）のタイミング | 未確定 | ES-005（S14 リファクタリング）完了後に引き上げ。`vitest.config.ts` の thresholds 変更で自動的に CI に反映 |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている（S8: AC-E004-01, AC-E004-03。S9: AC-E004-02, AC-E004-03, AC-E004-04）
- [x] 正常系・異常系のレスポンスが定義されている（エラーケース: 3 件）
- [x] バリデーションルールが網羅されている（biome check・coverage 閾値）
- [x] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（開発者のみ — CI 設定変更）
- [x] 関連 ADR が参照されている（ADR 不要。標準的な CI パターン）
- [x] 非機能要件が定義されている（実行時間・キャッシュ・設定一貫性）
- [x] 他 Epic への依存・影響が明記されている（E1・E2.5・E4・E5）
- [x] 未決定事項が明示されている（1 件）
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-E004-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている（S8, S9）
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] 所属 BC が記載されている（該当なし — CI/DevOps）
- [x] 設計成果物セクションが記入されている（該当なし、スキップ理由記載）
