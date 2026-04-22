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
