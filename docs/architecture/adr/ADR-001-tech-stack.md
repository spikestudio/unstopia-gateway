# ADR-001: 技術スタック選定

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-22 |
| 決定者 | sanojimaru |

## コンテキスト

jinn v0.9.3 をフォークして独自 AI gateway daemon を構築する。
jinn の既存技術スタックを継承しつつ、拡張の方向性を整理する。

## 決定

### コアランタイム

| 技術 | バージョン | 理由 |
|------|----------|------|
| Node.js | 22 | jinn が要件とする LTS。ESM ネイティブ対応 |
| TypeScript | 5.8 | strict モード。ESM (`NodeNext`) |
| pnpm | 10.6.4 | workspace monorepo 管理 |
| Turborepo | 2.x | パッケージ間のビルドキャッシュ・並列ビルド |

### パッケージ構成

| パッケージ | 内容 |
|----------|------|
| `packages/jimmy` | コアデーモン（CLI + Gateway + Engines + Connectors） |
| `packages/web` | Web ダッシュボード（Next.js 15 + React 19） |

### AI エンジン（現在 + 計画）

| エンジン | 状態 | CLI/API |
|---------|------|---------|
| Claude Code | 実装済み | `claude` CLI |
| Codex | 実装済み | `codex` CLI |
| Gemini | 実装済み | `gemini` CLI |
| Antigravity | 計画中 | Gemini API 互換 |

### データ永続化

| 技術 | 用途 |
|------|------|
| better-sqlite3 | セッション状態・コスト・ターン数（既存） |
| classic-level (LevelDB) | 記憶システム（Phase 1 追加予定） |

### テスト

| 技術 | 用途 |
|------|------|
| Vitest 4 | ユニットテスト |
| Playwright | E2E テスト |

### CI/CD

| 技術 | 用途 |
|------|------|
| GitHub Actions | CI（typecheck / test / build） |
| lefthook | ローカル CI フック（pre-commit / pre-push） |

## 結果

- jinn の既存コードベースをそのまま活用できる
- 新規追加する機能（記憶システム・多層スキル管理）は既存アーキテクチャと分離して追加できる
- TypeScript strict モードにより型安全性を確保

## 関連

- `docs/conventions/` — 規約ドキュメント群
- `docs/architecture/adr/ADR-002-architecture.md` — アーキテクチャ方針
