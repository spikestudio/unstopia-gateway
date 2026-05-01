# ES-031: src/sessions テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #217 |
| Phase 定義書 | PD-003 |
| Epic | E6 |
| 所属 BC | sessions — セッション管理・フォーク・コールバック |
| ADR 参照 | <!-- 該当なし --> |

## 対応ストーリー

- S1: As a **開発者**, I want to `fork.ts` の全関数にテストを追加する, so that セッションフォーク機能の正常・異常系が自動で検証できるようにするため.
- S2: As a **開発者**, I want to `manager.ts` の未カバーブランチにテストを追加する, so that SessionManager の複雑な分岐ロジックが回帰から保護されるようにするため.
- S3: As a **開発者**, I want to `callbacks.ts` の未カバーブランチにテストを追加する, so that 通知ロジック（rate-limit / Discord通知）の信頼性を検証できるようにするため.
- S4: As a **開発者**, I want to `registry.ts` の未カバーブランチにテストを追加する, so that lazy singleton 初期化の分岐を検証できるようにするため.
- S5: As a **開発者**, I want to `src/shared/usageAwareness.ts` の未カバーブランチにテストを追加する, so that Claude 使用量トラッキングのエッジケースが保護されるようにするため.
- S6: As a **開発者**, I want to `engine-runner.ts` の未カバーブランチにテストを補完する, so that fork.ts と連携する中核機能の分岐が保護されるようにするため. （AI 補完: functions 20.45% と極端に低く sessions 全体カバレッジに大きく影響するため）

## 概要

`src/sessions` モジュール全体のブランチカバレッジを現状 66.06% から 90% 以上に向上させる。主な対象は未テストの `fork.ts`（0%）、低カバレッジの `manager.ts`（branch 56.55%）、`callbacks.ts`（branch 68.18%）、`engine-runner.ts`（branch 63.37% / functions 20.45%）であり、既存テストを拡充することでリグレッションリスクを低減する。

## ストーリーと受入基準

### Story 1: fork.ts のテスト追加

> As a **開発者**, I want to `fork.ts` の全関数にテストを追加する, so that セッションフォーク機能の正常・異常系が自動で検証できるようにするため.

**受入基準:**

- [ ] **AC-E031-01**: `forkCodexSession` を呼び出したとき、`~/.codex/sessions/` 以下に既存セッションファイルがある場合、新しい UUID を含む `.jsonl` ファイルが作成され、返り値の `engineSessionId` が元の ID と異なる。 ← S1
- [ ] **AC-E031-02**: `forkCodexSession` を呼び出したとき、対象セッションファイルが存在しない場合、`Codex session file not found` を含むエラーがスローされる。 ← S1
- [ ] **AC-E031-03**: `forkGeminiSession` を呼び出したとき、`~/.gemini/tmp/` 以下に一致する sessionId を持つファイルがある場合、新しい UUID と更新された startTime/lastUpdated を含む JSON ファイルが作成される。 ← S1
- [ ] **AC-E031-04**: `forkGeminiSession` を呼び出したとき、対象セッションファイルが存在しない場合、`Gemini session file not found` を含むエラーがスローされる。 ← S1
- [ ] **AC-E031-05**: `forkEngineSession` を `engine="codex"` で呼び出したとき、`forkCodexSession` に委譲される。 ← S1
- [ ] **AC-E031-06**: `forkEngineSession` を `engine="gemini"` で呼び出したとき、`forkGeminiSession` に委譲される。 ← S1
- [ ] **AC-E031-07**: `forkEngineSession` をサポート外エンジン（例: `"unknown"`）で呼び出したとき、`Unsupported engine for fork` を含むエラーがスローされる。 ← S1（AI 補完: switch の default ブランチは明示的にカバーが必要）
- [ ] **AC-E031-08**: `forkCodexSession` で元のセッションファイルの JSONL 先頭行に `payload.id` がある場合、コピー後のファイルでそのIDが新しいUUIDで置換されている。 ← S1（AI 補完: JSONL メタ書き換えロジックの分岐をカバー）

**インターフェース:** `src/sessions/fork.ts` — `forkCodexSession`, `forkGeminiSession`, `forkEngineSession`

---

### Story 2: manager.ts の未カバーブランチ追加

> As a **開発者**, I want to `manager.ts` の未カバーブランチにテストを追加する, so that SessionManager の複雑な分岐ロジックが回帰から保護されるようにするため.

**受入基準:**

- [ ] **AC-E031-09**: `route` を呼び出したとき、セッションが `running` 状態でキューが実行中かつコネクターが reactions 対応の場合、`clock1` リアクションが追加される。 ← S2
- [ ] **AC-E031-10**: `route` を呼び出したとき、`opts.engine` が指定されている場合、新規セッションはその engine で作成される。 ← S2
- [ ] **AC-E031-11**: `route` を呼び出したとき、`opts.employee` が指定されている場合、新規セッションはその employee 名と engine で作成される。 ← S2
- [ ] **AC-E031-12**: `handleCommand` で `/new ` プレフィックス（後ろにテキストあり）を受け取ったとき、セッションがリセットされ `true` が返る。 ← S2（AI 補完: `/new` と `/new ` の両方を text.startsWith でカバーしているブランチ）
- [ ] **AC-E031-13**: `handleCommand` で `/status ` プレフィックスを受け取ったとき、セッション情報が返信されて `true` が返る。 ← S2（AI 補完: `/status` と `/status ` の両方の分岐）
- [ ] **AC-E031-14**: `handleCommand` で `/doctor` を受け取ったとき、Gemini エンジン設定が存在する場合、応答に Gemini の情報が含まれる。 ← S2（AI 補完: Gemini は任意設定のため三項分岐が未カバー）
- [ ] **AC-E031-15**: `maybeRevertEngineOverride` が動作するとき、`engineOverride.until` が未来の場合は override が維持され、過去の場合は originalEngine に戻る。 ← S2（AI 補完: route 内の分岐だが manager の core logic として重要）

**インターフェース:** `src/sessions/manager.ts` — `SessionManager.route`, `SessionManager.handleCommand`

---

### Story 3: callbacks.ts の未カバーブランチ追加

> As a **開発者**, I want to `callbacks.ts` の未カバーブランチにテストを追加する, so that 通知ロジック（rate-limit / Discord通知）の信頼性を検証できるようにするため.

**受入基準:**

- [ ] **AC-E031-16**: `notifyRateLimitResumed` で parentSessionId がない場合、fetch が呼ばれない。 ← S3
- [ ] **AC-E031-17**: `notifyDiscordChannel` で `loadConfig` が例外を投げるとき（設定ファイル不在等）、デフォルト port 7777 が使われ、channel が未設定のためスキップされる。 ← S3（AI 補完: catch ブランチが未カバー）
- [ ] **AC-E031-18**: `_sendRaw`（`notifyRateLimited` / `notifyRateLimitResumed` 経由）で `loadConfig` が例外を投げるとき、デフォルト port 7777 で fetch が呼ばれる。 ← S3（AI 補完: `_sendRaw` の catch ブランチが未カバー）

**インターフェース:** `src/sessions/callbacks.ts` — `notifyRateLimitResumed`, `notifyDiscordChannel`, `notifyRateLimited`

---

### Story 4: registry.ts の未カバーブランチ追加

> As a **開発者**, I want to `registry.ts` の未カバーブランチにテストを追加する, so that lazy singleton 初期化の分岐を検証できるようにするため.

**受入基準:**

- [ ] **AC-E031-19**: `migrateSessionsSchema` を既にすべてのカラムが存在するテーブルに適用したとき、ALTER TABLE は実行されず、既存データが変わらない。 ← S4（AI 補完: migration の「既存カラムあり」ブランチが未カバー）
- [ ] **AC-E031-20**: `initDb` を2回以上呼び出したとき、同じ Database インスタンスが返され（シングルトン）、テーブルが重複生成されない。 ← S4（AI 補完: `if (_db) return _db` の分岐が未カバー。ただし実テストでは singleton リセットが必要）

**インターフェース:** `src/sessions/registry.ts` — `initDb`, `migrateSessionsSchema`

---

### Story 5: src/shared/usageAwareness.ts の未カバーブランチ追加

> As a **開発者**, I want to `src/shared/usageAwareness.ts` の未カバーブランチにテストを追加する, so that Claude 使用量トラッキングのエッジケースが保護されるようにするため.

**受入基準:**

- [ ] **AC-E031-21**: `recordClaudeRateLimit` を `resetsAtSeconds` なしで呼び出したとき、`lastResetsAt` が記録されず `lastRateLimitAt` のみ更新される。 ← S5
- [ ] **AC-E031-22**: `recordClaudeRateLimit` を `resetsAtSeconds` が有限な数値で呼び出したとき、`lastResetsAt` が対応する ISO 文字列で記録される。 ← S5
- [ ] **AC-E031-23**: `isLikelyNearClaudeUsageLimit` を呼び出したとき、`lastResetsAt` が未来の場合は `true` が返る（6時間ヒューリスティック内であっても reset 時刻が未来なら限界近し）。 ← S5
- [ ] **AC-E031-24**: `isLikelyNearClaudeUsageLimit` を呼び出したとき、`lastResetsAt` が過去の場合は `false` が返る（制限クリア済み）。 ← S5
- [ ] **AC-E031-25**: `readClaudeUsageState` がファイル不在の場合は空オブジェクトを返し、不正な JSON の場合も空オブジェクトを返す。 ← S5（AI 補完: catch ブランチが未カバー）

**インターフェース:** `src/shared/usageAwareness.ts` — `recordClaudeRateLimit`, `isLikelyNearClaudeUsageLimit`, `readClaudeUsageState`

---

### Story 6: engine-runner.ts の未カバーブランチ補完

> As a **開発者**, I want to `engine-runner.ts` の未カバーブランチにテストを補完する, so that fork.ts と連携する中核機能の分岐が保護されるようにするため.

**受入基準:**

- [ ] **AC-E031-26**: `runSession` でエンジンが存在しない場合（engines.get 返り値が undefined）、エラーメッセージがコネクターに返信され処理が終了する。 ← S6
- [ ] **AC-E031-27**: `runSession` で予算が `paused` の場合、セッションが `error` ステータスに更新され、コネクターにエラーメッセージが返信される。 ← S6
- [ ] **AC-E031-28**: `runSession` でセッションソースが `cron` の場合、reactions/decorateMessages が無効化され、メッセージ装飾なしで engine.run が呼ばれる。 ← S6（AI 補完: `decorateMessages = session.source !== "cron"` 分岐）
- [ ] **AC-E031-29**: `checkBudgetResult` で `budgetStatus="paused"` のとき、`BUDGET_EXCEEDED` エラーの Result が返る。 ← S6

**インターフェース:** `src/sessions/engine-runner.ts` — `runSession`, `checkBudgetResult`

---

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | 該当なし | — |
| DB スキーマ骨格 | 該当なし | — |
| API spec 骨格 | 該当なし | — |

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| engineSessionId（fork 引数） | 非空文字列 | 対象ファイルが見つからずエラー |
| engine（forkEngineSession 引数） | "claude" / "codex" / "gemini" のいずれか | `Unsupported engine for fork` エラー |

## ステータス遷移（該当なし）

テスト追加 Epic のため、ステータス遷移図は不要。

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| Codex session ファイル不在 | `~/.codex/sessions/` 配下にファイルなし | エラースロー | AC-E031-02 |
| Gemini session ファイル不在 | `~/.gemini/tmp/` 配下に一致するファイルなし | エラースロー | AC-E031-04 |
| 未対応エンジン | "claude"/"codex"/"gemini" 以外 | エラースロー | AC-E031-07 |
| エンジン不在 | engines.get が undefined を返す | コネクターにエラー返信、処理終了 | AC-E031-26 |
| 予算超過 | budgetStatus = "paused" | セッション error 更新、コネクターにエラー返信 | AC-E031-27 |
| loadConfig 失敗 | 設定ファイル不在・不正 | デフォルト値にフォールバック | AC-E031-17, 18 |

## 非機能要件

| 項目 | 基準 |
|------|------|
| カバレッジ目標 | src/sessions branch カバレッジ 90% 以上 |
| テスト実行時間 | 全テスト追加後も vitest run が 30 秒以内に完了 |
| 外部副作用 | fork.ts テストは一時ディレクトリを使用し ~/.codex / ~/.gemini を汚染しない |
| テスト独立性 | 各テストは beforeEach/afterEach で状態をリセットし、相互依存しない |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 後続 Epic の開発者・CI パイプライン |
| デリバリーする価値 | src/sessions の branch カバレッジが 90% 以上に達し、セッションフォーク・マネージャー・コールバック・使用量追跡の回帰が自動検出できるようになる |
| デモシナリオ | `pnpm vitest run --coverage` を実行し、src/sessions の Branch coverage 列が 90% 以上を示すことを確認する |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | `pnpm vitest run --coverage` で src/sessions の branch coverage ≥ 90% を確認 |
| 検証環境 | ローカル環境（Node.js + vitest）。DB は better-sqlite3 の :memory: モードを使用 |
| 前提条件 | pnpm install 済み。fork.ts テストは一時ディレクトリを `os.tmpdir()` 以下に作成 |

## 他 Epic への依存・影響

- ES-026（session-runner-sessions-refactor）に依存。registry.ts / engine-runner.ts の構造が安定していることを前提とする
- ES-030（engines-test-coverage）との並行作業は不要（完了済み）

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `forkClaudeSession` はCLIを呼び出すため実 `claude` バイナリが必要。モックするか除外するか | 未決定 | Task 分解時に判断（claude バイナリを execFileSync から分離しモック可能にするか、テスト対象外とするか） |
| 2 | `engine-runner.ts` の `runSession` は統合的な関数でモックが複雑。どの分岐まで単体テストでカバーするか | 未決定 | Task 分解時に AC-E031-26〜29 の実装難易度を考慮して判断 |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている
- [x] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（テスト追加のため権限制御なし）
- [x] 関連 ADR が参照されている（該当なし）
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-E031-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [x] 所属 BC が記載されている
- [x] 設計成果物セクションが記入されている（該当なしを含む）
