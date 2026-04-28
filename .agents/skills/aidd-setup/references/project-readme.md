<!-- レビュー指摘: README.md テンプレートがなく、CLAUDE.md と責務が混在していた -->
# [プロジェクト名]

## 概要

[プロジェクトの目的を2-3文で]

## 技術スタック

| 項目 | 技術 | 根拠 |
|------|------|------|
| 言語 | | ADR-xxx |
| フレームワーク | | ADR-xxx |
| DB | | ADR-xxx |
| CI | | |

## セットアップ

### 前提条件

| ツール | バージョン |
|--------|----------|
| [ランタイム] | x.x+ |
| [パッケージマネージャ] | x.x+ |
| [DB] | x.x+ |

### 環境変数

```bash
cp .env.example .env
# .env を編集し、必要な値を設定する
```

### 起動手順

```bash
# 依存のインストール
[コマンド]

# DB のセットアップ
[コマンド]

# 開発環境の起動
[コマンド]
```

## ディレクトリ構成

```
project-root/
├── docs/
│   ├── aidd-fw/            # フレームワーク（プラグインからコピー）
│   ├── requirements/       # Phase 定義書、Epic 仕様書
│   │   ├── PD-NNN-*.md     # Phase 定義書
│   │   └── ES-NNN-*.md     # Epic 仕様書
│   ├── tasks/              # Task 定義
│   │   └── TASK-NNN-*.md
│   ├── architecture/
│   │   └── adr/            # Architecture Decision Records
│   ├── conventions/        # 規約ドキュメント群
│   └── glossary.md         # 用語集
├── src/                    # [アプリケーションコードの構造を記述]
├── tests/                  # [テストコードの構造を記述]
├── CLAUDE.md               # AI ツール設定（規約・禁止事項）
└── README.md               # このファイル
```

## アーキテクチャ

[レイヤー構成、コンポーネント構成の概要を記述。詳細はアーキテクチャ概要マスタを参照]

## Git 運用

- ブランチ戦略: GitHub Flow
- ブランチ命名: `feature/TASK-NNN-slug`
- マージ方式: [squash merge / merge commit]
- コミットメッセージ: [Conventional Commits 等]

## ドキュメント

| ドキュメント | 場所 | 説明 |
|------------|------|------|
| フレームワーク | `aidd-framework/FRAMEWORK.md` | 開発プロセスの定義 |
| 用語集 | `docs/glossary.md` | ドメイン用語の定義 |
| ADR | `docs/architecture/adr/` | 技術的意思決定の記録 |
| 規約 | `docs/conventions/` | コーディング規約・テスト規約等 |

## ビルド・テスト

```bash
# ビルド
[コマンド]

# テスト（全体）
[コマンド]

# テスト（単体・指定）
[コマンド]

# リント
[コマンド]
```
