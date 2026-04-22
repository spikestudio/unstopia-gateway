# Git 運用ルール — プロセスと git 操作の一体化

## 1. 原則

**「1 PR = 検証可能な機能単位（Epic）」** — main には常に検証済みの機能のみが入る。ステータスは GitHub Issue（`status:in-progress` ラベル + open/closed）で管理し、ファイル更新は不要。

<!-- レビュー指摘: Phase/Epic/Task の GitHub 管理単位が sub-issue 階層と一致していなかった -->
### 管理単位の対応

| プロジェクト概念 | GitHub 管理単位 | 粒度 |
|---------------|---------------|------|
| **Phase** | **Phase Issue + Milestone** | ビジネス成果の単位 |
| **Epic** | **Epic Issue + PR** | 検証可能な機能の単位 |
| **Task** | **Task Issue（sub-issue）+ Commit** | 実装作業の単位 |

---

## 2. ブランチ戦略

GitHub Flow を採用する。

- `main` — 常にデプロイ可能な状態を維持する
- 作業ブランチ — main から分岐し、PR 経由でマージする

### ブランチ命名規則

| 種別 | パターン | 例 |
|------|---------|-----|
| 設計成果物 | `docs/PD-NNN-slug` | `docs/PD-001-mvp` |
| 機能開発 | `feature/ES-NNN-slug` | `feature/ES-001-user-auth` |
| バグ修正 | `fix/ISSUE-NNN-slug` | `fix/ISSUE-012-login-error` |
| 緊急修正 | `hotfix/ISSUE-NNN-slug` | `hotfix/ISSUE-045-crash` |
| 雑務 | `chore/slug` | `chore/update-deps` |

### ブランチのライフサイクル

1. **作成**: 各スキルの開始時に main から分岐
2. **作業**: 成果物の生成・実装をコミット
3. **PR 作成**: マイルストーン通過条件を満たした後
4. **マージ**: 人間承認後に squash merge
5. **削除**: マージ後に自動削除（`--delete-branch`）

---

## 3. コミットメッセージ規約

[Conventional Commits](https://www.conventionalcommits.org/) に従う。

| type | 用途 |
|------|------|
| `feat` | 新機能の追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみの変更 |
| `refactor` | リファクタリング（機能変更なし） |
| `test` | テストの追加・修正 |
| `chore` | ビルド・CI・依存関係などの雑務 |

Phase 定義書の PR では `docs:` prefix を使用する。Epic ブランチ上の設計コミットにも `docs:` prefix を使用する。

---

## 4. マージ方式

Squash merge を採用する。1 PR（= 1 Epic）= 1 コミットで履歴を簡潔に保つ。Task レベルのコミット履歴は PR ページで参照可能。

---

## 5. 基本ルール

- main への直接 push を禁止する
- PR を経由してマージする
- CI が通らない PR はマージしない
- `gh pr checks <番号> --watch` で CI 完了を待つ
- 全チェック通過後に `gh pr merge <番号> --squash --delete-branch` でマージ
- `--admin` フラグで CI をスキップしてはならない

---

## 6. フェーズ別 git 操作タイミング

### Phase 定義（G1）

| タイミング | git 操作 | 担当スキル |
|-----------|---------|-----------|
| `/aidd-new-phase` 開始時 | `docs/PD-NNN-slug` ブランチを作成 | `/aidd-new-phase` |
| Phase 定義書の生成・レビュー完了後 | 成果物をコミット | `/aidd-new-phase` |
| G1 マイルストーン通過・人間承認後 | PR を作成しマージ | `/aidd-next` |

**PR スコープ**: Phase 定義書

### Epic（G2〜G5）

Epic のライフサイクル全体を 1 つのブランチ・1 つの PR で管理する。`/aidd-new-epic` でブランチを作成し、設計成果物（G2〜G4）と実装（G5）を同一ブランチに積み上げる。

| タイミング | git 操作 | 担当スキル |
|-----------|---------|-----------|
| `/aidd-new-epic` 開始時 | `feature/ES-NNN-slug` ブランチ + ワークツリーを作成 | `/aidd-new-epic` |
| G2〜G4 各スキル実行時 | 設計成果物をコミット（`docs:` prefix） | `/aidd-new-epic`, `/aidd-decompose-epic` |
| 各 Task 実装完了時 | 実装コード + テストをコミット（`feat:` prefix） | `/aidd-impl` |
| `/aidd-new-epic` Step 1 承認後 | draft PR を作成（`[WIP]` タイトル）。PR body には `Epic: #<Epic Issue番号>` を含める | `/aidd-new-epic` |
| `/aidd-epic-review` PASS 後 | draft 解除 + `[WIP]` 除去 → マージ準備完了 | `/aidd-epic-review` |
| `/aidd-epic-review` PASS + 人間承認後 | PR をマージ | `/aidd-next` |

**PR スコープ**: Epic 仕様書 + 設計成果物 + Task 定義群 + 実装コード + テスト

**PR body 契約:**

- 先頭に `Epic: #<Epic Issue番号>` を記載し、対象 Epic を明示する
- Task Issue ごとに `Closes #<Task Issue番号>` を記載する
- `Closes #<Epic Issue番号>` を記載してはならない

**ブランチ・ワークツリーの運用ルール（必須）:**

- **main ブランチへの直接コミット・プッシュ禁止。** 全作業はブランチで行い PR 経由でマージする。
- **Epic フロー中はブランチを切り替えない。** `/aidd-new-epic` 〜 `/aidd-epic-review` まで一貫して `feature/ES-NNN-slug` ブランチ（ワークツリー）上で作業する。main や他ブランチへの切り替えは禁止
- **ワークツリーは `/aidd-new-epic` で作成し、PR マージまで維持する。** `task wt:create BRANCH=feature/ES-NNN-slug` で `/tmp/<project>-feature/ES-NNN-slug/` に作成される
  - 中断後の再開は `git worktree list` でパスを確認し、該当ワークツリーで作業を継続する。同じ Epic のワークツリーを削除して作り直してはならない
  - PR マージ後は速やかに `task wt:remove BRANCH=feature/ES-NNN-slug` でワークツリーとブランチを削除する
- **中間 PR を作成しない。** G2/G3/G4 のマイルストーン通過記録は GitHub Issue コメントのみで行う。Epic 開始時（G2）に draft PR を 1 本作成し、完了時（G5）に ready に変換する
- **自動コミット。** 各スキルは成果物生成・実装完了・指摘反映・ステップ承認のたびに自動でコミットする。push はユーザーの確認を待つ。draft PR は Step 1 承認後に自動作成する。
- **PR 作成前に必ず `git rebase origin/main` を実行する。** main の最新を取り込んでからプッシュ・PR 作成する。
- main が先に進んだ場合は `git rebase origin/main` で同期する
- **squash merge 後は feature ブランチを再利用しない。** squash merge 済みのブランチに追加コミットを積むと git 履歴の不一致（元コミットが圧縮されているため「未知のコミット」と判断される）により rebase/cherry-pick コンフリクトが雪だるま式に増える。追加修正が必要な場合は main から新しいブランチを切ること。
- **並行 Epic はそれぞれ独立したワークツリーで作業する。** 同一ファイルを複数 Epic が変更する場合は、先にマージした側を後発 Epic が `git rebase origin/main` で取り込む。

### 単発作業（`/aidd-adhoc`）

Phase/Epic パイプラインに属さない単発作業を `/aidd-adhoc` で処理する。種別に応じてブランチ命名とプロセスの重さが異なる。**1 PR = 単発作業 1 件**。

#### 管理単位の対応

| 作業種別 | GitHub 管理単位 | ブランチ | 粒度 |
|---------|---------------|---------|------|
| fix（開発中バグ） | Issue + PR | `fix/ISSUE-NNN-slug` | バグ修正 1 件 |
| hotfix（緊急修正） | Issue + PR | `hotfix/ISSUE-NNN-slug` | 緊急修正 1 件 |
| task（後付け Task） | Issue + Commit（既存 Epic PR 内） | Epic ブランチ上 | 既存 Epic への追加 |
| chore（雑務） | PR（Issue 省略可） | `chore/slug` | 雑務 1 件 |

> **task 種別の注意:** task 種別は既存 Epic への後付け Task 追加。Epic ブランチ上のコミットとして管理される（独立 PR ではない）。Epic に属さない作業は chore を使用する。

#### 種別ごとのプロセスフロー

| 種別 | フロー | ゲート | 成果物 |
|------|--------|--------|--------|
| **fix** | Issue 作成 → Task 定義 → 実装 → セルフレビュー → コミット → PR | セルフレビュー + PR レビュー | Issue, Task 定義, コード, テスト |
| **hotfix** | Issue 作成 → 調査 → 修正 → PR 作成 | PR レビュー（最短パス） | Issue, コード, テスト |
| **task** | 親 Epic 選択 → Task 定義 → 実装 → コミット | セルフレビュー | Task 定義, コード |
| **chore** | 実装 → コミット → PR | PR レビュー（軽量） | コード |

#### git 操作タイミング

| タイミング | git 操作 | 担当スキル |
|-----------|---------|-----------|
| `/aidd-adhoc` 開始時 | 種別に応じたブランチを作成（task 種別は既存 Epic ブランチに切替） | `/aidd-adhoc` |
| 実装完了時 | コミット | `/aidd-adhoc` |
| PR 作成（fix / hotfix / chore） | `gh pr create`（`Closes #(Issue番号)` 付き） | `/aidd-adhoc` |
| PR レビュー・マージ | squash merge + ブランチ削除 | 人間承認後 |

### Epic/Phase 完了（G6）

`/aidd-phase-review` で Phase 完了を検証する。Epic 単位の成果物は `/aidd-epic-review` で検証済みのため、Phase レベルでは成功基準の達成状況とマスタドキュメントの最新化を確認する。

---

## 7. ステータス管理ルール

プロジェクトのステータスは GitHub Issue で管理する（ファイルベースの PROJECT-STATUS.md は廃止）。

### ステータスの記録方法

| ステータス変更 | 方法 | 担当 |
|-------------|------|------|
| Task 作業開始 | `gh issue edit <番号> --add-label "status:in-progress"` | AI（`/aidd-impl` 開始時） |
| Task 作業完了 | Epic PR の `Closes #N` で自動 close（Task Issue のみ） | GitHub ネイティブ機能 |
| マイルストーン通過記録 | Issue コメント（`✅ G{N} 通過 (日付)`） | `/aidd-next` |
| Epic 完了 | Epic Issue close + Phase Issue / Milestone 進捗更新 | `/aidd-next` |
| Phase 完了 | Phase Issue close + Milestone close | `/aidd-next` |
| Gate 通過記録 | PR ラベル（`gate:reviewed` / `gate:briefed` / `gate:approved`）+ PR 証跡コメント | AI（各スキル） |

### Merge Guard（Gate ラベルによるマージ制御）

PR のマージには以下の 3 つの Gate ラベルが全て必要。GitHub Actions の `Merge Gate Check` が Branch Protection の必須チェックとして強制する。

| Gate ラベル | 付与タイミング | 付与スキル |
|-----------|-------------|-----------|
| `gate:reviewed` | `/aidd-epic-review` PASS 時 | `/aidd-epic-review` |
| `gate:briefed` | ブリーフィング完了時 | `/aidd-epic-review` |
| `gate:approved` | 人間が「merge」と明示的に指示した時 | マージ手順（CLAUDE.md） |

**コード変更時のリセット:** PR に新しいコミットが push されると、`synchronize` イベントで全 gate ラベルが自動除去される。レビュー・ブリーフィング・承認を再実施する必要がある。

**ドキュメント PR（G1）:** Phase 定義書の PR はマイルストーン通過後に作成するため、プロセスは完了済み。`/aidd-next` が PR 作成直後に全 gate ラベルを一括付与する。

### プロジェクト状態の取得方法

| 方法 | タイミング |
|------|----------|
| SessionStart Hook | 会話開始時に自動注入 |
| `/aidd-status` | 人間が明示的に確認したいとき |
| `gh issue list` | 個別の Issue を確認したいとき |
