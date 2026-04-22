# コンポジット・レイアウト・ページ追加ガイド

`ui/components/` に新しいコンポジット・レイアウト・ページコンポーネントを追加する手順。

## 前提

- コンポーネントのレイヤー・カテゴリが決まっていること（`docs/conventions/ui-component-arch.md` の Layers 参照）
- 使用する shadcn/ui コンポーネントが `ui/components/ui/` にインストール済みであること

## 手順

### Step 1: コンポーネントファイルの作成

`ui/components/{category}/{slug}.tsx` を作成する。

| カテゴリ | ディレクトリ | 例 |
|---------|------------|-----|
| composite | `composites/` | `composites/stat-card.tsx` |
| layout | `layouts/` | `layouts/sidebar-layout.tsx` |
| page | `pages/` | `pages/dashboard-page.tsx` |

#### コンポーネントの必須要件

```tsx
// 1. "use client" ディレクティブ（必須）
"use client";

// 2. JSDoc ヘッダー（必須）
/**
 * @file コンポーネント名 — 簡潔な説明
 * @description 詳細な用途説明
 *
 * 使用コンポーネント: Button, Card, Badge, ...
 * カスタマイズポイント:
 *   - TODO: 項目データを API/DB から取得
 *   - TODO: アクションハンドラーを実装
 */

// 3. import は @/components/ui/* から（必須）
import { Button } from "@/components/ui/button";

// 4. アイコンは lucide-react から（必須）
import { Search, Plus } from "lucide-react";

// 5. モックデータはファイル内にインライン定義（必須）
const mockItems = [
  { id: "1", title: "サンプル項目", status: "active" },
  // ...
];

// 6. TODO コメントでカスタマイズポイントを明示（必須）
// TODO: API からデータを取得するように変更
```

#### 品質チェックリスト

- [ ] セマンティックトークンのみ使用（`bg-primary` ○、`bg-blue-500` ×）
- [ ] 日本語テキストを含むモックデータ
- [ ] レスポンシブ対応（モバイル〜デスクトップ）
- [ ] Light / Dark 両モードで表示確認
- [ ] アクセシビリティ（キーボード操作、適切な ARIA）
- [ ] 適切な TODO コメント（カスタマイズポイント全箇所）

### Step 2: Stories ファイルの作成

`ui/stories/{category}/{slug}.stories.tsx` を作成する。

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplateName } from "@/components/{category}/{slug}";

const meta: Meta<typeof TemplateName> = {
  title: "{Category}/{TemplateName}",
  component: TemplateName,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen", // Layouts/Pages は fullscreen、Components は centered
  },
};
export default meta;
type Story = StoryObj<typeof TemplateName>;

export const Default: Story = {};

// 状態バリエーションがある場合は追加
export const Empty: Story = { /* ... */ };
export const Loading: Story = { /* ... */ };
```

**Stories の品質基準は `docs/conventions/ui-component-arch.md` の「Stories の品質基準」セクション参照。**

### Step 3: catalog.json の更新

`ui/catalog.json` の `templates` 配列にエントリを追加する。

```json
{
  "id": "slug-name",
  "file": "{category}/{slug}.tsx",
  "category": "{component|layout|page}",
  "tags": ["日本語タグ1", "タグ2"],
  "useWhen": "このテンプレートを使うべき状況の説明",
  "avoidWhen": "このテンプレートを避けるべき状況の説明",
  "similarTo": [
    {
      "id": "similar-template-id",
      "diffSummary": "類似テンプレートとの違いの説明"
    }
  ],
  "combinesWith": ["組み合わせ可能なテンプレートID"],
  "layer": "{component|layout|page}",
  "states": ["default", "empty", "loading", "error"],
  "requiredComponents": ["使用する shadcn/ui コンポーネント名"],
  "requiredIcons": ["使用する Lucide アイコン名"]
}
```

**全フィールドが必須。** 省略するとAI のコンポーネント推薦精度が下がる。

### Step 4: ビルド確認

```bash
# Storybook ビルドが通ることを確認
task ui:build-storybook

# 新しい Stories が表示されることを確認
task ui:storybook
```

### Step 5: PR 作成

1 PR に含めるもの:
- コンポーネント `.tsx` ファイル
- Stories `.stories.tsx` ファイル
- `catalog.json` の更新

## アンチパターン

| やってはいけないこと | 正しいアプローチ |
|-------------------|----------------|
| catalog.json の更新を忘れる | コンポーネントと同時に必ず更新 |
| Stories なしでコンポーネントを追加 | Stories は必須。Storybook にないものはデザインシステムに存在しない |
| 英語のみのモックデータ | 日本語テキストを必ず含める |
| `similarTo` を空にする | 類似テンプレートがない場合でも、最も近いものを記載する |
| ハードコード色の使用 | セマンティックトークンのみ |
