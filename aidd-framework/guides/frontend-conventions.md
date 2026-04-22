# フロントエンド規約ガイド

Next.js + Vitest + Supertest + Playwright + Biome を使うプロジェクト向けの規約。AI エージェントがフロントエンド実装を行う際に従うべきルールを定義する。

---

## 1. ディレクトリ構成

### 推奨構成

Next.js App Router を前提とした推奨ディレクトリ構成:

```
src/
├── app/                    # App Router: ページ・レイアウト・ルートハンドラー
│   ├── (routes)/           # ルートグループ（URL に影響しないグループ化）
│   ├── api/                # Route Handlers（API エンドポイント）
│   ├── layout.tsx          # ルートレイアウト
│   └── page.tsx            # トップページ
├── components/             # 再利用可能な UI コンポーネント
│   ├── ui/                 # 汎用プリミティブ（ボタン、インプット等）
│   └── features/           # 機能ドメイン単位のコンポーネント
├── lib/                    # ユーティリティ・ヘルパー関数
├── hooks/                  # カスタム React フック
└── types/                  # 型定義（グローバルスコープのもの）

e2e/                        # Playwright E2E テスト
```

### 規約

- `app/` 配下にはページ・レイアウト・Route Handlers のみを置く。ビジネスロジックを持ち込まない
- コンポーネントはドメイン単位で `features/` に整理し、汎用コンポーネントは `ui/` に置く
- ページ固有のコンポーネントは対応する `app/` ディレクトリ内に配置してもよい
- プロジェクト固有のディレクトリ構成は ADR に記録する

---

## 2. テスト戦略

### テストレイヤーと対象

| レイヤー | ツール | 対象 | 配置 |
|---------|--------|------|------|
| ユニットテスト | Vitest | 関数・コンポーネントの単体動作 | `*.test.ts(x)` |
| 統合テスト | Supertest | API ルートの入出力 | `*.test.ts` |
| E2E テスト | Playwright | ユーザーシナリオ全体 | `e2e/` |

### 各レイヤーの方針

**ユニットテスト（Vitest）**

- 純粋関数・ユーティリティは必ずユニットテストを書く
- コンポーネントテストは `@testing-library/react` と組み合わせて行う
- テストファイルはテスト対象と同一ディレクトリに配置する（コロケーション）

**統合テスト（Supertest）**

- API Route Handlers の入出力を検証する
- DB やサードパーティサービスは原則モックする
- ハッピーパス + 主要エラーケースをカバーする

**E2E テスト（Playwright）**

- クリティカルなユーザーシナリオのみカバーする（量よりも質）
- テストは `e2e/` ディレクトリに集約し、`playwright.config.ts` でプロジェクト設定を管理する
- CI での並行実行を前提に設計する（テスト間の依存を持たせない）

---

## 3. 命名規約

### ファイル命名

| 対象 | 規約 | 例 |
|------|------|---|
| コンポーネントファイル | PascalCase | `UserCard.tsx` |
| ページ・レイアウト | Next.js 規約に従う | `page.tsx`, `layout.tsx` |
| フックファイル | camelCase（`use` プレフィックス） | `useUserData.ts` |
| ユーティリティ | camelCase | `formatDate.ts` |
| テストファイル | 対象ファイル名 + `.test` | `UserCard.test.tsx` |

### コンポーネント命名

- コンポーネント名は PascalCase で記述する（例: `UserProfileCard`）
- 汎用コンポーネントは用途を表す一般名詞を使う（例: `Button`, `Modal`）
- 機能コンポーネントはドメイン + 役割で命名する（例: `OrderSummaryPanel`）

### 関数・変数命名

- 関数名は camelCase。イベントハンドラーは `handle` プレフィックスを付ける（例: `handleSubmit`）
- ブール型変数は `is` / `has` / `can` プレフィックスを付ける（例: `isLoading`, `hasError`）

---

## 4. Biome 設定

### 基本設定方針

`biome.json` はリポジトリルートに配置し、全パッケージで共通設定を継承する。

```json
{
  "$schema": "https://biomejs.dev/schemas/1.x.x/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all"
    }
  }
}
```

### 運用方針

- `biome check` をローカル pre-commit フック（lefthook）および CI に組み込む
- プロジェクト固有のルール追加は `biome.json` の `overrides` セクションで管理し、ADR に理由を記録する
- `// biome-ignore` による抑制は禁止。根本原因を修正すること

---

## 参考

- [Next.js ドキュメント](https://nextjs.org/docs)
- [Vitest ドキュメント](https://vitest.dev/)
- [Supertest](https://github.com/ladjs/supertest)
- [Playwright ドキュメント](https://playwright.dev/)
- [Biome ドキュメント](https://biomejs.dev/)
