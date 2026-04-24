# カテゴリ: ci（ローカル CI フック）

CI で実行しているチェックをローカルの Git フックで事前実行する環境を構築する。lefthook を使用した言語非依存のフック設定を対話的に構築する。

> 詳細は aidd-framework/guides/dev-environment.md の lefthook セクションを参照。

## 前提条件

- Git リポジトリが初期化済み（`.git/` の存在）
- mise がインストール済み（`mise --version`）

## レイヤー戦略

```
Layer 1: pre-commit（< 30秒）— コミットごとに実行
  → lint, format check, type check（ステージされたファイルのみ）

Layer 2: pre-push（< 5分）— プッシュ前に実行
  → ユニットテスト, ビルド検証

Layer 3: CI のみ — GitHub Actions で実行
  → 全テストスイート, 統合/E2E テスト, セキュリティスキャン, デプロイ
```

## 手順

### 1. プロジェクト技術スタック検出

以下のファイルを確認し、プロジェクトの言語・ツールを検出する:

| 検出対象 | 確認ファイル |
|---------|------------|
| Node.js / TypeScript | `package.json`（devDependencies: eslint, prettier, tsc, vitest, jest） |
| Rust | `Cargo.toml` |
| Go | `go.mod` |
| Python | `pyproject.toml`, `setup.py`, `requirements.txt` |
| ランタイムバージョン | `.mise.toml` |
| 既存フック | `lefthook.yml`, `.husky/` |
| タスクランナー | `Taskfile.yml` |

- `lefthook.yml` が既にある場合: 現在の設定を表示し、更新するかスキップするか確認する
- `.husky/` が存在する場合: lefthook への移行を提案する（強制はしない）

### 2. CI ワークフロー検出 + レイヤー分類

`.github/workflows/*.yml` を読み取り、各ジョブの `run:` ステップを抽出する。CI ワークフローのチェックを Layer 1/2/3 に分類し、ユーザーに提示して確認を取る。

### 3. lefthook セットアップ（動的 lint 検出）

1. lefthook を mise 経由でインストール（`mise use lefthook`、プロジェクトローカルで実行）
2. プロジェクトのファイル構成をスキャンし、必要なチェックのみ追加する（#700）

   | ファイルが存在する | 追加するチェック（pre-commit） | lint:fix 対応 |
   |-------------------|-------------------------------|--------------|
   | `*.ts` / `*.tsx` | eslint, tsc | eslint --fix |
   | `*.md` | markdownlint-cli2 | markdownlint-cli2 --fix |
   | `*.toml` | taplo fmt --check | taplo fmt |
   | `*.yml` / `*.yaml` | yamllint | — |
   | `.github/workflows/*.yml` | actionlint | — |
   | `Cargo.toml` | cargo clippy, cargo fmt | cargo fmt |
   | `go.mod` | golangci-lint, gofmt | gofmt -w |
   | `pyproject.toml` / `*.py` | ruff check, ruff format --check | ruff format |

3. `lefthook.yml` を生成（スキャン結果に基づくチェックのみ含める）
4. `Taskfile.yml` が存在する場合、スキャン結果に対応する `lint` / `lint:fix` タスクのコマンドを自動追記する（#701）
5. `lefthook install` を実行
6. ドライラン（`lefthook run pre-commit` / `lefthook run pre-push`）で動作確認

**注意:**

- 既存の `lefthook.yml` / `.husky/` を上書きしない
- `mise use` がグローバルに書き込まないことを確認する（プロジェクトローカルで実行）
- CI ワークフローが存在しない場合でもデファクトツールでデフォルトを提案
- ファイルが存在しない種別のチェックは追加しない（ゴミ設定を防ぐ）

### 4. 検証

- pre-commit が 30 秒以内に完了するか
- pre-push が 5 分以内に完了するか
- レイヤー分類が適切か（高速チェック→pre-commit、重いチェック→pre-push、CI のみ）
- 超過する場合は下位レイヤーへの移動を提案

## 完了条件

- lefthook が mise 経由でインストールされている
- `lefthook.yml` が生成され、pre-commit / pre-push フックが設定されている
- pre-commit が 30 秒以内、pre-push が 5 分以内に完了する
- ドライランで動作確認が完了している
- `--no-verify` によるスキップ方法が案内されている
- チームメンバーへの展開方法が案内されている（`lefthook install` または `task setup`）
