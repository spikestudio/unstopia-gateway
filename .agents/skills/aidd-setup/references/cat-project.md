# カテゴリ: project（プロジェクト初期化）

フレームワークに則った開発を始めるための初期セットアップを対話的に実行する。

## 前提条件

- `fw` カテゴリが実行済み（`aidd-framework/` が存在すること）

## 手順

### 1. プロジェクト情報の収集

ユーザーに以下を質問する:

- プロジェクト名
- プロジェクトの概要（1〜2文）
- 主要な技術スタック（言語、フレームワーク等。未定の場合はスキップ可）

### 2. GitHub Labels 作成

以下の Labels が存在しなければ作成する:

```bash
gh label create epic --description "Epic 仕様書に対応する Issue" --color "0075ca" --force
gh label create task --description "Task 定義に対応する Issue" --color "008672" --force
gh label create feedback --description "実装中の訂正・仕様変更・規約追記" --color "e4e669" --force
gh label create blocked --description "ブロックされている Issue" --color "d73a4a" --force
```

### 3. ディレクトリ作成

以下のディレクトリが存在しなければ作成する（.gitkeep 付き）:

- `docs/requirements/`
- `docs/architecture/adr/`
- `docs/tasks/`
- `docs/conventions/`
- `docs/research/`

### 4. ドキュメント雛形作成

#### README.md

`README.md` が存在しなければ、`${PLUGIN_DIR}/skills/aidd-setup/references/project-readme.md` からコピーし、プロジェクト名・概要を埋める。既に存在する場合はスキップ。

#### CHARTER

`docs/PROJECT-CHARTER.md` が存在しなければ、`${PLUGIN_DIR}/skills/aidd-setup/references/CHARTER.md` からコピーし、収集した情報を埋める。既に存在する場合はスキップ。

#### 用語集

`docs/glossary.md` が存在しなければ、以下の雛形で作成する:

```markdown
# 用語集

| 用語 | 定義 | 備考 |
|------|------|------|
```

#### 規約ドキュメント雛形

`docs/conventions/` に以下の7ファイルが存在しなければ雛形を作成する。各ファイルは `aidd-framework/guides/convention-bootstrap.md` の該当セクションに基づく構造を持つ:

| ファイル | 内容 |
|---------|------|
| `docs/conventions/naming.md` | 命名規則 |
| `docs/conventions/directory-structure.md` | ディレクトリ構造 |
| `docs/conventions/layer-rules.md` | レイヤー間のルール |
| `docs/conventions/error-handling.md` | エラーハンドリング方針 |
| `docs/conventions/testing.md` | テスト規約 |
| `docs/conventions/prohibitions.md` | 禁止事項 |
| `docs/conventions/git-workflow.md` | Git 運用ルール |

各ファイルの雛形には以下を含める:

- タイトルと目的の説明
- 埋めるべきセクションの見出し（convention-bootstrap.md に準拠）
- `<!-- TODO: プロジェクトに合わせて記述してください -->` コメント

`git-workflow.md` には GitHub Flow をデフォルトとして記載する（ブランチ戦略、命名規則、Conventional Commits、マージ方式）。

### 5. CI テンプレート提案

技術スタックが判明している場合、`.github/workflows/ci.yml` の雛形を提案する。ユーザーに確認し、Yes の場合のみ作成。技術スタック未定の場合はスキップ。

### 6. AI エージェント指示ファイル仕上げ

AI エージェント指示ファイル（`CLAUDE.md` または `AGENTS.md`）に以下を反映する:

- 規約ドキュメントへのポインタ（`docs/conventions/` 配下の7ファイル）を「参照すべきドキュメント」セクションに追記
- プロジェクト名・概要を記載
- ビルド・テストコマンド欄を技術スタックに合わせて埋める（未定ならプレースホルダのまま）

### 7. コミット

- ブランチ名: `chore/project-init`
- コミットメッセージ: `chore: プロジェクト初期セットアップ`
- ユーザーに PR 作成を行うか確認する

## 完了条件

- GitHub に epic, task, feedback, blocked ラベルが作成されている
- `docs/requirements/`, `docs/architecture/adr/`, `docs/tasks/`, `docs/conventions/`, `docs/research/` ディレクトリが存在する
- `README.md`, `docs/PROJECT-CHARTER.md`, `docs/glossary.md` が存在する
- `docs/conventions/` 配下に7ファイルの雛形が存在する
- AI エージェント指示ファイルに規約ドキュメントへのポインタが追記されている
- 変更がブランチにコミットされている
