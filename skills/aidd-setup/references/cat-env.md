# カテゴリ: env（開発基盤ツール）

フレームワークが推奨する開発基盤ツールのインストール状況を確認し、未導入のツールをセットアップする。

> 手順の詳細は aidd-framework/guides/dev-environment.md を参照。

## 前提条件

- `project` カテゴリが実行済み（`docs/conventions/` が存在すること）

## 手順

### 1. 環境検出

現在の OS と既存ツールの状態を確認する:

```bash
uname -s
mise --version
direnv --version
docker --version
docker compose version
task --version
gh --version
terraform --version
terragrunt --version
```

結果を一覧で提示する:

| カテゴリ | ツール | 状態 | バージョン |
|---------|--------|------|----------|
| ランタイム管理 | mise | ✅ / ❌ | — |
| 環境変数管理 | direnv | ✅ / ❌ | — |
| コンテナ | Docker | ✅ / ❌ | — |
| タスクランナー | Taskfile | ✅ / ❌ | — |
| GitHub CLI | gh | ✅ / ❌ | — |
| Git フック管理 | lefthook | ✅ / ❌ | — |
| インフラ管理 | Terraform + Terragrunt | ⏭️ スキップ可 | — |

### 2. ツールのインストール

未導入のツールを依存関係順にインストールする。各ツールについてインストールコマンドを提示し、ユーザーの承認を得てから実行する。

**CRITICAL: ツールのインストールは必ず `mise use` を使うこと。`brew install` は禁止。**

`brew install <tool>` は mise の管理外になりバージョン固定・再現性が失われる。mise 本体が未導入の場合のみ brew で mise をインストールし、それ以外のすべてのツールは `mise use <tool>@<version>` でインストールする。`--global` フラグは他プロジェクトへの影響があるため禁止。（#916）

```bash
# ✅ 正しい: mise 経由でプロジェクトローカルにインストール
mise use task@3.x.x

# ❌ 禁止: brew 経由のインストール
# brew install go-task
```

**インストール順序:**

1. mise（ランタイム管理 — 他ツールのバージョン管理にも使用）
2. direnv（環境変数管理）
3. Docker + Docker Compose（コンテナ）
4. Taskfile（タスクランナー）
5. lefthook（Git フック管理）
6. Terraform + Terragrunt（インフラ管理 — デプロイ対象がある場合のみ）

- シェル統合が必要な場合（mise, direnv）、`.zshrc` または `.bashrc` への追記を提案する
- インストール後にバージョン確認で成功を検証する
- Terraform + Terragrunt はデプロイ対象がないプロジェクトではスキップ可能

### 3. プロジェクト設定ファイルの生成

既存ファイルがある場合は上書きしない:

| ファイル | 内容 | Git |
|---------|------|-----|
| `.mise.toml` | プロジェクトで使用するランタイムのバージョン定義 | コミット |
| `.envrc` | `dotenv_if_exists .env` | コミット |
| `.env.example` | 必要な環境変数名と説明 | コミット |
| `.env` | `.env.example` からコピー（実際の値を設定） | `.gitignore` に追加 |
| `compose.yaml` | データストア・外部サービスの定義 | コミット |
| `Taskfile.yml` | 開発タスクの定義（setup, dev, test, lint 等） → `aidd-framework/templates/Taskfile.yml` からコピー | コミット |

各ファイルの生成前にユーザーに確認する:

- `.mise.toml`: 「使用する言語とバージョンは？」
- `compose.yaml`: 「使用するデータストアは？（PostgreSQL, MySQL, Redis 等）」
- `.env.example`: 「必要な環境変数は？」

### 4. .gitignore の更新

`.gitignore` に以下が含まれていなければ追加を提案する:

```
.env
.direnv/
```

### 5. 動作確認

```bash
mise install
direnv allow
docker compose up -d
lefthook install
task setup  # Taskfile.yml がある場合
```

### 6. 情報収集（必要時）

ツールの仕様や設定方法について不明点がある場合、ドキュメントを確認する。特に:

- 特定バージョンのツールの設定変更点
- OS 固有のインストール手順
- ツール間の統合設定

## 完了条件

- 全ての必須ツールがインストールされ、バージョン確認で動作を検証済み
- `.mise.toml`, `.envrc`, `.env.example`, `compose.yaml`, `Taskfile.yml` が生成されている
- `.gitignore` に `.env` と `.direnv/` が含まれている
- `mise install`, `direnv allow` が正常に動作する
- コンテナが起動する（`docker compose up -d`）
