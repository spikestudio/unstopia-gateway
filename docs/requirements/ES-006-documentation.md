<!-- 配置先: docs/requirements/ES-006-documentation.md -->
# ES-006: E5 — ドキュメント整備

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-24 |
| 対応 Issue | #67 |
| 対応ストーリー | S12 |
| Phase 定義書 | docs/requirements/PD-001-code-quality-stabilization.md |

## 概要

`CONTRIBUTING.md` を新規作成してブランチ命名・PR フロー・コミット規約・aidd-fw スキルパイプラインを記載し、モジュール依存関係を `docs/architecture/module-dependencies.md` にドキュメント化する。

## Acceptance Criteria

| # | AC | 検証方法 |
|---|-----|---------|
| AC-1 | `CONTRIBUTING.md` を新規作成する（ブランチ命名・PR フロー・コミット規約・aidd-fw パイプライン記載） | ファイルの存在と内容確認 |
| AC-2 | `docs/architecture/module-dependencies.md` を新規作成する（src/ 配下のモジュール依存関係の箇条書き） | ファイルの存在と内容確認 |

## タスク分解

| Task | 内容 | コミット |
|------|------|---------|
| TASK-017 | CONTRIBUTING.md 新規作成 | `docs: add CONTRIBUTING.md` |
| TASK-018 | docs/architecture/module-dependencies.md 新規作成 | `docs: add module-dependencies.md` |
