# Step 4: 関連ドキュメント連動 — 詳細手順

ADR 保存後、関連する Epic 仕様書・マスタドキュメントへの参照追記をユーザーに提案し、承認を得て実行する。
CLAUDE-base.md の「ADR 作成時はマスタドキュメントを同一 PR 内で即時更新すること」ルールに準拠する。

## 入力

- 保存済み ADR（ADR-NNN-slug.md）
- 現在の Epic 仕様書（存在する場合）

## 手順

### 1. 関連 Epic 仕様書への参照追記

対象 Epic 仕様書（`docs/requirements/ES-*.md`）が特定できる場合、「ADR 参照」フィールドへの追記を提案する:

```
📄 Epic 仕様書への参照追記を提案します:

ファイル: docs/requirements/ES-NNN-slug.md
変更箇所: | ADR 参照 | ADR-NNN |

追記してよいですか？
```

**Epic 仕様書が特定できない場合:** この手順をスキップし、手動追記を案内する。

### 2. マスタドキュメントへの参照追記

ADR の影響範囲（Step 1「影響範囲」の回答）に基づき、更新が必要なマスタドキュメントを提示する:

| 影響範囲 | 更新候補 |
|---------|---------|
| 技術スタック関連 | `docs/architecture/tech-stack.md` |
| アーキテクチャ関連 | `docs/architecture/architecture-overview.md` |
| フレームワーク全体 | `aidd-framework/FRAMEWORK.md` |
| API 設計 | 該当 Epic の `docs/design/*-api-spec.md` |

```
📄 マスタドキュメントの更新を提案します:

[更新候補リスト]

更新するドキュメントを選択してください（複数可）。
```

ユーザーが承認したドキュメントのみ更新する。更新後にコミットする:

```bash
git add [更新したファイル]
git commit -m "docs: ADR-NNN 関連ドキュメント更新"
```

### 3. .agents/ ミラー同期（このスキルの成果物）

`skills/aidd-adr/` の全ファイルを `.agents/skills/aidd-adr/` に同期する:

```bash
rm -rf .agents/skills/aidd-adr/
cp -r skills/aidd-adr/ .agents/skills/aidd-adr/
```

同期後にコミットする:

```bash
git add .agents/skills/aidd-adr/
git commit -m "chore: .agents/skills/aidd-adr/ ミラー同期"
```

## 成果物

- 関連ドキュメントの更新（ユーザーが承認した場合）
- `.agents/skills/aidd-adr/` ミラー同期済み
