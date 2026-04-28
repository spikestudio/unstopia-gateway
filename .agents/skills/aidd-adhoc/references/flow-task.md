# task 種別フロー — 既存 Epic への後付け Task

既存 Epic に後から Task を追加する。Epic ブランチ上のコミットとして管理される（独立 PR ではない）。

## フロー

```
親 Epic 選択 → Issue 作成 → Task 定義作成 → 実装 → セルフレビュー → ブリーフィング → 承認 → コミット
```

## ステップ詳細

### 1. 親 Epic の選択

オープンな Epic Issue から親 Epic を選択する:

```bash
gh issue list --label "epic" --state open --json number,title
```

- 1 件のみ → 自動選択（ユーザーに確認）
- 複数 → ユーザーに選択を求める
- 0 件 → エラー: 「オープンな Epic がありません。chore 種別を使用するか、`/aidd-new-epic` で Epic を作成してください」

### 2. Epic ブランチに切り替え

```bash
git checkout feature/ES-NNN-slug
git pull --ff-only
```

### 3. Issue 作成

```bash
gh issue create \
  --title "task: TASK-NNN [Task名]" \
  --label "task" \
  --milestone "[Phase名]" \
  --body "## 責務\n[概要]\n\n## 親 Epic\n#[Epic Issue番号]\n\n## 対応 AC\n[既存 AC への追加 or 新規 AC]"
```

### 4. Task 定義作成

`docs/tasks/TASK-NNN-slug.md` を作成する。以下を含める:

- 親 Epic への参照
- 対応する AC（既存 AC への追加対応 or 新規 AC の場合は Epic 仕様書も更新）
- 対象ファイル
- 完了条件
- テスト方針

### 5. 実装

- Task 定義の AC に従って実装
- テスト方針に従ってテストを実装
- 既存テストの通過確認

### 6. セルフレビュー

セルフレビュー反復ループを実施する（aidd-framework/references/self-review-loop.md 参照）。スキル固有の追加観点:

| 観点 | チェック |
|------|---------|
| AC 準拠 | Task AC を正確に満たしているか |
| スコープ | Epic の既存 Task と重複・矛盾していないか |
| テスト | テスト方針に従っているか |
| 規約 | 規約に準拠しているか |

### 7. コミット（Epic ブランチ上）

```bash
git add [変更ファイル]
git commit -m "feat: TASK-NNN [Task名]"
```

**注意:** 独立 PR は作成しない。Epic PR に含まれる。

## 成果物

| 成果物 | 必須 |
|--------|------|
| GitHub Issue | 必須 |
| Task 定義 | 必須 |
| 実装コード | 必須 |
| テスト | テスト方針に従う |
| PR | **なし**（Epic PR に含まれる） |
