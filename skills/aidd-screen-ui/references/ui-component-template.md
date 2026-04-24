<!-- 配置先: docs/design/screen-ui-[epic-slug]/[SCR-ID]-[screen-slug].md にコピーして使用する -->
<!-- 生成スキル: /aidd-screen-ui -->
<!-- 後続スキル: /aidd-decompose-epic（G3 PASS 後の Task 分解）-->

# UI 設計: [画面名]（[SCR-ID]）

| 項目 | 内容 |
|------|------|
| SCR-ID | SCR-NNN |
| 画面名 | [画面名] |
| 種別 | 一覧 / 詳細 / フォーム / ダッシュボード / モーダル / ウィザード / エラー |
| 対象 Epic | ES-NNN |
| 元画面仕様書 | docs/design/screen-spec-[slug]/[SCR-ID]-[screen-slug].md |
| 生成日 | yyyy-mm-dd |

## コンポーネント選定

| UI 要素 | UIKit コンポーネント | Props | バリアント | インポートパス |
|---------|-----------------|-------|----------|--------------|
| [UI要素名] | [コンポーネント名] | [主要Props] | [バリアント名] | `import { X } from '@spikestudio/uikit/components/...'` |
| [UI要素名] | カスタム実装 | — | — | — |

### カタログ参照情報

| コンポーネント | catalog.json ID | useWhen | combinesWith |
|-------------|----------------|---------|-------------|
| [コンポーネント名] | [catalog ID] | [使用条件] | [組み合わせ推奨] |

## レスポンシブレイアウト

<!-- レスポンシブ対応不要の場合は「レスポンシブ対応不要: [理由]」と記載 -->

### sm（モバイル, < 768px）

```
[レイアウト説明: カラム数・表示/非表示・スタック方向等]
```

### md（タブレット, 768px〜1024px）

```
[レイアウト説明]
```

### lg（デスクトップ, > 1024px）

```
[レイアウト説明]
```

### ブレークポイント別差分

| 要素 | sm | md | lg |
|------|-----|-----|-----|
| [UI要素] | [状態] | [状態] | [状態] |

## アノテーション

### 使用コンポーネント一覧

```tsx
// 使用コンポーネントのインポート一覧
import { ComponentA } from '@spikestudio/uikit/components/ui/component-a'
import { ComponentB } from '@spikestudio/uikit/components/composites/component-b'
// カスタム実装
import { CustomComponent } from '@/components/custom/custom-component'
```

### 実装ガイド

| コンポーネント | Props 設定 | 備考 |
|-------------|-----------|------|
| [コンポーネント名] | `variant="..."` `size="..."` | [実装時の注意点] |

## サンプル（記入例）

### コンポーネント選定 例

| UI 要素 | UIKit コンポーネント | Props | バリアント | インポートパス |
|---------|-----------------|-------|----------|--------------|
| 送信ボタン | Button | `size="default"` | `variant="default"` | `import { Button } from '@spikestudio/uikit/components/ui/button'` |
| テキスト入力 | Input | `type="text"` | — | `import { Input } from '@spikestudio/uikit/components/ui/input'` |
| データ一覧 | DataTable | `columns={...}` `data={...}` | — | `import { DataTable } from '@spikestudio/uikit/components/composites/data-table'` |
| カスタムナビ | カスタム実装 | — | — | — |

### レスポンシブレイアウト 例

```
sm: 1カラム、ボタンはフル幅
md: 2カラム（フォーム左、プレビュー右）
lg: 3カラム（サイドバー左、フォーム中、プレビュー右）
```
