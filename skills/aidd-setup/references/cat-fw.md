# カテゴリ: fw（フレームワーク導入・更新）

プラグインディレクトリのフレームワークファイルをプロジェクトに配置する。初回インストールも更新も同じ手順で動作する（冪等）。

## 前提条件

- AI コーディングエージェントのプラグイン/スキルとしてインストールされていること

## 手順

### 1. プラットフォーム選択

既存ファイルからデフォルトを推定する:

- `CLAUDE.md` のみ存在 → デフォルト: Claude Code
- `AGENTS.md` のみ存在 → デフォルト: Codex
- 両方存在 → デフォルト: 両方
- どちらも存在しない → デフォルト: 両方（確認なしで自動選択）

| プラットフォーム | 指示ファイル | スキル配置先 | ワークツリーパス |
|---|---|---|---|
| Claude Code | `CLAUDE.md` | プラグインとして自動読み込み | `/tmp/<project>-<branch>/`（`task wt:create`） |
| Codex | `AGENTS.md` | `.agents/skills/` にコピー | 通常のブランチ運用 |
| 両方 | `CLAUDE.md` + `AGENTS.md` 両方生成 | 両方に配置 | — |

### 2. フレームワークコピー

**旧ディレクトリのマイグレーション（既導入プロジェクト向け）:**

`docs/aidd-fw/` が存在する場合、`aidd-framework/` に移動する:

```bash
if [ -d "docs/aidd-fw" ]; then
  echo "⚠️ 旧ディレクトリ docs/aidd-fw/ を検出 → aidd-framework/ にマイグレートします"
  mv docs/aidd-fw/ aidd-framework/
fi
```

`aidd-framework/` を**全削除してから全コピー**する。ファイルの増減・内容変更の両方に追従するために、部分上書きではなく全置き換えを行う:

```bash
# PLUGIN_DIR: プラグインのインストールディレクトリ
# Claude Code Marketplace の場合: ~/.claude/plugins/marketplaces/aidd-fw/
PLUGIN_DIR="${HOME}/.claude/plugins/marketplaces/aidd-fw"

# 全削除（プロジェクト固有の変更は許可されないため安全）
rm -rf aidd-framework/

# 全コピー
cp -r "${PLUGIN_DIR}/aidd-framework/" aidd-framework/
```

> **プラグインエージェントの自動ロード:** Claude Code はインストール済みプラグインの `agents/` ディレクトリ（優先度 5）を自動認識する。`.claude/agents/` へのコピーは不要。プロジェクト独自のエージェントを追加したい場合は `.claude/agents/` に配置する。

### 3. ステータス・Gate ラベル作成

以下のラベルを作成する。既にラベルが存在する場合は `--force` で上書き:

```bash
gh label create "status:in-progress" --color 0E8A16 --description "作業進行中" --force
gh label create "gate:reviewed" --color 1D76DB --description "AI PR review passed" --force
```

### 4. Merge Guard ワークフロー配置

スキルの references から `.github/workflows/merge-guard.yml` を配置する（既存ファイルは上書き）:

| コピー元 | コピー先 |
|---------|---------|
| `${PLUGIN_DIR}/skills/aidd-setup/references/merge-guard.yml` | `.github/workflows/merge-guard.yml` |

### 5. 旧 PROJECT-STATUS.md の削除案内

`docs/PROJECT-STATUS.md` が存在する場合、ステータス管理は GitHub Issue ベースに移行済みであることを案内し、削除を提案する。

### 6. GitHub Issue テンプレート移植

- コピー元: `${PLUGIN_DIR}/skills/aidd-setup/references/github/ISSUE_TEMPLATE/`
- コピー先: `.github/ISSUE_TEMPLATE/`

### 7. AI エージェント指示ファイル更新

プラットフォーム検出結果に基づき指示ファイルを更新する。

#### CLAUDE.md の更新（Claude Code）

**ファイルが存在しない場合（新規）:**

```
${PLUGIN_DIR}/skills/aidd-setup/references/claude-md.md → CLAUDE.md としてコピー
${PLUGIN_DIR}/aidd-framework/CLAUDE-base.md → aidd-framework/CLAUDE-base.md としてコピー
```

**@import 導入済みの場合（`<!-- aidd-fw:import-start -->` 行が存在する）:**

`aidd-framework/CLAUDE-base.md` のみを最新版で全置き換えする。`CLAUDE.md` は編集しない。

```
${PLUGIN_DIR}/aidd-framework/CLAUDE-base.md → aidd-framework/CLAUDE-base.md（全置き換え）
```

**@import 未導入の場合（ファイルは存在するが `<!-- aidd-fw:import-start -->` 行がない）:**

テンプレート管理セクションを除去・再構成して `@import` 参照行を追加する。

**フレームワーク管理セクション識別仕様（E5 移行スクリプト参照用）:**

| 種別 | セクション名（`##` 先頭語句でマッチ） |
|------|--------------------------------------|
| **テンプレート管理（除去対象）** | 参照すべきドキュメント / 意思決定基準 / タスク管理 / 作業の進め方 / スキルパイプライン / 実装の参考 / ドキュメント連動ルール / 禁止事項 |
| **プロジェクト固有（保護対象）** | 上記以外のすべてのセクション（例: プロジェクト概要 / 規約 / プロジェクト固有の発見事項 / ビルド・テストコマンド 等） |

移行手順:

1. テンプレート管理セクション（8 件）を除去する（見出し行〜次の `##` 直前まで削除）
2. プロジェクト固有セクションはそのまま保持する
3. ファイル先頭（`# CLAUDE.md` の次行）に以下を挿入する:

```markdown
<!-- aidd-fw:import-start -->
@aidd-framework/CLAUDE-base.md
<!-- aidd-fw:import-end -->
```

1. `aidd-framework/CLAUDE-base.md` を最新版でコピーする
1. 変更差分をユーザーに提示して確認を得る（プロジェクト固有セクションが保護されていることを確認）

#### AGENTS.md の更新（Codex / GitHub Copilot）

**ファイルが存在しない場合（新規）:**

```
${PLUGIN_DIR}/skills/aidd-setup/references/agents-md.md → AGENTS.md としてコピー
```

**`<!-- aidd-fw:managed-start -->` マーカーが存在する場合（導入済み）:**

`managed-start` / `managed-end` 間のコンテンツを最新版（`${PLUGIN_DIR}/skills/aidd-setup/references/agents-md.md` の managed 範囲）で全置き換えする。

```
agents-md.md の managed 範囲 → AGENTS.md の managed-start/end 間（全置き換え）
```

**マーカーが存在しない場合（旧形式または未知構造）:**

自動処理は行わず、ユーザーに手動確認を求める:

```
AGENTS.md に <!-- aidd-fw:managed-start --> マーカーがありません。
手動で以下を確認してください:
1. AGENTS.md の fw 管理セクションが最新テンプレートと一致しているか確認する
2. 必要であれば手動で更新してください
```

**Codex の場合の追加手順:** プラグインディレクトリの `skills/` 配下の各スキルを `.agents/skills/` にコピーする。

### AI エージェント指示ファイルの設計方針

CLAUDE.md と AGENTS.md は以下の役割分担で設計されている。

| 内容 | CLAUDE.md | AGENTS.md |
|------|-----------|-----------|
| fw 管理ルール（タスク管理・作業手順・禁止事項等） | ✅ `@aidd-framework/CLAUDE-base.md` を @import | ✅ `<!-- aidd-fw:managed-start/end -->` 範囲内 |
| Claude Code 固有（スキル・フック・プラグイン参照） | ✅ プロジェクト固有セクション | ❌ 不要 |
| プロジェクト固有規約・発見事項 | ✅ プロジェクト固有セクション | ✅ プロジェクト固有セクション |

**省略対象:** UI/デザイン系の詳細ルール、非対話ツール向けの設定詳細は CLAUDE.md / AGENTS.md に含めない（Skills または `.claude/rules/` に配置する）。

### 8. .claude/settings.json 配置

Claude Code のデフォルト許可設定をプリセットする。

**ファイルが存在しない場合（新規）:**

```bash
mkdir -p .claude
cp "${PLUGIN_DIR}/skills/aidd-setup/references/claude-settings.json" .claude/settings.json
```

**ファイルが既に存在する場合:**

既存ファイルを上書きせず、`permissions.allow` に不足しているエントリのみ追記することを提案する:

1. 既存の `.claude/settings.json` を読み込む
2. テンプレートの `permissions.allow` と比較し、不足エントリを検出する
3. 不足エントリをユーザーに提示し、追記するか確認を取る

> **テンプレート内容:** `Bash(git *)` / `Bash(gh *)` / `Bash(task *)` / `Bash(mise *)` / `Bash(lefthook *)` を事前許可。`defaultMode: "acceptEdits"`（ファイル編集は自動承認、その他は上記許可リストのみ自動実行）。

### 9. text-master.json 配置

スターターテンプレートをプロジェクトの `src/locales/text-master.json` に配置する。

**ファイルが存在しない場合（新規）:**

```bash
mkdir -p src/locales
cp "${PLUGIN_DIR}/skills/aidd-setup/references/text-master.json" src/locales/text-master.json
```

**ファイルが既に存在する場合:**

既存ファイルを上書きせず、テンプレートとの差分を提示する:

1. テンプレート（`text-master.json`）と既存ファイルを比較する
2. テンプレートに含まれるキーのうち、既存ファイルに不足しているエントリを抽出する
3. 不足エントリをユーザーに提示し、追加するか確認を取る

> **テンプレート内容:** `errors.*`・`ui.*`・`validation.*` の名前空間とセマンティックキー例示が含まれる。詳細は `aidd-framework/guides/text-management.md` を参照。

### 10. コミット

変更があればブランチを作成してコミットする:

- ブランチ名: `chore/aidd-fw-install`
- コミットメッセージ: 初回は `chore: aidd-fw フレームワークのインストール`、更新時は `chore: aidd-fw を最新版に更新`

### 11. PR 作成確認

ユーザーに PR 作成を行うか確認する。

## プラグイン更新手順（Marketplace 経由）

最新版への更新が必要な場合、以下の手順をユーザーに案内する。各コマンドはセッション内コマンドであり、スキルからは自動実行できない。

```
# 1. Marketplace から最新版を取得
/plugin marketplace update aidd-fw

# 2. プラグインを更新
/plugin update aidd-fw

# 3. プラグインを再読み込み
/reload-plugins

# 4. フレームワークファイルをプロジェクトに再配置
/aidd-setup fw
```

ユーザーが各ステップを実行した結果を確認し、エラーがあればトラブルシューティングを提案する。

## 完了条件

- `aidd-framework/` がプラグインの最新版と同一内容で全置き換えされている
- `.github/ISSUE_TEMPLATE/` に Issue テンプレートが配置されている
- `.github/workflows/merge-guard.yml` がスキルの references から配置されている
- ステータス・Gate ラベルが GitHub に作成されている
- AI エージェント指示ファイルのテンプレート管理セクションが最新テンプレートと一致している
- AI エージェント指示ファイルのプロジェクト固有セクションが保持されている
- 変更がブランチにコミットされている
