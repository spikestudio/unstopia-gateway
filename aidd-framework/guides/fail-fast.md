# Fail Fast 原則

## 概要

環境変数・設定値・必須ツールが不足または不正な場合、AI はフォールバックや回避策を試みず即座にエラーで停止する。

> **なぜ fail fast が必要か:** フォールバックや回避策は「動いているように見える壊れた状態」を生み出す。設定漏れが表面化せず後から原因不明のバグとしてハマる。環境依存の問題が蓄積して再現困難になる。fail fast はこれらを防ぐための前提条件の可視化手段である。

## 禁止パターンと正しい挙動

| 状況 | ❌ 禁止（回避策） | ✅ 正しい挙動（fail fast） |
|------|----------------|--------------------------|
| 環境変数が未設定 | デフォルト値や推測値で続行 | 「`FOO` is required but not set」でエラー停止 |
| 接続失敗 | リトライや別エンドポイントを試す | エラー内容と設定確認手順を提示して停止 |
| 設定ファイル不在 | 空の設定やインメモリ設定で初期化 | 「config file not found: `/path/to/config`」でエラー停止 |
| 必須ツール未インストール | 代替コマンドで回避 | 「Required tool `X` is not installed. Run: `...`」でエラー停止 |
| 必須引数が未指定 | 推測値や空文字で続行 | 使い方の説明とともにエラー停止 |

## エラーメッセージの書き方

fail fast 時のエラーメッセージには以下を含める：

1. **何が不足・不正か** — 変数名・ファイルパス・ツール名を具体的に示す
2. **どう解決するか** — 設定手順・インストール方法・参照ドキュメントへのリンク

```bash
# 良い例
echo "Error: Required environment variable DATABASE_URL is not set."
echo "Set it with: export DATABASE_URL=postgres://user:pass@host:5432/db"
exit 1

# 悪い例（理由なしに停止）
echo "Error: configuration error" && exit 1

# 悪い例（フォールバック）
DATABASE_URL="${DATABASE_URL:-postgres://localhost:5432/dev}"
```

## 適用範囲

- **スキル実行前の前提チェック** — `/aidd-setup`・`/aidd-skeleton`・`/aidd-impl` 等は実行前に必要な環境変数・ツールを検証し、不足があれば停止する
- **コード実装** — AI が生成するコードにフォールバック値を含めない
- **スクリプト** — `bash` スクリプトは `set -euo pipefail` を先頭に記述し、未設定変数参照を禁止する

## FRAMEWORK.md との関係

fail fast は「**全ての問題は必ず解決する**」（FRAMEWORK.md 原則）の前提条件である。問題が可視化されなければ解決できない。フォールバックは問題を隠蔽し、解決を不可能にする。
