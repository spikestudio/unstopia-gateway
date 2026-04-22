<!-- このファイルは /aidd-setup fw で全置き換えされます。直接編集しないでください。 -->
<!-- プロジェクト固有の設定は CLAUDE.md のプロジェクト固有セクションに記述してください。 -->

## 参照すべきドキュメント

- **プロジェクト状態: SessionStart Hook で自動注入（手動: `/aidd-status` / `gh issue list`）**
- 用語集: `docs/glossary.md`（ドメイン用語はこのファイルの定義に従うこと）
- ADR: `docs/architecture/adr/`（Task 定義で指定された ADR のみ参照）
- 規約: `docs/conventions/`
- **IMPORTANT: `aidd-framework/` 配下はフレームワーク本体。`/aidd-setup fw` で上書き。プロジェクト固有の変更禁止。**
- フレームワーク本体: `aidd-framework/FRAMEWORK.md` / マイルストーン: `aidd-framework/process/milestones.md`
- トレーサビリティ: `aidd-framework/process/story-to-epic.md` / gitflow: `aidd-framework/guides/gitflow.md`
- ロール: `aidd-framework/roles/roles.md`

## 意思決定基準

**最上位原則: 全ての問題は必ず解決する。** AI は後回しを選択肢に含めない。

優先順序（詳細は [FRAMEWORK.md](aidd-framework/FRAMEWORK.md#意思決定基準)）: 1.安全性 2.正確性 3.規約準拠 4.整合性 5.技術的負債 6.品質向上

**AI は問題を発見したらその場で修正する。** 人間が後回しを判断した場合のみ、理由・リスクを明示し解消 Issue を即時作成。

### AI 自信度表明の標準

AI は成果物の中で自信度が低い箇所を透明に表明する。人間が「どこを重点的にレビューすべきか」を判断するための情報である。

| 分類 | 定義 | マーク |
|------|------|-------|
| **事実不明** | 事実関係が確認できない | `<!-- AI-UNCERTAIN: 事実不明 - [説明] -->` |
| **優劣不明** | 複数の選択肢があり、どちらが優れているか判断できない | `<!-- AI-UNCERTAIN: 優劣不明 - [説明] -->` |
| **ドメイン不足** | ドメイン知識が不足しており、正確性を保証できない | `<!-- AI-UNCERTAIN: ドメイン不足 - [説明] -->` |
| **LLM 依存** | LLM の学習知識に基づいており、最新情報と異なる可能性がある | `<!-- AI-UNCERTAIN: LLM依存 - [説明] -->` |

- 自信度が低い箇所には必ずマークを付ける。マークなしに推測で記述してはならない
- ブリーフィングでマーク付き箇所を重点的に説明する
- 人間が確認した後、マークを除去する

## タスク管理

作業の全体像は以下で管理。作業開始前に必ず確認すること。

| 管理対象 | 確認方法 |
|---------|---------|
| プロジェクト状態 | SessionStart Hook 自動注入 / `/aidd-status` |
| 進行中の作業 | `gh issue list --label "status:in-progress"` |
| 未対応タスク・Epic | `gh issue list` |
| Phase 進捗 | `gh issue list --milestone "Phase N"` |
| 仕様書・Task 定義 | `docs/requirements/` / `docs/tasks/` |

## 作業の進め方

### AI の行動原則

**ユーザーに選択肢を丸投げしない。** プロジェクトの状態を自律的に分析し、根拠とともに推奨案を提示した上で承認を得ること。

**回答 ≠ 承認。** 次のステップに進むには「OK」「進めて」「承認」等の明確な意思表示が必要。

**CRITICAL: ブリーフィングは省略禁止。** スキルが成果物を生成したら、各スキルの `references/briefing-spec.md` に定義されたブリーフィングを**必ず実行**する。ブリーフィングなしで承認を求めてはならない。

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

### Worktree による並行作業（任意）

**`task wt:create BRANCH=<branch>` を使うこと（手動 `git worktree add` 禁止）。** `/tmp/<project>-<branch>/` に作成される。

### gitflow

[gitflow ガイド](aidd-framework/guides/gitflow.md) に従う。**1 PR = Epic**。Phase=Milestone, Task=Commit。

### PR マージの手順

**Epic PR は draft+WIP で開始する**: `/aidd-new-epic` Step 1 承認時に draft PR（`[WIP]` タイトル）を自動作成。`/aidd-epic-review` PASS 後に自動で draft 解除・`[WIP]` 除去される。

**CRITICAL: 「レビュー → 承認 → 証跡検証 → マージ」の 4 ステップ必須。** `--admin` 禁止。

- ❌ レビューなし merge / ユーザー承認なし merge / 「y」をマージ承認と拡大解釈
- ✅ `/aidd-epic-review` → 結果提示 → ユーザーが「merge」明示指示 → merge

Gate ラベル（`gate:reviewed` / `gate:briefed` / `gate:approved`）全付与が前提:

1. `/aidd-epic-review` 実行 → 2. 明示的マージ指示待ち → 3. Gate 検証+`gate:approved` 付与 → **4. `git push origin HEAD`（ローカルコミットを remote に反映）** → 5. `gh pr merge --squash --delete-branch`

マージ後: lefthook `post-merge` が自動同期（手動: `git checkout main && git pull --ff-only`）。Worktree は `task wt:create/remove` で管理（`/tmp/<project>-<branch>/`）。

## スキルパイプライン

`/aidd-next` がこのパイプラインを参照して次のアクションを提案する。

### 初期化パイプライン

```
/aidd-setup → /aidd-skeleton → G0 マイルストーン確認
```

### Phase N 実装パイプライン（繰り返し）

```
/aidd-new-phase → G1
  → /aidd-new-epic → G2 + G3（AC 定義 + 詳細設計を統合）
    → /aidd-decompose-epic → G4
    → /aidd-impl（Task ごとにコミット）→ /aidd-epic-review → G5
  → /aidd-phase-review → G6
```

### 横断スキル（いつでも使用可）

| スキル | 用途 |
|--------|------|
| `/aidd-design` | 未決定の設計課題を対話でドキュメント化（Phase/Epic 前の設計探索） |
| `/aidd-status` | 進捗確認 |
| `/aidd-next` | 次のアクション提案（パイプライン進行管理） |
| `/aidd-doctor` | 環境健康診断 |
| `/aidd-discuss` | 方針決定が必要な場面 |
| `/aidd-feedback-recorder` | 仕様変更・規約追記・AI ミスパターンの記録 |
| `/aidd-adhoc` | 単発作業（bugfix/hotfix/後付けTask/雑務） |
| `/aidd-epic-review` | Epic 単位の統合レビュー（AC 検証・完了形式チェック・gate 制御） |
| `/aidd-phase-review` | Phase 完了検証（成功基準・マスタドキュメント最新化・G6 準備） |
| `/aidd-doc-drift` | git 履歴起点のドキュメント乖離検出・修正（事後一括回収） |

> 画面系ステップは画面系プロジェクトのみ。全ステップを踏む義務はなくプロジェクト特性に応じてスキップ可能。

## 実装の参考

<!-- 参照タイミング: 実装作業開始時 -->
- スキル実装例: `skills/aidd-new-phase/SKILL.md`
- レビュー手順: `skills/aidd-epic-review/references/`
- gitflow ガイド: `aidd-framework/guides/gitflow.md`

## ドキュメント連動ルール

- ADR 作成時は対応するマスタドキュメントを同一 PR 内で即時更新すること
- マスタドキュメント未更新のまま ADR だけ作成してはならない

## 禁止事項 — IMPORTANT: 絶対禁止

- **main ブランチへの直接コミット・プッシュ禁止。** 全作業はブランチで行い PR 経由でマージすること
- **ローカル動作確認なしにデプロイしてはならない。** 実行時検証は必ずローカル環境で行い PASS 後にデプロイする。詳細は `aidd-framework/guides/local-verification.md` を参照
- Task 定義の AC に含まれない機能を実装してはならない
- 新しい外部ライブラリを人間の確認なしに追加してはならない
- 既存のテストを、テストが通るように修正してはならない（テストが失敗する場合は実装を修正すること）
- ADR を作成してマスタドキュメントを更新しないまま PR を出してはならない
- 外部 URL・バージョン番号・設定値を記憶やトレーニングデータに基づいて書いてはならない。必ずドキュメントからコピーし、不明な場合は公式ソースで確認
- **Issue なしの作業開始禁止。** ブランチ作成・コード変更を開始する前に対応 Issue が必ず存在すること。Issue がない場合は先に Issue を作成してから作業を開始する
- **Issue 参照なしの PR 作成禁止。** PR description には必ず `Closes #N`（または `Related #N`）を含む Issue 参照を記載すること。参照なしの PR は作成してはならない
- **Phase/Epic パイプライン外の単発作業（バグ修正・雑務等）は `/aidd-adhoc` スキルを経由せずに直接実装・PR 作成・マージしてはならない**
- **IaC+GitOps プロジェクトでは `kubectl apply/delete/patch` 等の直接操作を提案してはならない。** k8s リソースの変更は Helm Chart / GitOps マニフェストの変更として提案すること。詳細は `aidd-framework/guides/iac-conventions.md` を参照
- FRAMEWORK.md の原則・プロセス定義を人間の確認なしに変更してはならない
- スキルの SKILL.md から frontmatter を削除してはならない
- 既存スキルの動作を変更する場合、影響を受ける他のスキルを確認すること
- **リンター・型チェッカー・静的解析の警告やエラーを suppress 指示で回避してはならない**
  - 禁止対象: `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `#[allow(...)]`, `// nolint`, `#pragma warning disable`, `@SuppressWarnings`, `# noqa`, `# type: ignore` 等
  - 根本原因を修正すること。不明な場合はユーザーに相談
  - 既存の suppress を模倣して新たに追加してはならない
  - 正当な理由がある場合は `suppress-approved: [理由]` マーカー付きでのみ許容（人間の承認必須）
