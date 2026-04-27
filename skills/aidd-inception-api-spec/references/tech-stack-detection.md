# 技術スタック推定ガイド（AC-E070-12）

`/aidd-inception-api-spec` が REST/GraphQL/gRPC を推定するための手順。

## 推定の優先順序

1. **CLAUDE.md の `tech_stack` セクション** — 最も信頼性が高い
2. **プロジェクトファイルの分析** — コード構造から推定
3. **機能意図のキーワード** — 最終手段

## 推定手順

### Step 1: CLAUDE.md を確認

```
docs/CLAUDE.md または .claude/CLAUDE.md に以下が存在するか:
  tech_stack:
    api: REST / GraphQL / gRPC
```

### Step 2: プロジェクトファイルを確認

| 検査対象 | 判定ルール |
|---------|-----------|
| `package.json` に `graphql`・`@apollo/server`・`type-graphql` | → GraphQL |
| `package.json` に `@grpc/grpc-js`・`grpc` | → gRPC |
| `go.mod` に `github.com/99designs/gqlgen` | → GraphQL（Go） |
| `go.mod` に `google.golang.org/grpc` | → gRPC（Go） |
| `pyproject.toml` / `requirements.txt` に `graphene`・`strawberry-graphql` | → GraphQL（Python） |
| `*.proto` ファイルが存在する | → gRPC |
| `openapi.yaml` / `swagger.yaml` が存在する | → REST |
| 上記なし、または `express`・`fastapi`・`gin` のみ | → REST（デフォルト） |

### Step 3: 機能意図のキーワード

| キーワード | 推定 |
|-----------|------|
| 「クエリ」「ミューテーション」「スキーマ」 | GraphQL |
| 「プロトコルバッファ」「ストリーミング」「RPC」 | gRPC |
| 「エンドポイント」「REST」「HTTP」「CRUD」 | REST |

## 推定結果の提示フォーマット

```
技術スタック推定結果:
  根拠: [package.json に @apollo/server を確認 / CLAUDE.md の tech_stack 等]
  推定: GraphQL / REST / gRPC
  確認: この技術スタックでよいですか？（違う場合は指定してください）
```

## GraphQL 固有の注意点

REST と異なりエンドポイントが単一（`POST /graphql`）のため、
候補提示は「クエリ一覧」「ミューテーション一覧」の形式に変える:

| # | 種別 | 名前 | 概要 | 対応機能意図 |
|---|------|------|------|------------|
| 1 | Query | [queryName] | [説明] | [機能意図] |
| 2 | Mutation | [mutationName] | [説明] | [機能意図] |

## gRPC 固有の注意点

サービス定義（`.proto`）形式で候補を提示する:

```
service [ServiceName] {
  rpc [MethodName]([RequestType]) returns ([ResponseType]);
}
```
