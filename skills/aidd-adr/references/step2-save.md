# Step 2: ADR 採番・保存 — 詳細手順

Step 1 で引き出した ADR 内容を `aidd-framework/templates/adr.md` に基づいてフォーマットし、採番・保存する。

## 入力

- Step 1 で生成した ADR 下書き（ユーザーが承認済み）
- `aidd-framework/templates/adr.md`（ADR テンプレート）

## 手順

### 1. ADR ディレクトリの確認・作成

```bash
mkdir -p docs/architecture/adr/
```

### 2. ADR 採番

`scripts/next-number.sh` で次の ADR 番号を取得する:

```bash
bash scripts/next-number.sh ADR docs/architecture/adr/
# 例: 007 → ADR-007
```

### 3. slug の生成

ADR タイトルから slug を生成する（英小文字・ハイフン区切り）。

例: 「認証方式の選定」→ `auth-method-selection`

### 4. ADR ファイルの作成

`aidd-framework/templates/adr.md` をベースに ADR 下書きの内容を書き込む:

- 保存先: `docs/architecture/adr/ADR-NNN-slug.md`
- ステータス: 「承認済み」（ユーザーが承認した場合）または「提案」
- 日付: 作成日（`date +%Y-%m-%d`）
- 決定者: git config user.name または TL

### 5. コミット

```bash
git add docs/architecture/adr/ADR-NNN-slug.md
git commit -m "docs: ADR-NNN [タイトル]"
```

> **注意:** ADR 作成後は必ず Step 3（矛盾チェック）を実行すること。矛盾が MUST FIX と判定された場合は ADR を修正してから確定する。

## 成果物

`docs/architecture/adr/ADR-NNN-slug.md`
