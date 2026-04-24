<!-- 配置先: docs/requirements/ES-005-lefthook-setup.md -->
# ES-005: E4 — lefthook 整備

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-24 |
| 対応 Issue | #62 |
| 対応ストーリー | S10 |
| Phase 定義書 | docs/requirements/PD-001-code-quality-stabilization.md |

## 概要

lefthook の pre-commit・commit-msg フック設定を確認・補完し、ローカルでの品質チェックを自動化する。

## 現状

| フック | 現状 | 問題 |
|--------|------|------|
| pre-commit | typecheck + actionlint | `pnpm lint`（biome check）が欠落 |
| pre-push | build のみ | `pnpm test` がコメントアウト |
| commit-msg | 未設定 | Conventional Commits 検証なし |

## Acceptance Criteria

| # | AC | 検証方法 |
|---|-----|---------|
| AC-1 | pre-commit に `pnpm lint` を追加し、biome 違反でコミットを阻止する | 意図的に lint エラーを入れてコミットが阻止されることを確認 |
| AC-2 | pre-push の `pnpm test` コメントアウトを有効化する | `git push` 実行時にテストが走ることを確認 |
| AC-3 | commit-msg フックで `<type>(<scope>): <subject>` 形式を検証する | 不正なメッセージでコミットが阻止されることを確認 |
| AC-4 | `lefthook install` を実行してフックが動作する | フック実行ログを確認 |

## 設計

### commit-msg フック

commitlint（外部ライブラリ）は追加しない。lefthook の `run` でシェルスクリプトとして実装する。

検証対象フォーマット:
```
<type>(<scope>): <subject>
<type>: <subject>
```

許可 type: `feat|fix|chore|docs|refactor|test|style|ci|perf|revert`

### タスク分解

| Task | 内容 | コミット |
|------|------|---------|
| TASK-014 | pre-commit に `pnpm lint` を追加 | `chore(lefthook): add biome lint to pre-commit hook` |
| TASK-015 | pre-push の `pnpm test` を有効化 | `chore(lefthook): enable unit tests in pre-push hook` |
| TASK-016 | commit-msg フック追加（Conventional Commits） | `chore(lefthook): add commit-msg hook for Conventional Commits` |
