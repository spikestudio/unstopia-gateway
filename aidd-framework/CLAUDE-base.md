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

## コアメンタルモデル

> 詳細は `aidd-framework/FRAMEWORK.md` の「コアメンタルモデル」セクションを参照。以下はクイックリファレンス。

**「AI が計画し、人間が承認し、AI が実装する」** — すべてのアクティビティにこのループが適用される。

### Phase と Epic の責務分担

| 単位 | 責務 | 内容 |
|------|------|------|
| **Phase** | 「このマイルストーンで何を作るか」 | 機能意図一覧 + Epic マッピング（薄い・30分以内） |
| **Epic** | 「その機能をどう定義するか」 | ストーリー詳細化 + AC 導出 + 設計（重い） |

### 永続的コンテキスト設計（AI-DLC: Kiro Steering Files 相当）

CLAUDE.md・AGENTS.md は AI-DLC の「Kiro Steering Files」に相当する。AI がセッションをまたいで文脈を引き継ぐための構造化された指示ファイル群。

| ファイル | 役割 |
|---------|------|
| `CLAUDE.md` | プロジェクト固有のルール・コンテキスト |
| `aidd-framework/CLAUDE-base.md`（本ファイル） | フレームワーク共通ルール |
| `docs/requirements/` | Phase/Epic の仕様（永続的コンテキスト） |
| `docs/tasks/` | Task 定義（実装の指示） |
| `docs/architecture/adr/` | 設計判断の記録 |

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

[gitflow ガイド](aidd-framework/guides/gitflow.md) に従う。**1 PR = Epic**。Phase=Milestone, Task=Commit。adhoc PR（fix/hotfix/chore）は `/aidd-adhoc` 参照。

### PR マージの手順（Epic PR 専用手順）

> **全 PR 共通ルール**: PR マージには必ず明示的な「merge」指示が必要（禁止事項セクション参照）。以下は Epic PR 固有の追加手順。

**Epic PR は draft+WIP で開始する**: `/aidd-new-epic` Step 1 承認時に draft PR（`[WIP]` タイトル）を自動作成。`/aidd-review epic` PASS 後に自動で draft 解除・`[WIP]` 除去される。

**CRITICAL: 「レビュー → 承認 → 証跡検証 → マージ」の 4 ステップ必須。** `--admin` 禁止。

- ❌ レビューなし merge / ユーザー承認なし merge / 「y」をマージ承認と拡大解釈
- ✅ `/aidd-review epic` → 結果提示 → ユーザーが「merge」明示指示 → merge

Gate ラベル（`gate:reviewed`）付与が前提:

1. `/aidd-review epic` 実行 → 2. 明示的マージ指示待ち → 3. **`git push origin HEAD`（ローカルコミットを remote に反映）** → 4. `gh pr merge --squash --delete-branch` → **5. `git checkout main && git pull --ff-only`（ローカル main を最新化）**

マージ後: lefthook `post-merge` が自動同期。**lefthook が動作しない場合は手動で `git checkout main && git pull --ff-only` を実行すること。** Worktree は `task wt:create/remove` で管理（`/tmp/<project>-<branch>/`）。

## スキルパイプライン

`/aidd-next` がこのパイプラインを参照して次のアクションを提案する。

### 初期化パイプライン

```
/aidd-setup → /aidd-skeleton → G0 マイルストーン確認
```

### Phase N 実装パイプライン（繰り返し）

| 位置付け | スキル → ゲート | フェーズ |
|---------|----------------|---------|
| **Project Init** | `setup` + `skeleton` → G0（一回限り） | — |
| **Release Planning** | `new-phase` → G1（Phase ごと） | — |
| **Inception 道具箱** | `mob`（任意）/ `inception`（任意・mock/api-spec/cli） → G1後・G2前 | 🔀 **発散** |
| **Inception G2** | `new-epic`（ストーリー+AC） → G2（Epic ごと） | 🔁 **収束** |
| **Inception G3** | `epic-design`（ドメイン設計+インターフェース設計） → G3（Epic ごと） | 🔁 **収束** |
| **Construction** | `decompose-epic` → G4 → `impl` × N（Epic ごと） | 🔁 **収束** |
| **Operations** | `review epic` → G5（Epic ごと） | 🔁 **収束** |
| **Release** | `review phase` + `phase-closing` → G6（Phase ごと・G1 の対） | — |

> **発散フェーズ（🔀）**: アイデア・ストーリー候補・制約・対立点を積極的に増やす。成果物は叩き台。任意実行。
> **収束フェーズ（🔁）**: 発散成果物を精緻化・意思決定し実装可能な AC に収束させる。成果物は確定。

### 横断スキル（いつでも使用可）

| スキル | 用途 |
|--------|------|
| `aidd-architect`（サブエージェント） | ADR 作成 / 設計判断のトレードオフ分析 / Epic・Phase をまたぐ設計整合性チェック（設計判断が必要な場面で呼び出す） |
| `/aidd-mob` | G1後・G2前: 複数ペルソナで Mob Elaboration を擬似実行し高品質なストーリードラフトを生成（任意） |
| `/aidd-inception` | G1後・G2前: プロジェクト特性に応じたサブスキルを選択し具体的成果物を対話的に生成（任意・親スキル） |
| `/aidd-inception-mock` | G1後・G2前: 機能意図から画面モック + ストーリードラフトを生成（UI 系・任意） |
| `/aidd-inception-api-spec` | G1後・G2前: 機能意図から API 仕様 + ストーリードラフトを生成（API 系・任意） |
| `/aidd-inception-cli` | G1後・G2前: 機能意図から CLI コマンド仕様 + ストーリードラフトを生成（CLI 系・任意） |
| `/aidd-new-epic` | ストーリー詳細化 + AC 導出（G2 専用） |
| `/aidd-epic-design` | ドメイン設計+インターフェース設計（G3 専用）。`/aidd-new-epic` 完了後に実行 |
| `/aidd-design` | 未決定の設計課題を対話でドキュメント化（Phase/Epic 前の設計探索） |
| `/aidd-status` | 進捗確認 |
| `/aidd-next` | 次のアクション提案（パイプライン進行管理） |
| `/aidd-doctor` | 環境健康診断 |
| `/aidd-discuss` | 方針決定が必要な場面 |
| `/aidd-feedback-recorder` | 仕様変更・規約追記・AI ミスパターンの記録 |
| `/aidd-adhoc` | 単発作業（bugfix/hotfix/後付けTask/雑務） |
| `/aidd-review` | レビュー統合スキル（5種別: epic-spec/task-spec/code/epic/phase）。コンテキスト自動検出。旧 impl-review/epic-review/phase-review の後継 |
| `/aidd-phase-closing` | `/aidd-review phase` PASS 後に実行。G6 通過記録・Milestone クローズ・レトロスペクティブ |
| `/aidd-doc-drift` | git 履歴起点のドキュメント乖離検出・修正（事後一括回収） |
| `/aidd-update-playbook` | FW 変更・Issue 起点のプレイブック差分更新（影響セクション検出→再執筆→リンク検証） |
| `/aidd-adr` | ADR の対話的作成・採番・保存・既存 ADR との矛盾チェック（設計判断が必要な場面） |
| `/aidd-screen-plan` | AC・ドメインモデルから画面を洗い出し・種別分類し、画面一覧を生成（画面系 Epic G3 Section 2） |
| `/aidd-screen-spec` | 画面仕様書・遷移図を生成（画面系 Epic G3 Section 2） |
| `/aidd-screen-ui` | UIKit コンポーネント選定・アノテーション・G3 Section 2 ゲート（画面系 Epic G3 Section 2） |
| `/aidd-screen-catalog` | Phase 横断の全画面カタログを生成（Phase 末尾・/aidd-review phase 前） |

> 画面系ステップは画面系プロジェクトのみ。全ステップを踏む義務はなくプロジェクト特性に応じてスキップ可能。

## 実装の参考

<!-- 参照タイミング: 実装作業開始時 -->
- スキル実装例: `skills/aidd-new-phase/SKILL.md`
- レビュー手順: `skills/aidd-review/references/`
- gitflow ガイド: `aidd-framework/guides/gitflow.md`
- 自然文管理ガイド: `aidd-framework/guides/text-management.md`

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
- **全ての PR マージ（`gh pr merge`）は明示的な「merge」指示が必要。** CI PASS・gate ラベル付与・前の文脈への回答・作業方針への承認はマージ指示と解釈してはならない。Auto mode が有効であっても例外なし
- **新規ブランチ・ワークツリーの作成前にユーザー確認必須。** `git checkout -b` / `git switch -c` / `task wt:create` を実行する前に、ブランチ名・起点・理由を提示してユーザーの明示的な承認を得ること。承認なしに新規ブランチを作成してはならない（#907）
- **Epic 作業中の修正は同一 Epic PR で処理する。** `status:in-progress` の Epic が存在する場合、そのスコープ内で解決できる修正（実装ミス・軽微な調整・設計変更）は新規ブランチを立てず現在の Epic ブランチにコミットを追加する。Epic と無関係な独立した修正のみ `/aidd-adhoc` 経由で別ブランチを作成する（#906）
- **IaC+GitOps プロジェクトでは `kubectl apply/delete/patch` 等の直接操作を提案してはならない。** k8s リソースの変更は Helm Chart / GitOps マニフェストの変更として提案すること。詳細は `aidd-framework/guides/iac-conventions.md` を参照
- **プロジェクトのフェーズ・規模・成熟度（PoC・MVP・プロトタイプ・β版）を品質基準・規約遵守の免除理由にしてはならない。**「PoC スケールでは許容範囲」「MVP だから不要」「まだプロトタイプだから」「今は小規模だから問題ない」は免除理由にならない
- FRAMEWORK.md の原則・プロセス定義を人間の確認なしに変更してはならない
- スキルの SKILL.md から frontmatter を削除してはならない
- スキルに `context: fork` を追加してはならない。原則インライン実行。完全自己完結の単発タスクのみ例外（#1140）。詳細は `aidd-framework/guides/skill-guide.md` を参照
- 既存スキルの動作を変更する場合、影響を受ける他のスキルを確認すること
- **`Agent()` の二重ネストを使用してはならない（#1140）。** インラインスキル（depth 0）から `Agent()`（depth 1）を起動するのは適切。しかし depth 1 の Agent 内でさらに `Agent()` を起動する二重ネストは禁止。詳細は `aidd-framework/guides/skill-guide.md` を参照
- **スキルの出力を要約・言い換えしてはならない（#1100）。** スキルが生成した確認メッセージ・ブリーフィング・承認要求をそのままユーザーに提示すること。「〇〇が提示されています。よいですか？」のような要約・言い換えは禁止。原文を忠実にリレーすること
- **環境変数・設定値・必須ツールが不足・不正な場合はフォールバックや回避策を試みず即座にエラーで停止すること（fail fast）。** 「デフォルト値で続行」「別のエンドポイントを試す」「代替コマンドで回避」は禁止。エラーメッセージには問題の内容と解決手順を明示する
  - ❌ 環境変数 FOO が未設定 → デフォルト値で続行
  - ❌ 接続失敗 → リトライまたは別のエンドポイントを試す
  - ❌ 設定ファイル不在 → 空の設定で初期化して続行
  - ✅ 環境変数 FOO が未設定 → 「FOO is required but not set」でエラー停止
  - ✅ 接続失敗 → エラー内容と設定確認手順を提示して停止
- **リンター・型チェッカー・静的解析の警告やエラーを suppress 指示で回避してはならない**
  - 禁止対象: `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `#[allow(...)]`, `// nolint`, `#pragma warning disable`, `@SuppressWarnings`, `# noqa`, `# type: ignore` 等
  - 根本原因を修正すること。不明な場合はユーザーに相談
  - 既存の suppress を模倣して新たに追加してはならない
  - 正当な理由がある場合は `suppress-approved: [理由]` マーカー付きでのみ許容（人間の承認必須）
