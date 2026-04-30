# Task: [ES-026] Story 3 — session-runner.ts の TranscriptReader fs 抽象化 + UT

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | — |
| Issue | #162 |
| Epic 仕様書 | ES-026 |
| Story | 3 |
| Complexity | S |
| PR | #TBD |

## 責務

`loadRawTranscript` と `loadTranscriptMessages` の `node:fs` 依存をオプション引数の `TranscriptReader` インターフェース経由で注入可能に変更し、インメモリモックでユニットテストを追加する。

## スコープ

対象ファイル:

- `packages/jimmy/src/gateway/api/session-runner.ts`（**既存・関数シグネチャ変更**）
- `packages/jimmy/src/gateway/api/__tests__/session-runner.test.ts`（**新規作成**）

対象外（隣接 Task との境界）:

- TASK-051: レートリミット処理の抽出
- TASK-052: フォールバック処理の抽出
- TASK-054: session-message.ts 実装（`loadRawTranscript` を参照するが本 Task はシグネチャ変更のみ）
- TASK-056: session-crud.ts 実装（`loadRawTranscript`/`loadTranscriptMessages` を参照するが本 Task はシグネチャ変更のみ）

## Epic から委ねられた詳細

- **案A（optional 関数引数）を採用**（ドメインモデルで承認済み）: `reader?: TranscriptReader` を第2引数として追加
- `TranscriptReader` インターフェース: `{ existsSync(path: string): boolean; readdirSync(path: string, options: { withFileTypes: true }): Dirent[]; readFileSync(path: string, encoding: "utf-8"): string; }`
- `reader` 省略時はデフォルトの `node:fs` 実装を使用（後方互換性を維持）
- デフォルト実装をモジュールスコープ定数 `const defaultReader: TranscriptReader = fs;` として定義し、`reader ?? defaultReader` で参照する
- 既存の呼び出し元（`sessions.ts` の `loadRawTranscript(session.engineSessionId)`）はシグネチャ互換のため変更不要

## 完了条件

**機能面（AC-ID 参照）:**

- [ ] **AC-E026-08**: `loadRawTranscript` と `loadTranscriptMessages` が `reader?: TranscriptReader` 引数経由で fs にアクセスする（直接 `fs.xxx` を呼ばない）
- [ ] **AC-E026-09**: インメモリの `TranscriptReader` モックを渡して JSONL エントリが正しくパースされることを検証するユニットテストが通過する
- [ ] **AC-E026-10**: ディレクトリ不在・ファイル不在・JSON パースエラーの各境界ケースで空配列が返ることをモックで検証するユニットテストが通過する
- [ ] Epic 仕様書の AC チェックボックス更新（AC-E026-08〜10）

### 品質面

- [ ] ユニットテスト/統合テストが追加・通過している
- [ ] コードレビューが承認されている
- [ ] CI パイプラインがグリーン
- [ ] リンター/静的解析がクリーン（`pnpm lint`・`pnpm typecheck` エラーなし）

## テスト方針

| テストレイヤー | 対象 | 備考 |
|-------------|------|------|
| ユニットテスト | `loadRawTranscript`, `loadTranscriptMessages` 関数 | インメモリ `TranscriptReader` モックを引数として渡す（`vi.mock` 不要） |
| ドメインロジックテスト | 該当なし | — |
| 統合テスト | 該当なし | — |
| E2E テスト | 該当なし — 理由: 関数シグネチャ変更・テスト追加のみ。E2E は TASK-059 で実施 | — |

**テストケース（最低限）:**

1. `loadRawTranscript`: 存在する JSONL ファイルからエントリが正しくパースされること（user/assistant role のみ取得）
2. `loadRawTranscript`: ディレクトリが存在しない場合に `[]` を返すこと
3. `loadRawTranscript`: 対象 JSONL ファイルが存在しない場合に `[]` を返すこと
4. `loadRawTranscript`: JSON パースエラーの行をスキップして残りのエントリを返すこと
5. `loadTranscriptMessages`: テキストブロックのみを文字列 content に変換すること
6. `loadTranscriptMessages`: 空のファイルで `[]` を返すこと

## AI への指示コンテキスト

| 項目 | 内容 |
|------|------|
| BC（境界づけられたコンテキスト） | 該当なし（支援ドメイン） |
| サブドメイン種別 | 支援: 標準設計 + 統合テスト中心 |

- 参照 Epic 仕様書: ES-026 Story 3（AC-E026-08〜10）
- 参照設計: `docs/design/session-runner-sessions-refactor-api-spec.md` §Section 2-3（session-runner.ts の変更後シグネチャ骨格）
- 参照設計: `docs/domain/session-runner-sessions-refactor-domain-model.md` §TranscriptReader
- 参照コード: `packages/jimmy/src/gateway/api/session-runner.ts` の 48〜151行（既存 `loadRawTranscript`/`loadTranscriptMessages` 実装）
- 参照規約: `docs/conventions/testing.md`

## 依存

- 先行 Task: なし（--）

## 引き渡し前チェック

- [ ] 完了条件が全て検証可能な形で記述されている
- [ ] 対応する Epic AC（AC-E026-08〜10）が特定され、完了条件と対応づけられている
- [ ] 参照すべき Epic 仕様書・ADR・既存コードが「AI への指示コンテキスト」に記載されている
- [ ] 参照設計にセクション番号/名（§）が記載されている
- [ ] コンテキスト量が複雑度レベルの目安（S: ~200行）に収まっている
- [ ] 規約ドキュメント群にこの Task で使う規約・パターンが記載されている
- [ ] 先行 Task が完了しコードがマージ済みである（本 Task は先行なし）
- [ ] ドキュメントに書かれていない暗黙の要件がない
- [ ] Epic から委ねられた詳細が転記されている
