# Git 運用ルール

## ブランチ戦略

GitHub Flow を採用する。

- `main`: 常にデプロイ可能な状態を維持
- 機能ブランチ: `main` から作成し、PR でマージ

## ブランチ命名規則

```
<type>/<scope>
```

| type | 用途 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `chore` | 雑務・設定変更 |
| `docs` | ドキュメント |
| `refactor` | リファクタリング |
| `test` | テスト追加・修正 |

例: `feat/antigravity-engine`, `fix/codex-streaming`, `chore/aidd-fw-install`

## Conventional Commits

コミットメッセージは Conventional Commits 形式を使用する:

```
<type>(<scope>): <subject>
```

例:
```
feat(engines): add Antigravity engine adapter
fix(codex): stabilize streaming output
chore: aidd-fw フレームワークのインストール
```

## マージ方式

- Squash merge を使用（Epic 単位でコミット履歴をまとめる）
- Epic PR は `[WIP]` プレフィックスで draft 開始し、レビュー後に解除

## Epic フロー

`1 PR = 1 Epic`。Task は Epic ブランチ上のコミットとして積み上げる。

## Epic 作成時のルール

- `gh issue create` には必ず `--milestone "Phase N: ..."` を付ける（未紐付けは禁止）
- 分割系 Epic 完了後は分割先の全ファイルが 500 行以下であることを確認する

## Phase 定義書のバッファ枠

Phase 定義書には以下セクションを含めること（#173）:

```markdown
## バッファ

Phase 中に発生するフィードバック対応・調整 Epic のための予備スロット: 2枠

## 追加 Epic（Phase 中に発生したもの）

| # | Epic 名 | 発生理由 |
|---|---------|---------|
| （発生時に追記） | | |
```
