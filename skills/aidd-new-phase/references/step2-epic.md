# Step 2: Epic 構造化 — 詳細手順

承認済みストーリーを Epic にグルーピングし、Phase 定義書ドラフトを生成する。

## 入力

- Step 1 で承認された補完済みストーリー一覧
- `references/phase-definition-template.md`（Phase 定義書テンプレート）

## 手順

### 1. Epic グルーピング

[story-to-epic](../../../aidd-framework/process/story-to-epic.md) に従い、ストーリーをドメイン概念に基づいて Epic にグルーピングする。

グルーピングの判断基準:

- 同一の集約・エンティティに関わるストーリーを 1 Epic にまとめる
- 1 Epic が 1 チーム・1 スプリントで完結する粒度を目安とする
- FRAMEWORK.md の Epic 粒度基準（定量・定性）に照らす

### 2. Phase 定義書ドラフト生成

`references/phase-definition-template.md` を読み込み、以下のセクションを埋める:

| セクション | 入力源 |
|-----------|--------|
| ビジョンと背景 | ユーザーのストーリー入力の文脈、CHARTER |
| ペルソナ | ストーリーに登場するペルソナを抽出 |
| ストーリー一覧 | Step 1 の補完済みストーリー（人間入力 / AI 補完を区別） |
| 主要ワークフロー | ストーリーから主要な業務フローを As-Is / To-Be で記述 |
| ドメイン分析成果物 | テーブルの枠のみ作成（Step 3-4 で埋める） |
| サブドメイン分類 | Epic ごとにコア/支援/汎用を判定 |
| Epic 一覧（MUST/WON'T） | グルーピング結果 + MUST/WON'T 優先度付け |
| Epic 間依存関係 | Mermaid 図で依存関係を図示 |
| 成功基準 | ビジネス成果指標。計測可能・期限付き・合意済みの 3 条件必須 |
| Impact Mapping | Goal → Actor → Impact → Story → Deliverable |
| 非機能要件 | CHARTER から転記 + Phase 確定値に詳細化 |
| 外部連携概要 | 外部 API・サービスとの連携ポイント |
| アーキテクチャ影響 | ADR が必要になる可能性のある技術判断 |
| リスク・前提条件 | プロジェクトリスクと前提条件 |
| 前 Phase 引き継ぎ | 前 Phase からの残課題（初回 Phase は「なし」） |
| 技術的未定義事項 | 未決定の技術的事項 |
| Won't Have | スコープ外を明示 |

### 3. ファイル書き出し

Phase 定義書ファイル（`docs/requirements/PD-NNN-slug.md`）にドラフトを書き出す。

### 4. セルフレビュー

セルフレビュー反復ループを実施する（aidd-framework/references/self-review-loop.md 参照）。`consistency, coverage` 観点で以下をチェックする:

- ストーリー→Epic のトレーサビリティ（全ストーリーがいずれかの Epic に割り当て済み）
- 成功基準の品質（計測可能・期限付き・合意済み）
- Impact Mapping の整合性（Goal → Deliverable のチェーン成立）
- Epic の粒度（FRAMEWORK.md 基準準拠）
- Epic 間の依存関係（循環なし）

## 成果物

Phase 定義書ドラフト（`docs/requirements/PD-NNN-slug.md`）

## 完了時

`briefing-spec.md` に従ってブリーフィングを実行する。

**ブリーフィングで必ず提示する情報（成果物を見なくても判断できるレベル）:**

<!-- 括弧内は briefing-spec.md 5 要素との対応 -->

- **全ストーリーの一覧（人間入力 + AI 補完の全文。S1〜SN 形式で区別して提示する）**（要素1: 成果物全内容）
- 全 Epic の一覧表（Epic 名・対応ストーリー・所属 BC・優先度（MUST/WON'T）・1 行概要）（要素1: 成果物全内容）
- Epic 間依存関係の Mermaid 図（またはテキスト表現）（要素1: 成果物全内容）
- 成功基準の全文（計測可能・期限付き・合意済みの 3 条件充足を明示）（要素1: 成果物全内容）
- Impact Mapping の全行（Goal → Actor → Impact → Story → Deliverable）（要素1: 成果物全内容）
- サブドメイン分類（各 Epic がコア/支援/汎用のどれか、分類理由）（要素1, 2: 成果物全内容 + 判断根拠）
- 主要ワークフローの As-Is / To-Be 概要（要素1: 成果物全内容）
- Won't Have（スコープ外）の一覧（要素3: 暗黙の前提）
- Epic のグルーピング判断の根拠（なぜこの分け方か、代替案があればその比較）（要素2: 判断根拠）
- AI 自信度が低い箇所（ドメイン知識に依存する判断、成功基準の妥当性等）（要素4: 未決定事項）
- 人間に判断を求める事項（Epic の分け方、MUST/WON'T 優先度、成功基準の目標値）（要素5: 意思決定事項）

承認を得てから Step 3 に進む。
