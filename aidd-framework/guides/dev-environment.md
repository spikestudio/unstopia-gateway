# 開発環境セットアップガイド

フレームワークが推奨する開発基盤ツールのインストールと設定手順。

> 対話的にセットアップを実行する場合は `/aidd-setup env` スキルを使用する。

## 前提

- macOS または Linux（Windows は WSL2 経由）
- Homebrew がインストール済み（macOS の場合）

## ルール: ローカルファースト原則

**動作確認はローカルで行い、PASS 後にデプロイする。** CI/CD や dev 環境を動作確認の場として使ってはならない。詳細フローは `aidd-framework/guides/local-verification.md` を参照。

### 正しい順序とアンチパターン

| フェーズ | 正しい順序 | アンチパターン |
|---------|-----------|--------------|
| 実装完了後 | ローカルテスト PASS → PR 作成 | PR 作成 → CI 結果待ち → 失敗して修正 |
| レビュー後 | ローカル確認 PASS → マージ → デプロイ | マージ → dev 環境で動作確認 |
| バグ修正 | ローカルで再現・修正・確認 → デプロイ | デプロイして原因特定 → 再デプロイ |

### 環境差分をゼロに近づける手段

- `compose.yaml` で全データストアをローカルコンテナで実行する
- `.env` で本番同等の設定値をローカルに再現する（シークレットは `direnv` + `.env` で管理）
- `mise` でランタイムバージョンを CI と揃える（`.mise.toml` を CI と共用）

### 例外

ローカル再現が物理的に不可能な場合（クラウド IAM・マネージドサービス固有の挙動等）に限り dev 環境確認を許容する。**例外を適用する場合は PR コメントに理由を必ず記載する。**

---

## ルール: ツールは必ず mise で管理する

**`brew install <tool>` でプロジェクトツールをインストールしてはならない。** mise の管理外になりバージョン固定・再現性が失われる。

| 操作 | 正しい方法 | 禁止 |
|------|-----------|------|
| 新規ツール追加 | `mise use task@X.Y.Z` | `brew install go-task` |
| バージョン変更 | `.mise.toml` を編集 + `mise install` | `brew upgrade` |
| チームへの共有 | `.mise.toml` を Git にコミット | 口頭での手順共有 |

> **`mise use` の注意点**: 引数なしや `--global` は `~/.tool-versions`（グローバル）に書き込んでしまう。必ずローカルファイルを指定すること: `mise use --path .mise.toml task@X.Y.Z`

---

## 1. mise（ランタイム管理）

プロジェクトで使用する言語ランタイムのバージョンを `.mise.toml` で固定し、チーム全員で統一する。

**インストール:**

```bash
# macOS
brew install mise

# Linux
curl https://mise.run | sh
```

**シェル統合:**

```bash
# ~/.zshrc または ~/.bashrc に追加
eval "$(mise activate zsh)"  # zsh の場合
eval "$(mise activate bash)" # bash の場合
```

**プロジェクト設定:**

```toml
# .mise.toml（リポジトリルートに配置、Git にコミットする）
[tools]
node = "20"
python = "3.12"
go = "1.22"
```

```bash
# ランタイムのインストール
mise install
```

## 2. direnv（環境変数管理）

ディレクトリに入ると `.envrc` の環境変数が自動で読み込まれ、離れると解除される。

**インストール:**

```bash
# macOS
brew install direnv

# Linux
sudo apt install direnv  # Debian/Ubuntu
```

**シェル統合:**

```bash
# ~/.zshrc または ~/.bashrc に追加
eval "$(direnv hook zsh)"  # zsh の場合
eval "$(direnv hook bash)" # bash の場合
```

**プロジェクト設定:**

```bash
# .envrc（リポジトリルートに配置、Git にコミットする）
dotenv_if_exists .env
```

```bash
# .env.example（Git にコミットする。必要な変数名と説明を記載）
POSTGRES_DB=myapp_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgres://localhost:5432/myapp_dev
REDIS_URL=redis://localhost:6379
API_KEY=your-api-key-here  # 取得方法: https://...
```

```bash
# .env（.gitignore に含める。実際の値を設定）
cp .env.example .env
# .env を編集して実際の値を設定
direnv allow
```

## 3. Docker + Docker Compose（コンテナ）

データストアや外部サービスをコンテナで実行し、ローカル環境の再現性を確保する。

**インストール:**

```bash
# macOS
brew install --cask docker

# Linux
# https://docs.docker.com/engine/install/ を参照
```

**プロジェクト設定:**

```yaml
# compose.yaml（リポジトリルートに配置、Git にコミットする）
services:
  db:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-myapp_dev}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - db_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

volumes:
  db_data:
```

```bash
# 起動
docker compose up -d

# 停止
docker compose down
```

## 4. Taskfile（タスクランナー）

開発タスク（ビルド、テスト、起動等）を `Taskfile.yml` に定義し、チームで統一する。

**インストール:**

```bash
# macOS — Taskfile (Homebrew パッケージ名は go-task)
brew install go-task

# Linux
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin
```

**プロジェクト設定:**

```yaml
# Taskfile.yml（リポジトリルートに配置、Git にコミットする）
version: '3'

tasks:
  setup:
    desc: 初回セットアップ
    cmds:
      - mise install
      - direnv allow
      - docker compose up -d
      - task install
      - task db:setup

  install:
    desc: 依存のインストール
    cmds:
      - echo "TODO: パッケージマネージャの install コマンド"

  dev:
    desc: 開発サーバーの起動
    cmds:
      - echo "TODO: 開発サーバーの起動コマンド"

  test:
    desc: テストの実行
    cmds:
      - echo "TODO: テスト実行コマンド"

  lint:
    desc: リンターの実行
    cmds:
      - echo "TODO: リンター実行コマンド"

  db:setup:
    desc: DB のセットアップ（マイグレーション + シード）
    cmds:
      - echo "TODO: マイグレーションコマンド"
      - echo "TODO: シードコマンド"
```

```bash
# 初回セットアップ（1コマンド）
task setup

# 日常の開発
task dev
task test
task lint
```

> `task setup` が G0 チェックリストの「開発環境が1コマンドで起動できる」を満たすエントリポイントになる。

## 5. lefthook（Git フック管理）

CI で実行しているチェック（lint, format, type check 等）をローカルの Git フックで事前実行する。CI 失敗→修正→rerun の待ち時間を排除し、CI は「通って当たり前」の状態にする。

> 対話的にセットアップする場合は `/aidd-setup ci` スキルを使用する。

**インストール:**

```bash
# mise 経由でインストール（.mise.toml に追加される）
mise use lefthook
mise install
```

**プロジェクト設定:**

```yaml
# lefthook.yml（リポジトリルートに配置、Git にコミットする）
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts,jsx,tsx}"
      run: npx eslint --no-warn-ignored {staged_files}
    format:
      glob: "*.{js,ts,jsx,tsx,json,md,yml,yaml,css}"
      run: npx prettier --check {staged_files}

pre-push:
  commands:
    test:
      run: npx vitest run
```

```bash
# フックのインストール（clone 後に1回実行）
lefthook install

# 手動実行（確認用）
lefthook run pre-commit
lefthook run pre-push
```

**レイヤー戦略:**

| レイヤー | フック | 時間目安 | 対象 |
|---------|-------|---------|------|
| Layer 1 | pre-commit | < 30 秒 | lint, format, type check（ステージファイルのみ） |
| Layer 2 | pre-push | < 5 分 | ユニットテスト, ビルド |
| Layer 3 | CI のみ | — | 全テスト, E2E, セキュリティスキャン |

**緊急時のスキップ:**

```bash
git commit --no-verify   # pre-commit をスキップ
git push --no-verify     # pre-push をスキップ
```

## 6. GitHub Actions（CI/CD）

GitHub Flow との親和性が最も高い CI/CD プラットフォーム。environments と protection rules でデプロイの承認フローを構成する。

**プロジェクト設定:**

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jdx/mise-action@v2
      - run: task install
      - run: task lint
      - run: task test
```

> デプロイワークフローはプロジェクトのインフラ構成に応じて定義する。GitHub Actions の environments 機能で dev / stg / prod の承認フローを構成する。

## 7. Terraform + Terragrunt（インフラ管理）

デプロイ対象がある場合に使用。クラウドリソースをコードで管理し、環境間の構成を DRY に保つ。

**インストール:**

`.mise.toml` に以下を追記する:

```toml
[tools]
terraform = "1.9"
terragrunt = "0.68"
```

```bash
mise install
```

**ディレクトリ構成例:**

```
infra/
├── modules/           # 再利用可能な Terraform モジュール
│   ├── app/
│   └── database/
├── envs/              # 環境ごとの設定
│   ├── dev/
│   │   └── terragrunt.hcl
│   ├── stg/
│   │   └── terragrunt.hcl
│   └── prod/
│       └── terragrunt.hcl
└── terragrunt.hcl     # 共通設定
```

> Terraform / Terragrunt のバージョンも `.mise.toml` で管理し、チーム全員で統一する。

## ツール間の連携

```
mise          → ランタイムのバージョンを .mise.toml で固定
  ↓
direnv        → .envrc で環境変数を自動読み込み
  ↓
Docker        → compose.yaml でデータストア・外部サービスを起動
  ↓
Taskfile      → Taskfile.yml で全タスクを統一（task setup で1コマンド起動）
  ↓
lefthook      → lefthook.yml で pre-commit / pre-push フックを管理
  ↓
GitHub Actions → CI で lint・test・build を自動実行
  ↓
Terraform     → infra/ でクラウドリソースを IaC 管理（デプロイ対象がある場合）
```
