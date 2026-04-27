---
name: aidd-decompose-epic
description: >
  Epic仕様書の承認済みACと設計成果物を入力として、実装単位（コミット単位）のTaskに分解する。
  3フェーズ並行サブエージェント構成でTask定義を生成する。
  分解ドラフト生成→ブリーフィング→承認→ファイル・Issue一括生成の2ステップで段階的に進行する。
  TaskへのAC分解・Task定義の作成を行いたい場合は常にこのスキルを呼び出す。
type: skill
context: fork
argument-hint: "<Epic ID>"
---

# /aidd-decompose-epic — Task 定義（AC → Task 分解）

Epic 仕様書の承認済み AC と設計成果物を入力として、AI が AC を実装単位（コミット単位）の Task に分解する。各 Task は Epic ブランチ上のコミットになる。分解ドラフト生成→承認→ファイル・Issue 一括生成の流れで進行する。

## インターフェース

### 前提条件

| 前提 | 確認方法 | 未完了時の案内 |
|------|---------|-------------|
| Epic 仕様書が承認済み（設計成果物含む） | Epic Issue が `status:in-progress` ラベル付きでオープン（`gh issue list --label "status:in-progress" --label epic`）かつ G2 通過コメントが存在する | `/aidd-new-epic` を先に実行 |
| G3 通過済み（`/aidd-epic-design` 完了済み） | Epic Issue のコメントに G3 通過記録が存在すること（`gh issue view <Epic番号> --comments` で `gate:g3` または G3 通過コメントを確認） | `/aidd-epic-design` を先に実行 |
| 横断設計事項が確定済み | Phase 定義書・ADR の確認 | 認証・認可方針、エラーコード体系、セキュリティ方針、DB マイグレーション戦略が Phase/ADR で確定されているか確認 |

### 入力

| 項目 | 形式 | 必須 | 説明 |
|------|------|------|------|
| Epic ID | 引数 | 任意 | `ES-NNN` 形式。指定なしなら自動推定 |

**引数なし時の自動推定:**

1. `gh issue list --label "status:in-progress" --label epic` でオープンかつ G2 通過コメント済みの Epic があるか確認
2. **ある場合** → 「ES-NNN を Task に分解しますか？」と提案
3. **ない場合** → オープンな Epic Issue を確認し、対象 Epic の選択を提案
4. **Epic が見つからない場合**:

```
Task を作成する対象の Epic が見つかりませんでした。以下を確認してください:
- `/aidd-decompose-epic ES-NNN` — 分解対象の Epic を指定
- Epic が未作成の場合は `/aidd-new-epic` を先に実行してください
```

### capability 呼び出し

該当なし

### 出力

| 項目 | 形式 | 説明 |
|------|------|------|
| Task 定義 | ファイル | `docs/tasks/TASK-NNN-slug.md`（複数ファイル） |
| 要検討マーク解決済み Task 定義群 | ファイル | Phase 1〜2 の並行サブエージェントが設計判断クラスを調査・解決済みの Task 定義ファイル群 |
| GitHub Issue | GitHub | task ラベル、親 Epic Issue の sub-issue、Milestone 紐付け |

### 後続スキル

| スキル | 条件 |
|--------|------|
| `/aidd-next` | G4 マイルストーン判定 |
| `/aidd-impl` | G4 通過後、実装を開始 |

## Step 0: 入力受付

`$ARGUMENTS` から Epic ID を取得する。指定がなければ自動推定し、推定結果をユーザーに確認してから進行する。

1. 対象 Epic の特定（引数 or 自動推定）
2. 以下を読み込む:
   - Epic 仕様書（全ストーリー、全 AC）
   - 設計成果物（ドメインモデル、スキーマ、API spec 等）
   - 関連 ADR
   - 規約ドキュメント群
   - 既存の Task 定義（あれば）
3. Epic 仕様書に外部依存コンポーネントが記載されている場合、アクセス確認が完了しているか確認する。未確認の場合はユーザーに警告する

## Step 1: Task 分解

> **前提: Step 0 が完了していること。**

`references/step1-decompose.md` を読み込んで実行する。

**概要:** 以下の 3 フェーズ構成で Task 定義を生成する。

- **Phase 0（メインエージェント）:** AC → Task リスト（番号・名前・対応AC・依存関係）を生成する。Task ファイルは書かない。
- **Phase 1（並行サブエージェント）:** Task ごとにサブエージェントを並行起動し、Task 定義ファイルを書き込む。設計判断クラスに該当する委ねられた詳細に `<!-- 要検討 -->` マークを付与する。
- **Phase 2（マークあり Task のみ並行）:** マークが存在する Task のみサブエージェントを並行起動し、`/aidd-research` でリサーチして選択肢+根拠+トレードオフをマーク位置に書き込む。
- **Phase 3（メインエージェント）:** 全 Task を集約し、設計判断一覧をユーザーに提示して確認を得てから G4 ブリーフィングを実行する。

フェーズ構成の詳細手順は `references/step1-decompose.md` に定義されている。

**成果物:** 要検討マーク解決済み Task 定義群（テーブル形式 + 各 Task の詳細 + 設計判断一覧）

**capability 呼び出し:**

- セルフレビュー反復ループ — `ac, consistency` 観点（aidd-framework/references/self-review-loop.md 参照）

**完了時:** `references/briefing-spec.md` に従ってブリーフィングを実行し、承認を得る。

## Step 2: ファイル生成・Issue 作成

> **前提: Step 1 の承認が完了していること。**

`references/task-template.md` を読み込んで実行する。

**概要:** 承認済み Task 一覧から `docs/tasks/` ファイルと GitHub Issue を一括生成する。

**手順:**

1. `docs/tasks/TASK-*.md` をスキャンし次の番号を決定
2. 各 Task について:
   - `references/task-template.md` に従い `docs/tasks/TASK-NNN-slug.md` を作成
   - ドラフト内容を書き込み
   - GitHub Issue を作成（task ラベル、Milestone 紐付け、親 Epic Issue への参照）
   - ドキュメントの Issue フィールドに番号を記入
   - `references/link-task-to-epic.sh <Epic Issue番号> <Task Issue番号>` を実行して Task を Epic の Sub-issue に登録する
3. 全 Task のファイルと Issue が生成されたことを確認

## 完了処理

```
Task 分解が完成しました:
- Epic: ES-NNN [Epic名]
- Task 数: N 件（うち E2E 検証 Task: 1 件）
- ドキュメント: docs/tasks/TASK-NNN〜NNN.md
- GitHub Issues: #XX〜#YY (task ラベル, Epic: #ZZ)

次のステップ:
→ `/aidd-next` でマイルストーン判定（G4）
→ G4 通過後: `/aidd-impl TASK-NNN` で最初の Task（[Task1名]）を実装
→ 他の Epic の Task 分解が残っている場合: `/aidd-decompose-epic ES-NNN` で分解してから実装へ
```

> **注記**: Task 定義ファイルと GitHub Issue を生成したら、Epic ブランチ（`feature/ES-NNN-slug`）にコミットする。**PR は `/aidd-new-epic` Step 1 承認時に draft として作成済み。** ここでは PR 作成・変更は行わない。詳細は [gitflow ガイド](../../aidd-framework/guides/gitflow.md) を参照。

## 不変条件

以下の条件は例外なく守られなければならない:

- **G3 未通過（`/aidd-epic-design` 完了前）では実行不可。** Epic Issue に G3 通過記録がない場合、スキルを停止し `/aidd-epic-design` の先行実行を案内する。
- **Phase 3 時点で未解決 `<!-- 要検討 -->` が残存する場合、G4 ブリーフィング FAIL。** 未解決マークが残っている Task が 1 件でも存在する場合は Phase 2 の再実行を指示してブリーフィングを停止する。

## ゲート制御ルール

**各ステップ間の承認ゲートは構造的に必須である。以下のルールに例外はない。**

1. **Step 1 の承認なしに Step 2 を開始してはならない。** 承認なしに次ステップを進めようとした場合、「Step 1 の承認が必要です」と表示しスキルを停止する。
2. **ブリーフィングなしに承認を求めてはならない。** Step 1 完了時に `references/briefing-spec.md` に従ったブリーフィングを必ず実行する。1-2 行のサマリーのみでの承認要求は禁止。
3. **回答 ≠ 承認。** ユーザーの問いかけへの回答は回答内容の反映のみに留める。次ステップへの遷移には「OK」「進めて」「承認」等の明確な承認表現が必要。
4. **Step 2（ファイル生成・Issue 作成）はブリーフィング→承認を経てからのみ実行可能。** Task 分解ドラフト生成後、ブリーフィング→承認を経ずに GitHub Issue 作成やファイル生成を開始してはならない。承認なしに進もうとした場合、「承認が必要です」と表示しスキルを停止する。

## 重要なルール

- 日本語で対話する
- **FRAMEWORK.md の意思決定基準に従う** — 優先順序 1〜5 に該当する問題の見送り・後回しを推奨しない
- **ブリーフィング省略禁止** — Step 1 完了時に `references/briefing-spec.md` に従ったブリーフィングを必ず実行する
- ドラフトはあくまで叩き台。ユーザーの承認なしに確定しない
- E2E 検証 Task を必ず末尾に配置する。ユーザーが明示的に不要と判断した場合のみ省略可
- AC→Task の全カバレッジ（100%）を達成するまで完了としない
- 成果物生成・実装完了時にコミットを自動実行する。ユーザーの指摘反映後・ステップ承認後などの状態遷移ごとにもコミットする。push と PR 作成はユーザーの確認を待つ
- 各ステップの詳細手順は `references/` を読んで実行する。SKILL.md 内に手順を複製しない
