# Step 4: リンク整合性検証 — 詳細手順

プレイブック全章内の Markdown リンクを検証し、リンク切れを検出・修正する。

## 入力

- Step 3 で更新済みのプレイブックファイル（ステージング済み）

## 手順

### 1. Markdown リンクの抽出

プレイブック全 5 章から `[text](path)` 形式のリンクを抽出する:

```bash
# docs/playbook/ 配下の全 .md ファイルからリンクを抽出
grep -rn '\[.*\](.*\.md\|.*/)' docs/playbook/ | grep -v '^#'
```

抽出対象:

- 相対パスのファイルリンク（`[text](../../aidd-framework/FRAMEWORK.md)` 等）
- セクション内アンカーリンク（`[text](#section-name)` 等）は検証対象外（アンカーの存在チェックは困難なため）
- 外部 URL（`https://...`）は検証対象外

### 2. リンク先ファイルの存在チェック

各リンクについて、以下の手順で存在を検証する:

1. リンク元ファイルのディレクトリを基準に相対パスを解決する
2. 解決後のパスにファイルが存在するか確認する

```bash
# 例: docs/playbook/03-development.md 内の ../../aidd-framework/FRAMEWORK.md
# 基準ディレクトリ: docs/playbook/
# 解決後: aidd-framework/FRAMEWORK.md
test -f "aidd-framework/FRAMEWORK.md" && echo "OK" || echo "BROKEN"
```

### 3. 結果の報告

**リンク切れあり:**

```markdown
## リンク整合性検証: リンク切れ検出

| # | ファイル | 行 | リンクテキスト | リンク先（解決後） | 状態 |
|---|---------|-----|-------------|-----------------|------|
| 1 | 03-development.md | 42 | FRAMEWORK.md | aidd-framework/FRAMEWORK.md | ✅ 有効 |
| 2 | 05-reference.md | 15 | gitflow ガイド | aidd-framework/guides/gitflow-old.md | ❌ リンク切れ |

### リンク切れ修正案

| # | 現在のリンク先 | 修正案 | 根拠 |
|---|-------------|--------|------|
| 2 | aidd-framework/guides/gitflow-old.md | aidd-framework/guides/gitflow.md | ファイル名が変更されている |

この修正案で進めてよいですか？
```

**リンク切れなし:**

```markdown
## リンク整合性検証: 全リンク有効

検証リンク数: N 件
リンク切れ: 0 件

全てのリンクが有効です。
```

### 4. リンク切れ修正（ユーザー承認後）

ユーザーが修正案を承認した場合、該当ファイルのリンクを修正する。

### 5. コミット

全ての更新（Step 3 の再執筆 + Step 4 のリンク修正）をまとめてコミットする:

```bash
git add docs/playbook/
git commit -m "docs: プレイブック更新（[更新起点の概要]）"
```

## 成果物

- リンク検証結果レポート
- 更新済みプレイブックのコミット

## 完了時

`references/briefing-spec.md` の Step 4 完了時の要素に従ってブリーフィングを実行する。

```
プレイブックの更新が完了しました:
- 更新セクション: [一覧]
- リンク検証: 全リンク有効 / リンク切れ N 件修正
- コミット: [ハッシュ]

次のステップ:
→ `/aidd-next` で次のアクションを確認
```
