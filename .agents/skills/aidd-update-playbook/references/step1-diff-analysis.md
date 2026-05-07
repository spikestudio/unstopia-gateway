# Step 1: 差分解析（FW 差分起点モード）— 詳細手順

FW の変更差分を git diff で取得し、変更の概要を構造化する。

## 入力

- 実行モード: FW 差分起点（引数なし）
- SKILL.md Step 0 で前提条件チェック済み

## 手順

### 1. FW 全体像の読み込み

以下を順に読み込み、FW の現在の構造を把握する:

1. `aidd-framework/FRAMEWORK.md` — 原則・プロセス定義・意思決定基準
2. `skills/` 配下の全スキルの frontmatter（name, description）を収集:

   ```bash
   for skill_dir in skills/*/; do
     head -10 "${skill_dir}SKILL.md" 2>/dev/null
   done
   ```

3. `aidd-framework/guides/` の一覧を把握（ファイル名のみで十分）

### 2. プレイブック全体像の読み込み

`docs/playbook/` 配下の全ファイルを読み込む:

- `docs/playbook/index.md`
- `docs/playbook/01-introduction.md`
- `docs/playbook/02-setup.md`
- `docs/playbook/03-development.md`
- `docs/playbook/04-recovery-faq.md`
- `docs/playbook/05-reference.md`

> **CRITICAL:** 差分だけを見て影響判定しない。全体像を俯瞰した上で判定すること。

### 3. プレイブック最終更新コミットの検出

```bash
# プレイブックが最後に更新されたコミットを取得
PLAYBOOK_LAST_COMMIT=$(git log --oneline -1 --format="%H" -- docs/playbook/)
echo "プレイブック最終更新: ${PLAYBOOK_LAST_COMMIT}"
```

### 4. FW 変更差分の取得

```bash
# プレイブック最終更新以降の FW 関連ファイルの変更を取得
git diff ${PLAYBOOK_LAST_COMMIT}..HEAD -- aidd-framework/ skills/
```

**diff が空の場合:**

- 「FW に変更がありません。プレイブックは最新の状態です。」と表示して終了

### 5. 変更の構造化

diff の内容を以下の形式で整理する:

```markdown
## FW 変更サマリー

| 変更種別 | ファイル | 概要 |
|---------|--------|------|
| 新規追加 | skills/aidd-adr/SKILL.md | /aidd-adr スキル新設 |
| 変更 | aidd-framework/FRAMEWORK.md | 横断スキル表に aidd-adr 追加（12行） |
| 変更 | skills/aidd-impl/SKILL.md | セルフレビュー観点追加（3行） |

**変更の意味:**
- 新スキル `/aidd-adr` が追加された。ADR の対話的作成・採番・保存・矛盾チェックを行うスキル
- `/aidd-impl` に軽微な機能追加（セルフレビュー観点）
```

## 成果物

構造化された FW 変更サマリー。Step 2（影響セクション判定）の入力となる。

## 完了時

変更サマリーをユーザーに提示し、内容に誤りがないか確認を得る。確認後 Step 2 に進む。
