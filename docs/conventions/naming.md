# 命名規則

技術スタック: TypeScript 5.8 / Node.js 22 / ESM

## 変数・引数

| 対象 | 規則 | 強度 |
|------|------|------|
| 変数・引数 | `camelCase` | MUST |
| Boolean 変数 | `is` / `has` / `can` / `should` で始める | MUST |
| 定数（モジュールスコープ） | `UPPER_SNAKE_CASE` | MUST |
| 一時変数 | 意図を表す名前（`tmp`, `data`, `val` 禁止） | MUST |

```ts
// 正
const isRunning = true;
const hasSession = sessions.size > 0;
const MAX_RETRIES = 2;
const sessionId = uuid();

// 誤
const flag = true;       // Boolean に is/has/can なし
const data = sessions;   // 意味のない名前
const MAXRETRIES = 2;    // アンダースコアなし
const tmp = uuid();      // 一時変数に tmp
```

## 関数・メソッド

| 対象 | 規則 | 強度 |
|------|------|------|
| 関数・メソッド名 | 動詞で始まる `camelCase` | MUST |
| 非同期関数 | `async` を付けるだけでよい（`Async` サフィックス禁止） | MUST |
| イベントハンドラ | `on` + 名詞 + 動詞 or イベント名（例: `onMessage`） | SHOULD |

```ts
// 正
async function runEngine(opts: EngineRunOpts): Promise<EngineResult> {}
function killSession(sessionId: string): void {}
function onMessage(event: MessageEvent): void {}

// 誤
async function engineRunAsync() {}   // Async サフィックス
function session(id: string) {}      // 動詞なし
function handleIt() {}               // 意図不明
```

## クラス・型・インターフェース

| 対象 | 規則 | 強度 |
|------|------|------|
| クラス | `PascalCase` | MUST |
| インターフェース | `PascalCase`（`I` プレフィックス禁止） | MUST |
| 型エイリアス | `PascalCase` | MUST |
| Enum | `PascalCase`、値は `PascalCase` | SHOULD |
| 型パラメータ | `T`, `K`, `V` 等の慣例名 or 意味のある `PascalCase` | SHOULD |

```ts
// 正
class ClaudeEngine implements InterruptibleEngine {}
interface Engine { name: string; run(...): Promise<EngineResult> }
type StreamDeltaType = "text" | "tool_use" | "error";

// 誤
class claudeEngine {}         // PascalCase でない
interface IEngine {}          // I プレフィックス
type streamDeltaType = ...;   // camelCase
```

## ファイル名・ディレクトリ名

| 対象 | 規則 | 強度 |
|------|------|------|
| ソースファイル | `kebab-case.ts` | MUST |
| テストファイル | `kebab-case.test.ts` | MUST |
| ディレクトリ | `kebab-case` | MUST |
| ESM import 拡張子 | `.js` を付ける（TypeScript ESM の要件） | MUST |

```ts
// 正
import { ClaudeEngine } from "./engines/claude.js";
import type { EngineResult } from "../shared/types.js";

// 誤
import { ClaudeEngine } from "./engines/claude";   // .js なし（ESM で動かない）
import { ClaudeEngine } from "./engines/Claude";   // PascalCase ファイル
```

## Engine / Connector 固有

| 対象 | 規則 |
|------|------|
| エンジン名 | 小文字単語（`claude`, `codex`, `gemini`, `antigravity`） |
| コネクター名 | 小文字単語（`slack`, `discord`, `telegram`, `whatsapp`） |
| エンジンクラス名 | `[Name]Engine`（例: `ClaudeEngine`, `CodexEngine`） |
| コネクタークラス名 | `[Name]Connector`（例: `SlackConnector`） |
