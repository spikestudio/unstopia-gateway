# AGENTS.md

<!-- このファイルは AI コーディングエージェント向けの設定ファイル。
     プロジェクト概要・セットアップ・Git 運用等は README.md を参照。 -->

<!-- aidd-fw:managed-start -->

## 参照すべきドキュメント

- **プロジェクト状態: SessionStart Hook で自動注入される（手動確認は `/aidd-status` または `gh issue list`）**
- 用語集: `docs/glossary.md`（ドメイン用語はこのファイルの定義に従うこと）
- ADR: `docs/architecture/adr/`（Task 定義で指定された ADR のみ参照。全 ADR を読む必要はない）
- 規約: `docs/conventions/`
- **IMPORTANT: `aidd-framework/` 配下はフレームワーク本体であり、フレームワーク更新時に最新版で上書きされる。プロジェクト固有の変更を加えてはならない。**
- フレームワーク本体: `aidd-framework/FRAMEWORK.md` / マイルストーン: `aidd-framework/process/milestones.md`
- トレーサビリティ: `aidd-framework/process/story-to-epic.md` / gitflow: `aidd-framework/guides/gitflow.md`

## タスク管理

作業の全体像は以下の場所で管理している。作業開始前に必ず確認すること。

| 管理対象 | 場所 | 確認コマンド |
|---------|------|------------|
| プロジェクト状態サマリー | SessionStart Hook で自動注入 | `/aidd-status` |
| 進行中の作業 | GitHub Issues (`status:in-progress` ラベル) | `gh issue list --label "status:in-progress"` |
| 未対応タスク・Epic | GitHub Issues | `gh issue list` |
| Phase の進捗 | GitHub Milestone | `gh issue list --milestone "Phase N"` |
| 仕様書・Task 定義 | `docs/requirements/` / `docs/tasks/` | |

## 作業の進め方

### AI の行動原則

**ユーザーに選択肢を丸投げしない。** プロジェクトの状態を自律的に分析し、根拠とともに推奨案を提示した上で承認を得ること。

**回答 ≠ 承認。** 次のステップに進むには「OK」「進めて」「承認」等の明確な意思表示が必要。

**CRITICAL: ブリーフィングは省略禁止。** スキルが成果物を生成したら、各スキルの `references/briefing-spec.md` に定義されたブリーフィングを**必ず実行**する。

### 会話開始時（必須）

1. SessionStart Hook で注入されたプロジェクト状態を確認し、現在地を把握する
2. 進行中の作業（`status:in-progress` Issue）に紐づく仕様書・Task 定義を読む
3. 「次は何をする？」→ 上記を踏まえて提案（不明な場合は `/aidd-next`）

### 作業開始時・完了時

- 開始時: `gh issue edit <番号> --add-label "status:in-progress"`
- 完了時: PR description の `Closes #N` で自動 close

### 通常の作業ルール

- 作業開始前に `gh issue list` で未対応の Issue を確認
- Task Issue に紐づく作業は PR description に `Closes #(Issue番号)` を記載
- 仕様変更・規約追記・AI ミスパターン発見時は feedback Issue を作成

### Epic フローの原則

- Epic フローでは `1 PR = 1 Epic` を守る
- Task は Epic ブランチ上のコミットとして積み上げる
- Epic 完了前に Task 単位の独立 PR を作成してはならない

## 実装の参考

- スキル実装例: `.agents/skills/aidd-new-phase/SKILL.md` / レビュー手順: `.agents/skills/aidd-review/references/`

## ドキュメント連動ルール

- ADR 作成時は対応するマスタドキュメントを同一 PR 内で即時更新すること
- マスタドキュメント未更新のまま ADR だけ作成してはならない

## 禁止事項 — IMPORTANT: 絶対禁止

- Task 定義の AC に含まれない機能を実装してはならない
- 新しい外部ライブラリを人間の確認なしに追加してはならない
- 既存のテストを、テストが通るように修正してはならない（テストが失敗する場合は実装を修正すること）
- ADR を作成してマスタドキュメントを更新しないまま PR を出してはならない
- 外部 URL・バージョン番号・設定値を記憶やトレーニングデータに基づいて書いてはならない。必ずドキュメントからコピーし、不明な場合は公式ソースで確認
- **Issue なしの作業開始禁止。** ブランチ作成・コード変更を開始する前に対応 Issue が必ず存在すること。Issue がない場合は先に Issue を作成してから作業を開始する
- **Issue 参照なしの PR 作成禁止。** PR description には必ず `Closes #N`（または `Related #N`）を含む Issue 参照を記載すること。参照なしの PR は作成してはならない
- **Phase/Epic パイプライン外の単発作業（バグ修正・雑務等）は `/aidd-adhoc` スキルを経由せずに直接実装・PR 作成・マージしてはならない**
- **IaC+GitOps プロジェクトでは `kubectl apply/delete/patch` 等の直接操作を提案してはならない。** k8s リソースの変更は Helm Chart / GitOps マニフェストの変更として提案すること。詳細は `aidd-framework/guides/iac-conventions.md` を参照
- **リンター・型チェッカー・静的解析の警告やエラーを suppress 指示で回避してはならない**
  - 禁止対象: `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `#[allow(...)]`, `// nolint`, `# noqa`, `# type: ignore` 等
  - 根本原因を修正すること。正当な理由がある場合は `suppress-approved: [理由]` マーカー付きでのみ許容

<!-- aidd-fw:managed-end -->

## プロジェクト固有の発見事項

<!-- AI が間違えたパターンを発見した都度、ここに追記する -->
<!-- 形式: 日付 + Task番号 + 問題の説明 + 正しい対応 -->

## ビルド・テストコマンド

```bash
# ビルド
[コマンド]

# テスト
[コマンド]

# リント
[コマンド]
```
