# Step 3: アノテーション付き設計ドキュメント生成 — 詳細手順

## 3-1. 出力先ディレクトリの確認

`docs/design/screen-ui-[slug]/` を確認し、存在しない場合は作成する。`[slug]` は Step 0 で取得した screen-spec ディレクトリのスラッグ（`screen-spec-[slug]` の `[slug]` 部分）を使用する。

## 3-2. アノテーション付きドキュメントの生成

`references/ui-component-template.md` を基に、各 SCR-ID に対して `docs/design/screen-ui-[slug]/[SCR-ID]-[screen-slug].md` を生成する。

### 生成するセクション

**コンポーネント選定テーブル（Step 1 の結果から）:**

```markdown
| UI 要素 | UIKit コンポーネント | Props | バリアント | インポートパス |
|---------|-----------------|-------|----------|--------------|
| 送信ボタン | Button | size="default" | variant="default" | `import { Button } from '@spikestudio/uikit/components/ui/button'` |
```

**カタログ参照情報（catalog.json から取得）:**

```markdown
| コンポーネント | catalog.json ID | useWhen | combinesWith |
|-------------|----------------|---------|-------------|
| Button | button | ユーザーの操作を促す場合 | input, form |
```

**レスポンシブレイアウト（Step 2 の結果から）:**

```markdown
### sm（モバイル）
1カラム縦スタック、ボタンはフル幅

### md（タブレット）
2カラム（フォーム左、プレビュー右）

### lg（デスクトップ）
3カラム（サイドバー左、フォーム中、プレビュー右）
```

**インポート一覧（アノテーション）:**

```tsx
import { Button } from '@spikestudio/uikit/components/ui/button'
import { Input } from '@spikestudio/uikit/components/ui/input'
import { DataTable } from '@spikestudio/uikit/components/composites/data-table'
// カスタム実装
import { CustomNavigation } from '@/components/custom/custom-navigation'
```

## 3-3. 生成確認

各 SCR-ID のドキュメント生成後にユーザーに提示して確認を求める:

```
## 生成完了: docs/design/screen-ui-[slug]/[SCR-ID]-[screen-slug].md

- コンポーネント選定: N 件（カスタム実装: M 件）
- レスポンシブ: [対応あり / 対応不要]
- インポートパス: N 件

次の画面に進みますか？（OK / このドキュメントを修正したい）
```

## 3-4. 全体サマリー

全 SCR-ID の生成が完了したら以下のサマリーを提示してユーザーの承認を求める:

```
## アノテーション付き設計ドキュメント生成完了

生成先: docs/design/screen-ui-[slug]/
生成件数: N 件

| SCR-ID | 画面名 | コンポーネント数 | カスタム実装数 |
|--------|--------|--------------|-------------|
| SCR-001 | [画面名] | N | M |

全体で承認しますか？（OK / 修正したい画面を指定）
```

## 完了時

全ドキュメントが生成・承認されたら Step 4 に進む。
