# ES-025: CLI 分割（cli/setup.ts 539行 → 機能別サブモジュール）

## 概要

`packages/jimmy/src/cli/setup.ts`（539行）をコンソール出力ユーティリティ・ファイルシステムユーティリティ・プロジェクトコンテキスト検出の3サブモジュールに分割し、`runSetup` のみを `setup.ts` に残す。

## ストーリー

**As a** contributor,
**I want** `setup.ts` を機能別ファイルに分割されている状態にしたい,
**So that** 各ユーティリティを個別にテスト・再利用できる。

## Acceptance Criteria

| ID | 条件 |
|----|------|
| AC-E025-01 | `setup-ui.ts` に `ok`/`warn`/`fail`/`info`/`prompt` が分離されている |
| AC-E025-02 | `setup-fs.ts` に `whichBin`/`runVersion`/`ensureDir`/`ensureFile`/`applyTemplateReplacements`/`copyTemplateDir` が分離されている |
| AC-E025-03 | `setup-context.ts` に `detectProjectContext`/`defaultClaudeMd`/`defaultAgentsMd` が分離されている |
| AC-E025-04 | `setup.ts` が 300 行以下になっている |
| AC-E025-05 | `pnpm typecheck && pnpm test` 全 PASS |

## 設計

### ファイル構成

```
packages/jimmy/src/cli/
├── setup.ts          # runSetup のみ（< 300 行）
├── setup-ui.ts       # コンソール出力ユーティリティ
├── setup-fs.ts       # ファイルシステムユーティリティ
└── setup-context.ts  # プロジェクトコンテキスト検出・デフォルトテンプレート
```

### 依存関係

- `setup-ui.ts`: Node.js 標準ライブラリ（readline）のみ
- `setup-fs.ts`: Node.js 標準ライブラリ（fs, path, child_process）のみ
- `setup-context.ts`: Node.js 標準ライブラリ（fs, path, os）+ `setup-ui.ts`（DIM/RESET 定数）
- `setup.ts`: 上記3モジュール + 既存 shared/paths, shared/version, sessions/registry

## 関連

- Epic Issue: #151
- Task Issue: #152
- Phase: PD-002
