# コミット前セルフレビュー -- チェックリスト

コミット前に以下の 5 観点でセルフレビューを実施する。MUST FIX があれば修正してからコミットする。

> **位置づけ:** G5 Tier 1（PR レビュー）と同等の観点を、コミット単位で実施するものである。問題の早期検出により、PR レビュー時の手戻りを防ぐ。

## 5 観点チェックリスト

| # | 観点 | チェック内容 | 検証方法 |
|---|------|------------|---------|
| 1 | **AC 準拠** | Task AC に対して実装が正確に対応しているか。不足・過剰がないか | Task 定義の AC を 1 つずつ確認し、対応するコード変更が存在することを検証する |
| 2 | **テスト存在** | 各 AC に対応するテストが存在し、全て通過するか | `task test` または該当テストコマンドを実行し、全テストが PASS することを確認する |
| 3 | **スコープ遵守** | Task スコープ外の変更が含まれていないか（過剰実装の検出） | `git diff --stat` で変更ファイル一覧を確認し、Task 定義の対象範囲と照合する |
| 4 | **規約準拠** | 命名規則・ディレクトリ構造・実装パターンが規約に従っているか | `task lint` または該当 lint コマンドを実行し、警告・エラーが 0 であることを確認する。`docs/conventions/` の該当規約と照合する |
| 5 | **suppress 禁止** | `eslint-disable`, `@ts-ignore` 等の lint suppress が新たに追加されていないか | `git diff` の差分に suppress 構文が含まれていないことを確認する（後述の禁止一覧を参照） |

## 問題発見時のフロー

セルフレビュー反復ループ（aidd-framework/references/self-review-loop.md）に従う。最大 3 ラウンドで MUST FIX を解消する。

各ラウンドでは:

1. **問題を特定する** -- チェックリストのどの観点で不合格かを明確にする
2. **コードを修正する** -- 根本原因を修正する（suppress での回避は禁止）
3. **lint/テストを実行する** -- 修正が新たな問題を生んでいないことを確認する
4. **チェックリストを再実行する** -- 5 観点すべてを再確認する
5. **全観点 PASS でコミットする**

## lint suppress の禁止ルール

CLAUDE.md の禁止事項に基づき、リンター・型チェッカー・静的解析の警告やエラーを suppress 指示で回避してはならない。

### 禁止される suppress 構文一覧

| 言語/ツール | 禁止構文 |
|------------|---------|
| ESLint | `eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line` |
| TypeScript | `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` |
| Rust | `#[allow(...)]` |
| Go | `// nolint` |
| C/C++ | `#pragma warning disable` |
| Java | `@SuppressWarnings` |
| Python | `# noqa`, `# type: ignore` |

### suppress が必要に見える場合の対処手順

1. **根本原因を調査する** -- エラーメッセージを読み、なぜ警告が出ているかを理解する
2. **コードを修正する** -- 型定義の修正、適切な型アサーション、ロジックの書き換え等で根本解決する
3. **修正方法が不明な場合** -- ユーザーに相談する（suppress の追加は自己判断で行わない）
4. **正当な理由がある場合のみ** -- `suppress-approved: [理由]` マーカー付きで人間の承認を得た上で許容する

### 差分での suppress 検出方法

```bash
# ステージング済みの差分から suppress 構文を検出する
git diff --cached | grep -E '(eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|#\[allow\(|// nolint|#pragma warning disable|@SuppressWarnings|# noqa|# type: ignore)'
```

上記コマンドの出力が空であれば、新たな suppress は追加されていない。出力がある場合は、該当箇所を根本原因から修正すること。
