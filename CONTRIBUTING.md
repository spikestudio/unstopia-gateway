# Contributing to unstopia-gateway

## 開発フロー概要

このプロジェクトは [aidd-framework](aidd-framework/FRAMEWORK.md) を採用しています。
実装作業は以下のパイプラインに沿って進めます。

```
/aidd-new-phase → /aidd-new-epic → /aidd-decompose-epic → /aidd-impl → /aidd-epic-review → /aidd-phase-review
```

横断スキル（いつでも使用可）:

| スキル | 用途 |
|--------|------|
| `/aidd-status` | Phase / Epic / Task の進捗確認 |
| `/aidd-next` | 次のアクション提案 |
| `/aidd-adhoc` | バグ修正・緊急修正・単発作業 |
| `/aidd-discuss` | 方針決定が必要な場面 |
| `/aidd-impl-review` | 実装中のコードレビュー |
| `/aidd-doctor` | 環境健康診断 |

## ブランチ命名規則

GitHub Flow を採用します。`main` は常にデプロイ可能な状態を維持します。

```
<type>/<scope>
```

| type | 用途 | 例 |
|------|------|----|
| `feat` | 新機能 | `feat/antigravity-engine` |
| `fix` | バグ修正 | `fix/codex-streaming` |
| `chore` | 雑務・設定変更 | `chore/update-deps` |
| `docs` | ドキュメント | `docs/e5-contributing` |
| `refactor` | リファクタリング | `refactor/session-manager` |
| `test` | テスト追加・修正 | `test/gateway-unit` |

aidd-framework のフロー（Epic 作業）では以下の命名を使用します:

| 種別 | パターン | 例 |
|------|---------|-----|
| 機能開発（Epic） | `feature/ES-NNN-slug` | `feature/ES-001-user-auth` |
| バグ修正 | `fix/ISSUE-NNN-slug` | `fix/ISSUE-012-login-error` |
| 設計成果物 | `docs/PD-NNN-slug` | `docs/PD-001-mvp` |

## コミット規約

[Conventional Commits](https://www.conventionalcommits.org/) を使用します。

```
<type>(<scope>): <subject>
```

| type | 用途 |
|------|------|
| `feat` | 新機能の追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみの変更 |
| `refactor` | リファクタリング（機能変更なし） |
| `test` | テストの追加・修正 |
| `chore` | ビルド・CI・依存関係などの雑務 |
| `ci` | CI/CD 設定の変更 |
| `perf` | パフォーマンス改善 |
| `style` | コードスタイルの変更（ロジック変更なし） |
| `revert` | コミットの取り消し |

**commit-msg フックにより、上記形式に準拠しないメッセージはコミットを拒否します。**

例:
```
feat(engines): add Antigravity engine adapter
fix(sessions): resolve session leak on timeout
docs: update CONTRIBUTING.md
chore(deps): upgrade grammy to v1.x
```

## PR フロー

1. **Issue の確認・作成** — 作業前に対応 Issue が存在することを確認。なければ作成
2. **ブランチ作成** — `main` から作業ブランチを作成
3. **実装・コミット** — Conventional Commits に従ってコミット
4. **PR 作成** — PR body に `Closes #N` を必ず記載
5. **CI 通過確認** — GitHub Actions の biome check・カバレッジ閾値・テストが全 PASS
6. **レビュー** — コードレビューを実施
7. **マージ** — Squash merge を使用（`gh pr merge --squash --delete-branch`）

### PR のルール

- `main` への直接 push は禁止
- PR body には必ず `Closes #N`（または `Related #N`）を記載
- CI が通らない PR はマージしない
- Epic PR は `[WIP]` プレフィックスで draft 開始し、`/aidd-epic-review` PASS 後に解除

## ローカル品質チェック

コミット前に以下のフックが自動実行されます（lefthook）:

| タイミング | チェック |
|-----------|---------|
| pre-commit | `pnpm lint`（biome check）+ `pnpm typecheck` + actionlint |
| commit-msg | Conventional Commits 形式の検証 |
| pre-push | `pnpm build` + `pnpm test` |

手動で実行する場合:

```bash
pnpm lint       # biome check（ゼロ警告必須）
pnpm typecheck  # TypeScript 型チェック
pnpm test       # 全テスト実行
pnpm build      # プロダクションビルド
```

## モジュール依存関係

詳細は [docs/architecture/module-dependencies.md](docs/architecture/module-dependencies.md) を参照してください。
