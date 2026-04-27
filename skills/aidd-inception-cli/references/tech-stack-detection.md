# 技術スタック推定ガイド（AC-E070-13）

`/aidd-inception-cli` が CLI フレームワークを推定するための手順。

## 推定の優先順序

1. **CLAUDE.md の `tech_stack` セクション**
2. **プロジェクトファイルの分析**
3. **機能意図・プロジェクト名のキーワード**

## 推定手順

### Step 1: CLAUDE.md を確認

```
tech_stack:
  cli_framework: cobra / click / yargs / commander 等
```

### Step 2: プロジェクトファイルを確認

| 検査対象 | 判定ルール |
|---------|-----------|
| `go.mod` に `github.com/spf13/cobra` | → cobra（Go） |
| `go.mod` に `github.com/urfave/cli` | → urfave/cli（Go） |
| `pyproject.toml` / `requirements.txt` に `click` | → Click（Python） |
| `pyproject.toml` に `typer` | → Typer（Python） |
| `package.json` の `dependencies` に `commander` | → Commander.js |
| `package.json` の `dependencies` に `yargs` | → Yargs |
| `package.json` の `dependencies` に `oclif` | → Oclif |
| `Cargo.toml` に `clap` | → Clap（Rust） |
| `pom.xml` に `picocli` | → picocli（Java） |
| 上記なし | → 言語別デフォルト（Go: cobra / Python: click / Node: commander） |

### Step 3: プロジェクト名・機能意図のキーワード

| 手がかり | 推定 |
|---------|------|
| プロジェクト名が `*.go`・`main.go` のみ | → cobra |
| `requirements.txt` が存在する | → click / typer |
| `package.json` が存在する | → commander / yargs |

## 推定結果の提示フォーマット

```
技術スタック推定結果:
  根拠: [go.mod に github.com/spf13/cobra を確認 / CLAUDE.md の tech_stack 等]
  推定: cobra（Go）
  慣習: [そのフレームワーク固有の設計慣習の概要]
  確認: この技術スタックでよいですか？（違う場合は指定してください）
```

## フレームワーク別の設計慣習

| フレームワーク | 特徴 |
|-------------|------|
| cobra（Go） | コマンドを struct で定義。`Use`・`Short`・`Long`・`Run` フィールド |
| click（Python） | デコレータパターン。`@click.command()`・`@click.option()` |
| commander.js | メソッドチェーン。`.command()`・`.option()`・`.action()` |
| yargs | ビルダーパターン。`.command()`・`.options()` オブジェクト |
| clap（Rust） | derive マクロ。`#[derive(Parser)]`・`#[arg(short, long)]` |
