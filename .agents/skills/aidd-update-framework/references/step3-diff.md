# Step 3: プロジェクト固有設定の差分適用（詳細手順）

旧バージョンと新バージョンのテンプレートを比較し、フレームワークが追加した要素のみを検出して
プロジェクト固有カスタマイズを保持しつつ適用する。

## PLUGIN_DIR の特定

```bash
PLUGIN_DIR="${HOME}/.claude/plugins/marketplaces/aidd-fw"
SETUP_REFS="${PLUGIN_DIR}/skills/aidd-setup/references"
```

## 差分チェック対象一覧

| ファイル | テンプレート/基準 | 検出内容 |
|---------|----------------|---------|
| `CLAUDE.md`（プロジェクト固有部分） | `${SETUP_REFS}/claude-md.md` | fw が追加した新規セクション |
| `AGENTS.md`（プロジェクト固有部分） | `${SETUP_REFS}/agents-md.md` | fw が追加した新規セクション |
| `README.md` | `${SETUP_REFS}/project-readme.md` | fw が追加した新規セクション |
| `.mise.toml` | `${PLUGIN_DIR}/.mise.toml` | fw が新たに必須とした tools の追加 |
| `lefthook.yml` | `${PLUGIN_DIR}/lefthook.yml` | fw が追加した新規 hooks のマージ |
| `Taskfile.yml` | `${PLUGIN_DIR}/Taskfile.yml` | fw が追加したタスクの追加 |
| `.gitignore` | `${PLUGIN_DIR}/.gitignore` | fw が追加したパターンの追加 |
| `compose.yaml` | `${PLUGIN_DIR}/compose.yaml` | fw が追加したサービスの追加 |
| `docs/conventions/` 配下全ファイル | `${SETUP_REFS}/cat-conventions.md` | fw テンプレートに追加されたセクションの提案 |
| `.github/workflows/ci.yml` | `${SETUP_REFS}/cat-ci.md` | fw CI テンプレートの更新 |
| branch-protection ルール | `${SETUP_REFS}/cat-branch-protection.md` | fw 標準に追加されたルールの提示 |

## 各ファイルの処理手順

### CLAUDE.md（プロジェクト固有部分）

1. テンプレート（`claude-md.md`）の構造を読む
2. プロジェクトの `CLAUDE.md` から `<!-- aidd-fw:import-start -->` ～ `<!-- aidd-fw:import-end -->` を除いた部分を抽出
3. テンプレートに存在してプロジェクトに**ない**セクション（`##` レベルの見出し）を列挙
4. 追加候補をユーザーに提示 → 承認 → 適用（プロジェクト固有の内容は保持）

### AGENTS.md（プロジェクト固有部分）

1. テンプレート（`agents-md.md`）の `<!-- aidd-fw:managed-end -->` より後の部分を読む
2. プロジェクトの `AGENTS.md` の `<!-- aidd-fw:managed-end -->` より後の部分と比較
3. テンプレートに存在してプロジェクトに**ない**セクションを列挙
4. 追加候補をユーザーに提示 → 承認 → 適用

### README.md

1. テンプレート（`project-readme.md`）の構造を読む
2. プロジェクトの `README.md` と比較し、テンプレートに追加されたセクションを検出
3. 追加候補をユーザーに提示 → 承認 → 適用

### 設定ファイル（.mise.toml / lefthook.yml / Taskfile.yml / .gitignore / compose.yaml）

1. `git diff <旧バージョンタグ> <新バージョンタグ> -- <ファイル>` で fw 側の変更を取得
   - `gh release` で旧バージョンのソースを取得できない場合は直接 diff で比較
2. fw が追加した要素（プロジェクト固有カスタマイズ以外）を抽出
3. 追加内容をユーザーに提示 → 承認 → 適用

### docs/conventions/ 配下全ファイル

`cat-conventions.md` を読み込み、最新の規約テンプレートと現在の `docs/conventions/` を比較して不足セクションを提案する。

### .github/workflows/ci.yml

`cat-ci.md` を読み込み、最新の CI テンプレートと現在の `ci.yml` を比較して追加・変更を提案する。

### branch-protection ルール

`cat-branch-protection.md` を読み込み、fw 標準に追加されたルールを提示する。

## 進め方の原則

- 全ファイルの差分を**一括提示**してから一括承認を得るか、**1 ファイルずつ**提示・承認するかをユーザーに選択させる
- プロジェクト固有のカスタマイズ（TODO を埋めた内容・プロジェクト名等）は絶対に上書きしない
- 差分がない場合は「変更なし」と報告してスキップする
- ファイルが存在しない場合は「対象外」として報告してスキップする
