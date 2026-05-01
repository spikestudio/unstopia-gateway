<!-- 配置先: docs/requirements/ES-029-cli-test-coverage.md — 相対リンクはこの配置先を前提としている -->
# ES-029: src/cli テストカバレッジ向上

| 項目 | 内容 |
|------|------|
| 例外承認 Issue | <!-- 該当なし --> |
| Issue | #194 |
| Phase 定義書 | PD-003 |
| Epic | E3 |
| 所属 BC | <!-- 該当なし（CLI/インフラ層） --> |
| ADR 参照 | <!-- 該当なし --> |

## 対応ストーリー

<!-- Phase 定義書 PD-003 の E3（src/cli テストカバレッジ向上 Epic）から転記 -->

- S1: `instances.ts` のテスト（loadInstances / saveInstances / nextAvailablePort / ensureDefaultInstance / findInstance）
- S2: `setup-fs.ts` のテスト（whichBin / runVersion / ensureDir / ensureFile / applyTemplateReplacements / copyTemplateDir）
- S3: `setup-ui.ts` のテスト（ok / warn / fail / info / prompt）
- S4: `setup-context.ts` のテスト（detectProjectContext / defaultClaudeMd / defaultAgentsMd）
- S5: `create.ts` のテスト（runCreate — バリデーション / 重複チェック / setup呼び出し / 登録）
- S6: `list.ts` のテスト（runList — インスタンス一覧 / PID 確認 / 状態表示）
- S7: `remove.ts` のテスト（runRemove — jinn 保護 / 未存在 / 実行中チェック / force削除）
- S8: `nuke.ts` のテスト（runNuke — jinn 保護 / 名前指定 / 実行中停止 / 削除）
- S9: `start.ts` のテスト（runStart — 未setup / migrate警告 / daemon / foreground）
- S10: `stop.ts` のテスト（runStop — 停止成功 / 未実行）
- S11: `status.ts` のテスト（runStatus — 未setup / 停止中 / 実行中 / HTTP取得）
- S12: `migrate.ts` 追加テスト（check フラグ / auto マイグレーション / 複数バージョン）
- S13: `skills.ts` のテスト（readManifest / writeManifest / upsertManifest / removeFromManifest / snapshotDirs / diffSnapshots / extractSkillName / findExistingSkill / skillsFind / skillsAdd / skillsRemove / skillsList / skillsUpdate / skillsRestore）
- S14: `chrome-allow.ts` のテスト（getExtensionDbPath / isBrowserRunning / quitBrowser / openBrowser / allowAllForBrowser / runChromeAllow）

## 概要

`packages/jimmy/src/cli/` 配下全モジュールのブランチカバレッジを 3% から 90% 以上に向上させる。
`instances.ts` / `setup-fs.ts` / `setup-ui.ts` / `setup-context.ts` / `create.ts` / `list.ts` / `remove.ts` / `nuke.ts` / `start.ts` / `stop.ts` / `status.ts` / `migrate.ts`（追加）/ `skills.ts` / `chrome-allow.ts` の 14 モジュール（ストーリー）を対象として単体テストを実装し、Node.js 組み込みモジュール（`fs`・`child_process`・`readline`・`os`・`crypto`）をモックすることで外部依存なしにテスト可能にする。

## ストーリーと受入基準

### Story 1: instances.ts のテスト

> As a **開発者（テスト実行者）**, I want to `instances.ts` の全関数をモック環境でテストできる, so that インスタンスレジストリの読み書き・ポート採番ロジックを外部ファイルシステムなしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-01**: `loadInstances()` を呼び出し `fs.existsSync` が `false` を返すとき、空配列 `[]` を返すこと ← S1
- [ ] **AC-E029-02**: `loadInstances()` を呼び出し `fs.readFileSync` が有効な JSON 配列を返すとき、パースされた `Instance[]` を返すこと ← S1
- [ ] **AC-E029-03**: `loadInstances()` を呼び出し `fs.readFileSync` が不正な JSON を返すとき、空配列 `[]` を返すこと ← S1（AI 補完: 壊れたレジストリファイルへの耐性は安定性の要件）
- [ ] **AC-E029-04**: `saveInstances(instances)` を呼び出すと `fs.mkdirSync` と `fs.writeFileSync` が適切な引数で呼ばれること ← S1
- [ ] **AC-E029-05**: `nextAvailablePort([])` を呼び出すと `7777` を返すこと ← S1
- [ ] **AC-E029-06**: `nextAvailablePort([{port: 7777, ...}])` を呼び出すと `7778` を返すこと ← S1
- [ ] **AC-E029-07**: `ensureDefaultInstance()` を呼び出し既に "jinn" インスタンスが存在するとき、`saveInstances` が呼ばれないこと ← S1（AI 補完: 冪等性の保証）
- [ ] **AC-E029-08**: `ensureDefaultInstance()` を呼び出し "jinn" が存在しないとき、"jinn" インスタンスを先頭に追加して `saveInstances` が呼ばれること ← S1
- [ ] **AC-E029-09**: `findInstance("jinn")` を呼び出し該当するインスタンスが存在するとき、そのインスタンスオブジェクトを返すこと ← S1
- [ ] **AC-E029-10**: `findInstance("nonexistent")` を呼び出したとき、`undefined` を返すこと ← S1

**インターフェース:** `instances.ts` の `loadInstances / saveInstances / nextAvailablePort / ensureDefaultInstance / findInstance`

---

### Story 2: setup-fs.ts のテスト

> As a **開発者（テスト実行者）**, I want to `setup-fs.ts` の全関数をモック環境でテストできる, so that ファイルシステム操作ユーティリティが外部依存なしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-11**: `whichBin("claude")` を呼び出し `execSync` が成功するとき、トリムされたパス文字列を返すこと ← S2
- [ ] **AC-E029-12**: `whichBin("claude")` を呼び出し `execSync` が例外をスローするとき、`null` を返すこと ← S2
- [ ] **AC-E029-13**: `runVersion("claude")` を呼び出し `execSync` が成功するとき、トリムされたバージョン文字列を返すこと ← S2
- [ ] **AC-E029-14**: `runVersion("claude")` を呼び出し `execSync` が例外をスローするとき、`null` を返すこと ← S2
- [ ] **AC-E029-15**: `ensureDir(dir)` を呼び出し `fs.existsSync` が `true` を返すとき、`false` を返し `fs.mkdirSync` が呼ばれないこと ← S2
- [ ] **AC-E029-16**: `ensureDir(dir)` を呼び出し `fs.existsSync` が `false` を返すとき、`true` を返し `fs.mkdirSync` が呼ばれること ← S2
- [ ] **AC-E029-17**: `ensureFile(filePath, content)` を呼び出し `fs.existsSync` が `true` を返すとき、`false` を返し `fs.writeFileSync` が呼ばれないこと ← S2
- [ ] **AC-E029-18**: `ensureFile(filePath, content)` を呼び出し `fs.existsSync` が `false` を返すとき、`true` を返し `fs.mkdirSync` と `fs.writeFileSync` が呼ばれること ← S2
- [ ] **AC-E029-19**: `applyTemplateReplacements("hello {{name}}", {"{{name}}": "world"})` を呼び出すと `"hello world"` を返すこと ← S2
- [ ] **AC-E029-20**: `copyTemplateDir(srcDir, destDir)` を呼び出し src が存在しないとき、空配列 `[]` を返すこと ← S2（AI 補完: 存在しないソースへの耐性）
- [ ] **AC-E029-21**: `copyTemplateDir(srcDir, destDir)` を呼び出し src にファイルが存在し dest に対応ファイルがないとき、コピーされた相対パスの配列を返すこと ← S2
- [ ] **AC-E029-22**: `copyTemplateDir` は `.gitkeep` ファイルをスキップすること ← S2（AI 補完: .gitkeep 専用のスキップロジックが存在する）

**インターフェース:** `setup-fs.ts` の全エクスポート関数

---

### Story 3: setup-ui.ts のテスト

> As a **開発者（テスト実行者）**, I want to `setup-ui.ts` の全関数をモック環境でテストできる, so that UI 表示ユーティリティが正しい ANSI エスケープシーケンスと共に出力することを検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-23**: `ok("message")` を呼び出すと `console.log` がグリーン `[ok]` プレフィックス付きのメッセージで呼ばれること ← S3
- [ ] **AC-E029-24**: `warn("message")` を呼び出すと `console.log` がイエロー `[warn]` プレフィックス付きのメッセージで呼ばれること ← S3
- [ ] **AC-E029-25**: `fail("message")` を呼び出すと `console.log` がレッド `[missing]` プレフィックス付きのメッセージで呼ばれること ← S3
- [ ] **AC-E029-26**: `info("message")` を呼び出すと `console.log` が DIM スタイルのメッセージで呼ばれること ← S3
- [ ] **AC-E029-27**: `prompt("question", "default")` を呼び出すと `readline.createInterface` が作成され、ユーザーが Enter を押した場合（空入力）デフォルト値を返すこと ← S3（AI 補完: デフォルト値フォールバックは UX の要件）

**インターフェース:** `setup-ui.ts` の全エクスポート関数

---

### Story 4: setup-context.ts のテスト

> As a **開発者（テスト実行者）**, I want to `setup-context.ts` の全関数をモック環境でテストできる, so that プロジェクトコンテキスト検出ロジックが外部ファイルシステムなしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-28**: `detectProjectContext("jinn")` を呼び出し `~/Projects` が存在しないとき、`console.log` が呼ばれないこと ← S4
- [ ] **AC-E029-29**: `detectProjectContext("jinn")` を呼び出し `~/Projects/foo/Dockerfile` が存在するとき、Docker に関するスキル提案メッセージが `console.log` で出力されること ← S4
- [ ] **AC-E029-30**: `detectProjectContext("jinn")` を呼び出し `~/Projects/foo/package.json` に react/next 依存が含まれるとき、React に関するスキル提案が `console.log` で出力されること ← S4
- [ ] **AC-E029-31**: `defaultClaudeMd("Jinn")` を呼び出すと "Jinn" を含む文字列を返すこと ← S4
- [ ] **AC-E029-32**: `defaultAgentsMd("Jinn")` を呼び出すと "Jinn" を含む文字列を返すこと ← S4

**インターフェース:** `setup-context.ts` の `detectProjectContext / defaultClaudeMd / defaultAgentsMd`

---

### Story 5: create.ts のテスト

> As a **開発者（テスト実行者）**, I want to `create.ts` の振る舞いをモック環境でテストできる, so that インスタンス作成ロジックの各バリデーションパスを外部コマンド実行なしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-33**: `runCreate("INVALID")` を呼び出すと `console.error` で名前バリデーションエラーが出力され `process.exit(1)` が呼ばれること ← S5
- [ ] **AC-E029-34**: `runCreate("jinn")` を呼び出すと `console.error` で "jinn" 予約名エラーが出力され `process.exit(1)` が呼ばれること ← S5
- [ ] **AC-E029-35**: `runCreate("existing")` を呼び出し同名インスタンスが存在するとき、`console.error` で重複エラーが出力され `process.exit(1)` が呼ばれること ← S5
- [ ] **AC-E029-36**: `runCreate("atlas")` を呼び出し `fs.existsSync(home)` が `true` を返すとき、`console.error` でホームディレクトリ重複エラーが出力され `process.exit(1)` が呼ばれること ← S5（AI 補完: ホームディレクトリ衝突は別の境界値）
- [ ] **AC-E029-37**: `runCreate("atlas")` を呼び出しバリデーションが全て通るとき、`execFileSync` で setup が呼ばれ、インスタンスがレジストリに保存され、成功メッセージが `console.log` で出力されること ← S5

**インターフェース:** `create.ts` の `runCreate(name, port?): Promise<void>`

---

### Story 6: list.ts のテスト

> As a **開発者（テスト実行者）**, I want to `list.ts` の振る舞いをモック環境でテストできる, so that インスタンス一覧表示とプロセス生死確認ロジックを外部依存なしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-38**: `runList()` を呼び出しインスタンスが0件のとき、"No instances found" を含むメッセージが `console.log` で出力されること ← S6
- [ ] **AC-E029-39**: `runList()` を呼び出し PID ファイルが存在せず、インスタンスが1件あるとき、`stopped` 状態で一覧が `console.log` で出力されること ← S6
- [ ] **AC-E029-40**: `runList()` を呼び出し PID ファイルが存在し `process.kill(pid, 0)` が成功するとき、`running` 状態で一覧が出力されること ← S6
- [ ] **AC-E029-41**: `runList()` を呼び出し PID ファイルが存在し `process.kill(pid, 0)` が例外をスローするとき、`stopped` 状態で一覧が出力されること ← S6（AI 補完: stale PID ファイルのハンドリングは list.ts の主要ロジック）

**インターフェース:** `list.ts` の `runList(): Promise<void>`

---

### Story 7: remove.ts のテスト

> As a **開発者（テスト実行者）**, I want to `remove.ts` の振る舞いをモック環境でテストできる, so that インスタンス削除の各バリデーションパスを外部依存なしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-42**: `runRemove("jinn", {})` を呼び出すと `console.error` で保護エラーが出力され `process.exit(1)` が呼ばれること ← S7
- [ ] **AC-E029-43**: `runRemove("nonexistent", {})` を呼び出すと `console.error` で未発見エラーが出力され `process.exit(1)` が呼ばれること ← S7
- [ ] **AC-E029-44**: `runRemove("atlas", {})` を呼び出し PID ファイルが存在し `process.kill(pid, 0)` が成功するとき、`console.error` で実行中エラーが出力され `process.exit(1)` が呼ばれること ← S7
- [ ] **AC-E029-45**: `runRemove("atlas", {})` を呼び出しバリデーションが全て通るとき、インスタンスがレジストリから削除され成功メッセージが `console.log` で出力されること ← S7
- [ ] **AC-E029-46**: `runRemove("atlas", { force: true })` を呼び出すとき、`fs.rmSync` でホームディレクトリが削除されること ← S7

**インターフェース:** `remove.ts` の `runRemove(name, opts): Promise<void>`

---

### Story 8: nuke.ts のテスト

> As a **開発者（テスト実行者）**, I want to `nuke.ts` の振る舞いをモック環境でテストできる, so that 完全削除操作の各パスを readline/fs をモックして検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-47**: `runNuke()` を呼び出し削除可能なインスタンスが0件のとき、"No removable instances" を含むメッセージが `console.log` で出力されること ← S8
- [ ] **AC-E029-48**: `runNuke("jinn")` を呼び出すと `console.error` で保護エラーが出力され `process.exit(1)` が呼ばれること ← S8
- [ ] **AC-E029-49**: `runNuke("nonexistent")` を呼び出すと `console.error` で未発見エラーが出力され `process.exit(1)` が呼ばれること ← S8
- [ ] **AC-E029-50**: `runNuke("atlas")` を呼び出し `readline` モックで確認文字列が一致するとき、インスタンスがレジストリから削除され `fs.rmSync` で削除されること ← S8
- [ ] **AC-E029-51**: `runNuke("atlas")` を呼び出し `readline` モックで確認文字列が不一致のとき、"Aborted" メッセージが `console.log` で出力され削除が行われないこと ← S8（AI 補完: 中断パスのテストは破壊的操作の安全性に必須）

**インターフェース:** `nuke.ts` の `runNuke(name?): Promise<void>`

---

### Story 9: start.ts のテスト

> As a **開発者（テスト実行者）**, I want to `start.ts` の振る舞いをモック環境でテストできる, so that Gateway 起動ロジックの各パスを外部依存なしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-52**: `runStart({})` を呼び出し `JINN_HOME` が存在しないとき、エラーメッセージが `console.error` で出力され `process.exit(1)` が呼ばれること ← S9
- [ ] **AC-E029-53**: `runStart({})` を呼び出し `compareSemver` が負値を返すとき（instance version が古い）、マイグレーション警告が `console.log` で出力されること ← S9
- [ ] **AC-E029-54**: `runStart({ daemon: true })` を呼び出すと `startDaemon` が呼ばれ "Gateway started in background." が `console.log` で出力されること ← S9
- [ ] **AC-E029-55**: `runStart({})` を呼び出すと `startForeground` が呼ばれること ← S9

**インターフェース:** `start.ts` の `runStart(opts): Promise<void>`

---

### Story 10: stop.ts のテスト

> As a **開発者（テスト実行者）**, I want to `stop.ts` の振る舞いをモック環境でテストできる, so that Gateway 停止ロジックを外部依存なしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-56**: `runStop()` を呼び出し `stop()` が `true` を返すとき、"Gateway stopped." が `console.log` で出力されること ← S10
- [ ] **AC-E029-57**: `runStop()` を呼び出し `stop()` が `false` を返すとき、"Gateway is not running." が `console.log` で出力されること ← S10

**インターフェース:** `stop.ts` の `runStop(port?): Promise<void>`

---

### Story 11: status.ts のテスト

> As a **開発者（テスト実行者）**, I want to `status.ts` の振る舞いをモック環境でテストできる, so that Gateway ステータス表示の各パスを外部依存なしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-58**: `runStatus()` を呼び出し `JINN_HOME` が存在しないとき、"Gateway is not set up" を含むメッセージが `console.log` で出力されること ← S11
- [ ] **AC-E029-59**: `runStatus()` を呼び出し `getStatus()` が `{ running: false }` を返すとき、"Gateway: stopped" が `console.log` で出力されること ← S11
- [ ] **AC-E029-60**: `runStatus()` を呼び出し `getStatus()` が `{ running: false, pid: 123 }` を返すとき、stale PID の警告が `console.log` で出力されること ← S11（AI 補完: stale PID メッセージは status.ts 専用ブランチ）
- [ ] **AC-E029-61**: `runStatus()` を呼び出し `getStatus()` が `{ running: true, pid: 456 }` を返すとき、"Gateway: running" と PID が `console.log` で出力されること ← S11
- [ ] **AC-E029-62**: `runStatus()` を呼び出しゲートウェイが HTTP で応答するとき（`fetch` モック）、セッション数とポートが `console.log` で出力されること ← S11（AI 補完: HTTP 取得パスのカバレッジに必要）

**インターフェース:** `status.ts` の `runStatus(): Promise<void>`

---

### Story 12: migrate.ts 追加テスト

> As a **開発者（テスト実行者）**, I want to `migrate.ts` の未カバーブランチをモック環境でテストできる, so that check/auto フラグと複数マイグレーションの処理パスを検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-63**: `runMigrate({ check: true })` を呼び出し pending マイグレーションが存在するとき、`execFileSync` が呼ばれず "Run jinn migrate" を含むメッセージが `console.log` で出力されること ← S12
- [ ] **AC-E029-64**: `runMigrate({})` を呼び出し pending マイグレーションが0件のとき、バージョンスタンプが更新され "Up to date" または "No migration scripts" のメッセージが `console.log` で出力されること ← S12（AI 補完: up-to-date ブランチと no-scripts ブランチは個別の処理パス）
- [ ] **AC-E029-65**: `runMigrate({ auto: true })` を呼び出すと `execFileSync` が呼ばれず auto マイグレーションが実行されること ← S12
- [ ] **AC-E029-66**: `runMigrate({})` を呼び出し `compareSemver` が 0 以上を返すとき（既に最新）、"Up to date." が `console.log` で出力されること ← S12

**インターフェース:** `migrate.ts` の `runMigrate(opts): Promise<void>`

---

### Story 13: skills.ts のテスト

> As a **開発者（テスト実行者）**, I want to `skills.ts` の全関数をモック環境でテストできる, so that スキル管理ロジック（マニフェスト操作・インストール・削除・更新）を外部コマンドなしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-67**: `readManifest()` を呼び出し `SKILLS_JSON` が存在しないとき、空配列 `[]` を返すこと ← S13
- [ ] **AC-E029-68**: `readManifest()` を呼び出し不正な JSON を読んだとき、空配列 `[]` を返すこと ← S13（AI 補完: 壊れたマニフェストへの耐性）
- [ ] **AC-E029-69**: `writeManifest(entries)` を呼び出すと `fs.writeFileSync` が JSON 文字列で呼ばれること ← S13
- [ ] **AC-E029-70**: `upsertManifest("foo", "owner/repo")` を呼び出し "foo" が存在しないとき、エントリが追加されること ← S13
- [ ] **AC-E029-71**: `upsertManifest("foo", "owner/repo")` を呼び出し "foo" が既に存在するとき、エントリが更新されること ← S13
- [ ] **AC-E029-72**: `removeFromManifest("foo")` を呼び出し存在するとき `true` を返しエントリが削除されること ← S13
- [ ] **AC-E029-73**: `removeFromManifest("nonexistent")` を呼び出すとき `false` を返すこと ← S13
- [ ] **AC-E029-74**: `extractSkillName("owner/repo@skill-name")` を呼び出すと `"skill-name"` を返すこと ← S13
- [ ] **AC-E029-75**: `extractSkillName("owner/repo")` を呼び出すと `"repo"` を返すこと ← S13
- [ ] **AC-E029-76**: `skillsRemove("foo")` を呼び出しスキールが存在するとき、`fs.rmSync` で削除され成功メッセージが出力されること ← S13
- [ ] **AC-E029-77**: `skillsRemove("nonexistent")` を呼び出すとき、`console.error` でエラーが出力されること ← S13
- [ ] **AC-E029-78**: `skillsList()` を呼び出しスキルが0件のとき、"No skills installed." が `console.log` で出力されること ← S13

**インターフェース:** `skills.ts` の全エクスポート関数

---

### Story 14: chrome-allow.ts のテスト

> As a **開発者（テスト実行者）**, I want to `chrome-allow.ts` のビジネスロジックをモック環境でテストできる, so that Extension DB パス解決・ブラウザ生死確認・ウィルドカード権限書き込みロジックを外部依存なしに検証できるようにするため.

**受入基準:**

- [ ] **AC-E029-79**: `runChromeAllow({})` を呼び出し `classic-level` のインポートが失敗するとき、`console.error` で "classic-level is required" メッセージが出力され `process.exit(1)` が呼ばれること ← S14
- [ ] **AC-E029-80**: `getExtensionDbPath(chromeBrowser)` を呼び出し macOS かつ Default プロファイルに DB が存在するとき、そのパスを返すこと ← S14（AI 補完: プラットフォーム別パス解決は主要ブランチ）
- [ ] **AC-E029-81**: `getExtensionDbPath(chromeBrowser)` を呼び出し全候補パスが存在しないとき、`null` を返すこと ← S14
- [ ] **AC-E029-82**: `isBrowserRunning(browser)` を呼び出し `execSync` が成功するとき（darwin: "true" を返す場合）、`true` を返すこと ← S14
- [ ] **AC-E029-83**: `isBrowserRunning(browser)` を呼び出し `execSync` が例外をスローするとき、`false` を返すこと ← S14
- [ ] **AC-E029-84**: `allowAllForBrowser` を呼び出し Extension DB が見つからないとき、"Claude extension not found" の警告メッセージが `console.log` で出力されること ← S14
- [ ] **AC-E029-85**: `allowAllForBrowser` を呼び出し DB が存在しブラウザが停止中のとき、全 TLD ワイルドカードが LevelDB に書き込まれ成功メッセージが出力されること ← S14
- [ ] **AC-E029-86**: `allowAllForBrowser` を呼び出し全ワイルドカードが既に存在するとき、"Nothing to do" を含むメッセージが出力されること ← S14（AI 補完: 冪等性チェック）

**インターフェース:** `chrome-allow.ts` の `runChromeAllow / getExtensionDbPath / isBrowserRunning / allowAllForBrowser`（エクスポート追加が必要な関数はテストのために export を追加する）

---

## 設計成果物

| 成果物 | 配置先 | ステータス |
|--------|--------|----------|
| 集約モデル詳細 | 該当なし | 該当なし |
| DB スキーマ骨格 | 該当なし | 該当なし |
| API spec 骨格 | 該当なし | 該当なし |

## バリデーションルール

| フィールド | ルール | エラー時の振る舞い |
|-----------|--------|------------------|
| インスタンス名 | `/^[a-z][a-z0-9-]*$/` | `process.exit(1)` |
| インスタンス名 | "jinn" 禁止（予約名） | `process.exit(1)` |
| インスタンス名 | 重複禁止（レジストリ参照） | `process.exit(1)` |
| ホームディレクトリ | 存在禁止（create 時） | `process.exit(1)` |

## ステータス遷移（該当する場合）

該当なし（テストカバレッジ向上 Epic のためステータス遷移なし）

## エラーケース

| ケース | 条件 | 期待する振る舞い | 説明 |
|--------|------|----------------|------|
| インスタンス名不正 | `runCreate("INVALID")` | process.exit(1) + エラーメッセージ | 小文字英数ハイフンのみ許可 |
| "jinn" 予約名 | `runCreate("jinn")` | process.exit(1) + エラーメッセージ | デフォルトインスタンス保護 |
| インスタンス重複 | 同名が既存 | process.exit(1) + エラーメッセージ | レジストリ整合性保護 |
| 実行中インスタンス削除 | PID 生存中 | process.exit(1) + エラーメッセージ | データ損失防止 |
| classic-level 未インストール | import 失敗 | process.exit(1) + インストール案内 | chrome-allow 前提条件 |
| JINN_HOME 未存在 | start/status 呼び出し | エラーメッセージ（start は exit） | setup 前の起動防止 |
| レジストリ JSON 破損 | 不正 JSON | 空配列にフォールバック | 安定性確保 |

## 非機能要件

| 項目 | 基準 |
|------|------|
| ブランチカバレッジ | `src/cli/` 全体で 90% 以上 |
| テスト実行時間 | 全テスト 30 秒以内（外部コマンド・ファイルシステムはモック） |
| テスト独立性 | 各テストは外部ファイルシステム・プロセス・ネットワークに依存しない |
| モックスコープ | `vi.mock` はファイル最上位で宣言し、各テスト前に `vi.clearAllMocks()` で初期化 |

## デリバリーする価値

| 項目 | 内容 |
|------|------|
| 対象ユーザー/ペルソナ | 後続 Epic の開発者・CI 環境 |
| デリバリーする価値 | `src/cli/` の全モジュールに対して自動テストが整備され、リグレッション検出が可能になる。ブランチカバレッジが 3% から 90% 以上に向上し、Phase 3 の成功基準（90% 達成）に寄与する |
| デモシナリオ | `pnpm test --coverage` を実行し `src/cli/` のブランチカバレッジが 90% 以上と表示されること |

## E2E 検証計画

| 項目 | 内容 |
|------|------|
| 検証シナリオ | 全 AC を vitest の自動テストで検証。`pnpm test --coverage` で `src/cli/` ブランチカバレッジ 90% 以上を確認 |
| 検証環境 | ローカル開発環境。`fs` / `child_process` / `readline` / `os` / `crypto` / `classic-level` は全てモック |
| 前提条件 | `packages/jimmy` の依存パッケージがインストール済み（`pnpm install`）。`vitest.config.ts` に coverage 設定が済んでいること |

## 他 Epic への依存・影響

- **依存**: ES-025（CLI 分割 — `setup-context.ts` / `setup-fs.ts` / `setup-ui.ts` の分割が前提）→ マージ済み
- **影響**: Phase 3 成功基準（branch カバレッジ全体 90%）に直接寄与

## 未決定事項

| # | 事項 | ステータス | 解決先 |
|---|------|----------|--------|
| 1 | `chrome-allow.ts` の `getExtensionDbPath` / `isBrowserRunning` / `quitBrowser` / `openBrowser` が未エクスポートのため、テストのためにエクスポート追加が必要か、または `allowAllForBrowser` / `runChromeAllow` を通じた統合テストで対応するか | 未決定 | Task 実装時に判断。エクスポート追加推奨 |

## 完全性チェック

- [x] 全ストーリーに AC が定義されている
- [x] 正常系・異常系のレスポンスが定義されている
- [x] バリデーションルールが網羅されている
- [x] ステータス遷移が図示されている（該当なし）
- [x] 権限が各操作で明記されている（該当なし — CLI ユーティリティのため）
- [x] 関連 ADR が参照されている（該当なし）
- [x] 非機能要件が定義されている
- [x] 他 Epic への依存・影響が明記されている
- [x] 未決定事項が明示されている
- [x] デリバリーする価値が明記されている（対象ユーザー・価値・デモシナリオ）
- [x] E2E 検証計画が定義されている（検証シナリオ・検証環境・前提条件）
- [x] 全 AC に AC-ID（`AC-E029-NN` 形式）が付与されている
- [x] 対応ストーリーが Phase 定義書から転記されている
- [x] 全 AC にストーリートレース（`← Sn`）が付与されている
- [x] AI 補完の AC には理由が明記されている（`AI 補完: [理由]`）
- [x] 所属 BC が記載されている（該当なし — インフラ/CLI 層）
- [x] 設計成果物セクションが記入されている（該当なしを明記）
