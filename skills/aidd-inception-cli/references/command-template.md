# CLI コマンドテンプレート

フラグ定義と使用例の生成ガイド。Unix 哲学・POSIX 準拠を基本とする。

## コマンド仕様フォーマット

各コマンドは以下の構造で記述する:

- コマンド名・サブコマンド階層
- 概要（1行）
- 引数（位置引数）
- フラグ定義（名前・型・デフォルト・説明）
- 使用例（主要ユースケース）
- 終了コード

## フラグ定義テーブル

```markdown
### [コマンド名] [サブコマンド名]

**概要**: [コマンドの目的を1行で]

**引数**

| 引数 | 型 | 必須 | 説明 |
|------|-----|------|------|
| [引数名] | string | ✓ | [説明] |

**フラグ**

| フラグ | 省略形 | 型 | デフォルト | 説明 |
|--------|-------|-----|----------|------|
| --[フラグ名] | -[1文字] | string | "" | [説明] |
| --[フラグ名] | -[1文字] | bool | false | [説明] |
| --output | -o | string | "table" | 出力形式（table/json/yaml） |
| --verbose | -v | bool | false | 詳細ログを表示 |
| --quiet | -q | bool | false | 出力を最小限にする |

**終了コード**

| コード | 説明 |
|--------|------|
| 0 | 成功 |
| 1 | 一般的なエラー |
| 2 | 引数・フラグのエラー |
| 127 | コマンドが見つからない |
```

## コマンド体系パターン

### フラットコマンド（サブコマンドなし）

```
[tool] [引数] [フラグ]

例: myapp deploy --env production
```

### サブコマンド型（推奨）

```
[tool] [resource] [action] [引数] [フラグ]

例:
myapp user create --name "Alice" --email alice@example.com
myapp user list --limit 20
myapp user delete user-id-123
```

### グローバルフラグ（全コマンド共通）

| フラグ | 省略形 | 型 | デフォルト | 説明 |
|--------|-------|-----|----------|------|
| --help | -h | bool | false | ヘルプを表示 |
| --version | -V | bool | false | バージョンを表示 |
| --config | -c | string | ~/.config/tool/config.yaml | 設定ファイルパス |
| --output | -o | string | "table" | 出力形式（table/json/yaml/tsv） |
| --verbose | -v | bool | false | 詳細ログを表示 |
| --quiet | -q | bool | false | エラー以外を非表示 |
| --no-color | - | bool | false | カラー出力を無効化 |

## 必須コマンド（補完提案対象）

| コマンド | 概要 | 優先度 |
|---------|------|--------|
| `help [コマンド]` | ヘルプを表示 | 必須 |
| `version` | バージョン情報を表示 | 必須 |
| `completion [bash/zsh/fish]` | シェル補完スクリプトを生成 | 推奨 |
| `config [get/set/list]` | 設定ファイルを管理 | 推奨 |
| `init` | 初期化処理 | 用途による |

## 使用例パターン

基本操作:

```bash
# 一覧表示
$ myapp [resource] list

# 詳細表示
$ myapp [resource] get [id]

# 作成
$ myapp [resource] create --[フィールド] [値]

# 更新
$ myapp [resource] update [id] --[フィールド] [新しい値]

# 削除（確認あり）
$ myapp [resource] delete [id]

# 削除（確認スキップ）
$ myapp [resource] delete [id] --force
```

パイプライン対応:

```bash
# JSON 出力でパイプ
$ myapp [resource] list --output json | jq '.[] | .name'

# フィルタリング
$ myapp [resource] list | grep [キーワード]
```

設定と補完:

```bash
# シェル補完の設定（bash）
$ myapp completion bash >> ~/.bashrc

# 設定値の確認
$ myapp config list

# 設定値の変更
$ myapp config set [key] [value]
```

## 設計品質チェックリスト

| 観点 | チェック内容 |
|------|------------|
| 命名規則 | コマンド名がケバブケース・動詞-名詞形式か |
| フラグ形式 | `--long-form` と `-s`（短縮形）が定義されているか |
| 必須コマンド | help・version が実装されているか |
| 出力形式 | `--output` フラグで json/yaml 出力に対応しているか |
| 終了コード | 正常終了 0・エラー 1 以上が定義されているか |
| POSIX 準拠 | オプションが POSIX 形式（`-f value` か `--flag=value`）か |
| エラー処理 | エラーメッセージが stderr に出力されるか |
