# セキュリティ例外記録

このファイルは `pnpm audit` で検出された脆弱性のうち、**即時修正しない**と判断したものの根拠を記録する。

## 記録フォーマット

| 項目 | 内容 |
|------|------|
| パッケージ | 脆弱なパッケージ名 |
| 重大度 | critical / high / moderate / low |
| 影響パス | 依存チェーン |
| 判断 | 対応方針と理由 |
| 確認日 | 例外として記録した日付 |
| 再確認予定 | 次回確認タイミング |

---

## 例外一覧

### postcss（moderate × 2）

| 項目 | 内容 |
|------|------|
| パッケージ | `postcss` |
| 重大度 | moderate |
| 影響パス | `packages/web > @tailwindcss/postcss@4.2.1 > postcss` |
| 判断 | **Phase 2 スコープ外として次 Phase で対応**。`packages/web`（Web UI）の開発依存であり、`packages/jimmy`（daemon）には影響しない。postcss の脆弱性は CSS ビルド時（開発環境）に限定され、本番ランタイムには露出しない。`@tailwindcss/postcss` が最新版に更新されることで解消される見込み。 |
| 確認日 | 2026-04-28 |
| 再確認予定 | Phase 3 開始時（`@tailwindcss/postcss` のアップデートで自動解消の見込み） |

