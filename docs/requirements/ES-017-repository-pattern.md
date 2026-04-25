<!-- 配置先: docs/requirements/ES-017-repository-pattern.md -->
# ES-017: Repository パターン — sessions/registry.ts 抽象化

| 項目 | 内容 |
|------|------|
| Phase | Phase 2: コードベース構造改善 |
| 対応ストーリー | PD-002 S8 |
| MoSCoW | SHOULD |
| ステータス | 承認済み |
| 日付 | 2026-04-26 |

## 1. 背景・目的

`sessions/registry.ts`（698行・33関数）は `better-sqlite3` に直接依存する関数集合で、4ドメインが混在している。全呼び出し元が実装関数を直接 `import` しているため、テスト時に SQLite をモック差し替えできない。

Repository パターンにより「インターフェース越しのアクセス」を実現し、InMemory 実装でテスト可能な構造にする。

## 2. 現状分析

| ドメイン | 関数数 | 主な呼び出し元 |
|---------|--------|--------------|
| Session CRUD | 12 | sessions/manager.ts, sessions/engine-runner.ts, gateway/api/sessions.ts |
| Message | 2 | sessions/engine-runner.ts, gateway/api/org.ts |
| Queue | 8 | sessions/queue.ts, sessions/engine-runner.ts |
| File | 4 | gateway/files.ts, gateway/api/utils.ts |
| DB インフラ | 2 (`initDb`, `migrateSchema`) | gateway/budgets.ts, gateway/costs.ts, gateway/server.ts |

## 3. ストーリー

> As a **開発者**, I want to `sessions/registry.ts`（698行・33関数）を Repository パターンで抽象化したい, so that SQLite への直接依存がビジネスロジックから除去され、インメモリ実装でテストできる.

## 4. Acceptance Criteria

| # | AC | 検証方法 |
|---|----|---------|
| AC-1 | `ISessionRepository` インターフェースが `sessions/repositories/` に存在し、Session CRUD・コスト積算・重複・回復操作を網羅する | 型チェック通過 |
| AC-2 | `IMessageRepository` インターフェースが `insertMessage` / `getMessages` を定義する | 型チェック通過 |
| AC-3 | `IQueueRepository` インターフェースがキュー操作8関数を全て定義する | 型チェック通過 |
| AC-4 | `IFileRepository` インターフェースがファイルCRUD4関数を定義する | 型チェック通過 |
| AC-5 | `SqliteSessionRepository` / `SqliteMessageRepository` / `SqliteQueueRepository` / `SqliteFileRepository` が各インターフェースを実装する | `pnpm build` PASS |
| AC-6 | `InMemorySessionRepository` / `InMemoryMessageRepository` / `InMemoryQueueRepository` / `InMemoryFileRepository` が各インターフェースを実装し、Mapベースで動作する | テスト通過 |
| AC-7 | `container.ts` に `buildRepositories()` 関数が追加され、Sqliteリポジトリ4種を返す | コードレビュー |
| AC-8 | `sessions/manager.ts` / `sessions/engine-runner.ts` / `sessions/callbacks.ts` / `sessions/queue.ts` がリポジトリをコンストラクタ引数で受け取り、直接 `import` しない | `grep -r "from.*registry" sessions/` でDI対象ファイルがゼロ |
| AC-9 | `registry.ts` がSQLite実装からの再エクスポートファサードになり、既存のgateway/cli呼び出し元の変更が不要 | `pnpm build` PASS |
| AC-10 | InMemoryリポジトリを使ったユニットテストが5件以上追加される（SQLiteなしで実行可能） | `pnpm test` PASS |
| AC-11 | `pnpm build && pnpm test` が全てPASS | CI通過 |

## 5. 設計

### ディレクトリ構成

```
packages/jimmy/src/sessions/repositories/
├── ISessionRepository.ts        # Session CRUD インターフェース
├── IMessageRepository.ts        # Message インターフェース
├── IQueueRepository.ts          # Queue インターフェース
├── IFileRepository.ts           # File インターフェース
├── SqliteSessionRepository.ts   # better-sqlite3 実装
├── SqliteMessageRepository.ts
├── SqliteQueueRepository.ts
├── SqliteFileRepository.ts
├── InMemorySessionRepository.ts # テスト用 Map 実装
├── InMemoryMessageRepository.ts
├── InMemoryQueueRepository.ts
├── InMemoryFileRepository.ts
└── index.ts                     # 公開エクスポート
```

### 変更方針

- `registry.ts`: `initDb` / `migrateSessionsSchema` は残す（gateway/budgets.ts等が直接呼ぶため）。関数群は SqliteXxxRepository から re-export するファサードに変更
- `container.ts`: `buildRepositories(): Repositories` 関数を追加
- `sessions/manager.ts` / `sessions/engine-runner.ts` / `sessions/callbacks.ts` / `sessions/queue.ts`: コンストラクタ引数でリポジトリを受け取る形に変更
- `gateway/` 呼び出し元: 今 Epic では変更しない（registry.ts ファサード経由で継続）

### Task 分解

| Task | 内容 | 見積 |
|------|------|------|
| T1 | インターフェース定義 4ファイル + index.ts | 小 |
| T2 | SQLite 実装 4クラス（既存ロジック移植） | 中 |
| T3 | InMemory 実装 4クラス | 中 |
| T4 | container.ts + sessions/* DI対応 + registry.ts ファサード化 | 大 |
| T5 | InMemory 使用テスト 5件以上追加 | 中 |

## 6. 参照

- PD-002: `docs/requirements/PD-002-code-restructuring.md`
- ES-014: `docs/requirements/ES-014-session-manager-split.md`（前提 Epic）
