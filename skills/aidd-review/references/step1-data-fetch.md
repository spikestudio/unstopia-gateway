# Step 1: 外部データ一括取得 — /aidd-review

種別に応じた外部データを **このステップで 1 回だけ** 取得する。Step 2 のサブエージェントは独立にデータを取得しない。取得したデータをサブエージェントへの引数として渡すこと。

## 原則

- **外部 I/O は 1 回のみ**: 同じデータを複数回取得しない。冗長な `gh` コマンド・ファイル読み込みを禁止する
- **重複取得禁止**: 複数のサブエージェントが同一データを独立に取得することを禁止する。必ず Step 1 で取得し共有する
- **取得失敗時の対応**: 必須データの取得に失敗した場合はレビューを停止し、ユーザーに案内する

## 種別ごとの取得対象

### `code` — コードレビュー

| データ | 取得方法 | 用途 |
|--------|---------|------|
| PR diff | `gh pr diff <PR番号>` | 変更内容の全体像 |
| 変更ファイル一覧 | `gh pr view <PR番号> --json files` | ファイル分類・変更量 |
| CLAUDE.md（ルートおよび変更ディレクトリ） | `cat CLAUDE.md` | プロジェクト規約チェック |
| `docs/conventions/` | ディレクトリ一括 Read | aidd 固有規約チェック |

```bash
gh pr diff <PR番号> > /tmp/pr-diff.txt
gh pr view <PR番号> --json files,title,body > /tmp/pr-meta.json
```

### `epic` — Epic 総合レビュー

| データ | 取得方法 | 用途 |
|--------|---------|------|
| PR diff | `gh pr diff <PR番号>` | コード変更全体 |
| Epic 仕様書 | `docs/requirements/ES-NNN-*.md` | AC・ストーリー・要件 |
| Task 定義群 | `docs/tasks/TASK-*.md`（Epic に紐づくもの） | AC 分解・実装範囲 |
| 変更ファイル一覧 | `gh pr view <PR番号> --json files` | 変更分類 |
| 設計成果物（ADR 等） | Epic 仕様書が参照するもの | 設計判断の確認 |
| 規約ドキュメント | `docs/conventions/` | 規約準拠チェック |

```bash
gh pr diff <PR番号> > /tmp/pr-diff.txt
gh pr view <PR番号> --json files,title,body,number > /tmp/pr-meta.json
```

### `phase` — Phase 完了レビュー

| データ | 取得方法 | 用途 |
|--------|---------|------|
| Phase 定義書 | `docs/requirements/phase-*.md` | 機能意図・成功基準 |
| 全 Epic 仕様書 | `docs/requirements/ES-*.md` | AC 充足・完了確認 |
| マスタドキュメント | `docs/` 配下の主要ドキュメント | 最新化確認 |
| Phase Issue | `gh issue list --milestone "Phase N"` | Epic 完了状態 |

```bash
gh issue list --milestone "Phase N" --json number,title,state,labels > /tmp/phase-issues.json
```

### `epic-spec` — Epic 仕様書レビュー

| データ | 取得方法 | 用途 |
|--------|---------|------|
| Epic 仕様書 | `docs/requirements/ES-NNN-*.md` | 仕様完全性・品質チェック |
| Phase 定義書 | `docs/requirements/phase-*.md` | 機能意図照合（Epic が Phase の意図を満たすか） |

```bash
# Epic 仕様書と Phase 定義書のみ Read（gh コマンド不要）
```

### `task-spec` — Task 定義レビュー

| データ | 取得方法 | 用途 |
|--------|---------|------|
| Task 定義群 | `docs/tasks/TASK-NNN-*.md` | 分解妥当性・実装可能性チェック |
| Epic 仕様書 | `docs/requirements/ES-NNN-*.md` | AC 参照（Task が Epic AC をカバーするか） |

```bash
# Task 定義ファイルと Epic 仕様書のみ Read（gh コマンド不要）
```

## データ引き渡し方法

取得したデータは変数またはファイルに格納し、Step 2 のサブエージェント起動時に引数として渡す。

```
Step 2 サブエージェント起動時の引数例:
- PR diff の内容（文字列）
- Epic 仕様書の内容（文字列）
- 変更ファイル一覧（JSON）
- 規約ドキュメントのパス一覧
```

サブエージェントが独自に `gh pr diff` や `cat docs/requirements/...` を実行することを **明示的に禁止する**。Step 1 の取得結果を使い回すこと。
