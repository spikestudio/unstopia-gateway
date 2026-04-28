# Step 2: CLAUDE.md / AGENTS.md 移行処理（詳細手順）

## PLUGIN_DIR の特定

```bash
PLUGIN_DIR="${HOME}/.claude/plugins/marketplaces/aidd-fw"
```

## CLAUDE.md の処理

### CLAUDE.md の判定

```bash
grep -q '<!-- aidd-fw:import-start -->' CLAUDE.md 2>/dev/null && echo "imported" || echo "not-imported"
```

### @import 導入済みの場合（`import-start` マーカーあり）

`CLAUDE-base.md` は Step 1 で更新済み。CLAUDE.md は変更不要。

### @import 未導入の場合（マーカーなし）

`PLUGIN_DIR/skills/aidd-setup/references/cat-fw.md` の `§ AI エージェント指示ファイルの設計方針` セクションを読み、以下の移行を実行する:

1. CLAUDE.md からフレームワーク管理 8 セクションを検出して除去:
   - `## 参照すべきドキュメント`
   - `## 意思決定基準`
   - `## タスク管理`
   - `## 作業の進め方`
   - `## スキルパイプライン`
   - `## 実装の参考`
   - `## ドキュメント連動ルール`
   - `## 禁止事項`
2. 除去した位置に @import ブロックを挿入:

   ```
   <!-- aidd-fw:import-start -->
   @aidd-framework/CLAUDE-base.md
   <!-- aidd-fw:import-end -->
   ```

3. 変更内容をユーザーに提示して確認を得る

## AGENTS.md の処理

### AGENTS.md の判定

```bash
grep -q '<!-- aidd-fw:managed-start -->' AGENTS.md 2>/dev/null && echo "managed" || echo "not-managed"
```

### managed マーカーあり

AGENTS.md の `<!-- aidd-fw:managed-start -->` から `<!-- aidd-fw:managed-end -->` の範囲を、`${PLUGIN_DIR}/skills/aidd-setup/references/agents-md.md` の managed 範囲の内容で全置き換えする。

```
# 置き換えイメージ
[AGENTS.md の managed-start より前の部分]
<!-- aidd-fw:managed-start -->
（agents-md.md の managed 範囲の内容で全置き換え）
<!-- aidd-fw:managed-end -->
[AGENTS.md の managed-end より後の部分]
```

### managed マーカーなし / AGENTS.md が存在しない

ユーザーに状況を提示して手動確認を求める。自動処理を強行しない。

```
AGENTS.md に <!-- aidd-fw:managed-start --> マーカーが見つかりませんでした。
以下のいずれかを選択してください:
1. テンプレートから新規作成（既存内容は破棄）
2. 手動で managed 範囲を確認・設定する
3. スキップ（AGENTS.md を変更しない）
```
