# Step 0: 引数受付・screen-list 収集 — 詳細手順

## 0-1. 入力ディレクトリの特定

- **引数あり**: 指定されたパスを使用する
- **引数なし**: `docs/design/` を自動使用する

## 0-2. screen-list ファイルの収集

`docs/design/screen-list-*.md` を全件列挙する。

**0件の場合:**

```
エラー: 画面一覧ドキュメントが見つかりません。

確認したパス: docs/design/screen-list-*.md

画面一覧を作成するには `/aidd-screen-plan` を先に実行してください。
```

スキルを停止する。

**1件以上の場合:** ファイル一覧をユーザーに提示して確認を求める:

```
以下の画面一覧ファイルを収集しました（N 件）:

- docs/design/screen-list-[slug1].md（M 件の SCR-ID）
- docs/design/screen-list-[slug2].md（K 件の SCR-ID）

合計: N 件の SCR-ID を処理します。
続行しますか？（OK）
```

## 0-3. SCR-ID の重複チェック

収集した全 screen-list から SCR-ID を読み込み、重複を検出する。

**重複あり:**

```
警告: 以下の SCR-ID が複数の screen-list に存在します:
- SCR-001: screen-list-a.md, screen-list-b.md

重複している SCR-ID は最初に出現したファイルの内容を優先し、以降の重複を除外します。
続行しますか？（OK）
```

重複があってもエラーで停止しない（警告のみ）。

## 完了時

収集した全 SCR-ID（重複除外済み）と各 SCR-ID のメタデータ（画面名・種別・優先度・MVPスコープ・担当 Epic）を整理して Step 1 に渡す。
