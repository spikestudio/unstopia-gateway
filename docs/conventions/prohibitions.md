# 禁止事項

技術スタック: TypeScript 5.8 / Node.js 22

## コード禁止事項

| # | 禁止事項 | 理由 | 代替手段 |
|---|---------|------|---------|
| 1 | `any` 型の使用 | 型安全性が失われ、バグを静的に検出できなくなる | `unknown` を使い型ガードで絞り込む |
| 2 | `@ts-ignore` / `@ts-expect-error` の無断使用 | 型エラーを隠蔽する。根本原因を修正すべき | 正しい型定義に修正する。やむを得ない場合は `suppress-approved:` マーカー付きで人間の承認を得る |
| 3 | `eslint-disable` の無断使用 | リンターを無効化してコード品質を下げる | 根本原因を修正する |
| 4 | 外部依存の直接インスタンス化（DI なし） | テスト不可能なコードになる | コンストラクタ injection でインターフェース経由で渡す |
| 5 | `async` 関数内の空 `catch` | エラーがサイレントに握りつぶされる | 最低限 `logger.error` でログを残す |
| 6 | `process.exit()` の無断呼び出し | daemon プロセスが予期せず終了する | エラーを上位レイヤーに伝播させる。CLI 層でのみ使用可 |
| 7 | Task AC に含まれない機能の実装（YAGNI） | スコープ外の実装がコードを複雑にする | AC に含まれるまで実装しない |
| 8 | 呼び出し元が 1 箇所のヘルパー関数の早期抽出（YAGNI） | 不要な抽象化がコードを読みにくくする | 3 箇所以上の重複が発生してから共通化を検討する |
| 9 | `aidd-framework/` の直接編集 | `/aidd-setup fw` 実行時に上書きされる | `CLAUDE.md` のプロジェクト固有セクションに記述する |
| 10 | jinn オリジナル API の破壊的変更 | アップストリームとのマージが困難になる | 独自機能は新規モジュール（例: `memory/`, `multi-skill/`）として追加する |

## 具体例

```ts
// 禁止 1: any 型
function parseConfig(raw: any): any { ... }         // ❌
function parseConfig(raw: unknown): Config { ... }  // ✅ unknown + 型ガード

// 禁止 4: 直接インスタンス化
class SessionManager {
  private db = new Database(":memory:");  // ❌ テスト時に差し替えられない
}
class SessionManager {
  constructor(private db: Database) {}   // ✅ injection
}

// 禁止 5: 空 catch
try {
  await engine.run(opts);
} catch (_e) {}                          // ❌ エラーが消える

try {
  await engine.run(opts);
} catch (err) {
  logger.error("Engine failed", { err }); // ✅
}

// 禁止 6: 無断 process.exit
function handleError(err: Error) {
  process.exit(1);  // ❌ daemon が死ぬ
}
function handleError(err: Error) {
  logger.error("Fatal error", { err });   // ✅ ログを残して継続
  throw err;                              // 上位に伝播
}
```

## プロセス禁止事項

| 禁止事項 | 強度 |
|---------|------|
| Issue なしの作業開始 | MUST |
| Issue 参照なし PR の作成 | MUST |
| main ブランチへの直接コミット | MUST |
| `/aidd-adhoc` を経由しない単発作業の直接マージ | MUST |
| 新しい外部ライブラリの無確認追加 | MUST |
