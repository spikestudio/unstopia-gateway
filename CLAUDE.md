# CLAUDE.md
<!-- AI コーディングエージェント向け設定ファイル。概要・セットアップ・Git 運用等は README.md 参照 -->

<!-- aidd-fw:import-start -->
@aidd-framework/CLAUDE-base.md
<!-- aidd-fw:import-end -->

## プロジェクト概要

unstopia-gateway は jinn v0.9.3 をベースにした独自フォーク。Antigravityエンジン対応・クロスセッション記憶システム・多層スキル/ツール管理・Codex改善 を順次追加していく AI gateway daemon。

## 規約

詳細は `docs/conventions/` を参照すること:

- 命名規則: `docs/conventions/naming.md`
- ディレクトリ構造: `docs/conventions/directory-structure.md`
- レイヤー間のルール: `docs/conventions/layer-rules.md`
- エラーハンドリング: `docs/conventions/error-handling.md`
- テスト規約: `docs/conventions/testing.md`
- 禁止事項: `docs/conventions/prohibitions.md`
- Git 運用ルール: `docs/conventions/git-workflow.md`

## プロジェクト固有の発見事項

<!-- AI が間違えたパターンを発見した都度、ここに追記する -->
<!-- 形式: - **[要点]**: [説明]（#Issue番号） -->

## ビルド・テストコマンド

```bash
# ビルド
pnpm build

# テスト
pnpm test

# リント
pnpm lint

# 型チェック
pnpm typecheck
```
