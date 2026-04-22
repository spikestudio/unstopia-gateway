# Getting Started: プロジェクトへの導入ガイド

このガイドでは、Development Framework を新規プロジェクトに導入する手順を説明する。

## 前提

- Git リポジトリが存在する
- AI 駆動開発を行うチームが存在する（規模不問）

## 推奨: `/aidd-setup`

Claude Code で以下を実行すれば、フレームワークの導入からプロジェクト初期セットアップまでを自動で実行できる。

```
/plugin marketplace add spikestudio/aidd-fw
/plugin install aidd-fw@aidd-fw
/aidd-setup fw
/aidd-setup project
```

`/aidd-setup fw` はフレームワークファイルを `aidd-framework/` に配置する。
`/aidd-setup project` はプロジェクトの初期セットアップ（GitHub 設定、ディレクトリ作成、ドキュメント雛形作成）を対話的に実行する。

詳細は [README.md の導入方法](../README.md#導入方法) を参照。

## `/aidd-setup project` 実行後に進める手順

### Step 1: CHARTER を埋める

`/aidd-setup project` で作成された `docs/PROJECT-CHARTER.md` に以下を記入する:

- ビジョン（このプロジェクトが目指す世界）
- ビジネスゴール（達成すべき具体的な目標）
- Phase ロードマップ（大まかな開発計画）

### Step 2: 技術スタックを選定し、ADR に記録する

技術選定のたびに ADR を作成する。マスタドキュメント（技術スタック一覧）も別途作成する。
`aidd-framework/templates/adr.md` をテンプレートとして使用する。

### Step 3: アーキテクチャ方針を決定する

ADR に記録し、アーキテクチャ概要マスタを作成する。

### Step 4: 規約ドキュメントを埋める

`/aidd-setup project` で `docs/conventions/` に作成された7ファイルの TODO を埋める。
書き方のガイドは `aidd-framework/guides/convention-bootstrap.md` を参照。

### Step 5: 開発環境・CI を構築する

- ローカル開発環境が1コマンドで起動できること
- CI パイプラインでリント・テスト・ビルドが自動実行されること
- CI 設定後、ブランチプロテクションの `required_status_checks` を有効にする

### Step 6: 次のアクション確認

`/aidd-next` を実行し、初期セットアップの残タスクを確認する。

全項目を満たしたら、Skeleton 構築に進む。

### Step 7: Skeleton 構築

1. 最小限の機能を1つ選ぶ
2. DB → ドメインモデル → API（または画面）→ テストを E2E で実装する
3. ローカルでテストを実行して通過を確認する（`task test`）
4. 規約ドキュメントを実装結果に基づいて修正する

### Step 8: Phase 1 開始

Skeleton が動作したら、`/aidd-new-phase` で Phase 定義に着手する。

以降は FRAMEWORK.md の「段階的詳細化プロセス」に従って進める。

## Tips

<!-- レビュー指摘: チーム規模別の運用イメージが掴みにくく、FRAMEWORK.md の詳細ガイダンスへの導線が弱かった -->
### チーム規模に応じたマイルストーン運用

- **AI 自動判定可能:** G4（Epic 分解承認）は AI が機械的チェックを実行可能
- **AI 一次判定 + 人間承認:** G5（PR レビュー）は AI が一次検証、人間が最終承認
- **小規模チーム:** セルフチェックでマイルストーン通過を判定してよい（判断根拠を記録すること）
- G2（Epic 仕様書承認）と G5（PR レビュー）は可能な限り別の人がレビューする
- AI をセルフレビューに活用して品質を補完する

詳細は以下を参照:
- [スケーリングガイド](./scaling-guide.md) — ソロ+AI / 小規模 / 中規模のパターン別実践手順
- [AI 判定レベル別の運用ガイド](./scaling-guide.md#3-ai-判定レベル別の運用ガイド) — マイルストーンごとの AI 判定・人間承認パターン

### 規約ドキュメントの成長

- 最初から完璧な規約は不要。最低限の7項目からスタートする
- AI が間違えたパターンを発見するたびに追記する
- Phase 完了レトロスペクティブで規約の充実度を振り返る

### テンプレートのカスタマイズ

テンプレートはプロジェクトに合わせて自由にカスタマイズしてよい。ただし、チェックリストの項目を安易に削除しないこと（品質低下のリスク）。
