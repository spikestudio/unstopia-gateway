# CLAUDE.md
<!-- AI コーディングエージェント向け設定ファイル。概要・セットアップ・Git 運用等は README.md 参照 -->

<!-- aidd-fw:import-start -->
@aidd-framework/CLAUDE-base.md
<!-- aidd-fw:import-end -->

## プロジェクト概要

unstopia-gateway は jinn v0.9.3 をベースにした独自フォーク。Antigravityエンジン対応・クロスセッション記憶システム・多層スキル/ツール管理・Codex改善 を順次追加していく AI gateway daemon。

## 規約

### 命名規則

<!-- TODO: 変数、関数、ファイル、ディレクトリの命名規則を記述してください -->

### エラーハンドリング

<!-- TODO: エラーの伝播方法、ログ出力、リカバリ方針を記述してください -->

### テスト

<!-- TODO: テストの命名、構造、カバレッジ基準を記述してください -->

### レイヤー間のルール

<!-- TODO: 依存方向、データの受け渡し方を記述してください -->

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
