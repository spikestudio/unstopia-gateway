# Step 0: 引数受付・catalog.json 読み込み・screen-spec 確認 — 詳細手順

## 入力

- `$ARGUMENTS`（引数）
- `node_modules/@spikestudio/uikit/catalog.json`
- `docs/design/screen-spec-*/`（存在する場合）

## 0-1. @spikestudio/uikit のインストール確認

最初に `node_modules/@spikestudio/uikit/catalog.json` の存在を確認する。

存在しない場合:

```
エラー: @spikestudio/uikit がインストールされていません。

以下のコマンドを実行してインストールしてください:
  npm install @spikestudio/uikit

詳細: ADR-012（docs/architecture/adr/ADR-012-screen-ui-component-catalog.md）を参照
```

スキルを停止する。

## 0-2. catalog.json の読み込み

`node_modules/@spikestudio/uikit/catalog.json` を読み込み、`templates` 配列を内部に保持する。

| フィールド | 用途 |
|-----------|------|
| `id` | テンプレート識別子（コンポーネント選定時の参照キー） |
| `category` / `layer` | UI要素の種別に応じた候補フィルタリング |
| `useWhen` / `avoidWhen` | 推薦・非推薦条件の説明 |
| `combinesWith` | 組み合わせ推奨コンポーネント |
| `requiredComponents` | 依存コンポーネント |
| `usagePattern` | `import`（インポート）or `copy`（コピー） |
| `usageExample` | インポートパスの例 |

## 0-3. screen-spec ディレクトリの特定

### 引数あり

`/aidd-screen-ui docs/design/screen-spec-epic-slug/` のように引数が指定された場合:

1. 指定されたパスの存在を確認する
2. 存在しない場合はエラーを表示して停止する

```
エラー: 指定された画面仕様書ディレクトリが見つかりません。

指定されたパス: docs/design/screen-spec-[slug]/

画面仕様書を作成するには `/aidd-screen-spec` を先に実行してください。
```

### 引数なし

1. `docs/design/screen-spec-*/` を全件列挙する
2. 1件のみの場合は確認を求めてそのまま使用する
3. 複数件の場合はユーザーに選択を求める
4. 0件の場合はエラーを表示して停止する

```
エラー: 画面仕様書ディレクトリが見つかりません。

確認したパス: docs/design/screen-spec-*/

画面仕様書を作成するには `/aidd-screen-spec` を先に実行してください。
```

## 0-4. SCR-ID 一覧の取得

指定された `docs/design/screen-spec-[slug]/` ディレクトリから全 `[SCR-ID]-*.md` ファイルを列挙し、処理対象の SCR-ID 一覧を作成する。

## 0-5. 既存 screen-ui の確認

`docs/design/screen-ui-[slug]/` が既に存在する場合:

- 既存ファイルを確認し、どの SCR-ID が処理済みかを記録する
- 未処理の SCR-ID のみを処理対象とする
- ユーザーに「N 件中 M 件が処理済みです。残り K 件を処理します。」と通知する

## 完了時

以下の情報を整理して Step 1 に渡す:

- catalog.json の templates 配列（全 103 件）
- 処理対象の SCR-ID 一覧と各画面の仕様書パス
- slug 名（出力先ディレクトリ名の決定に使用）
