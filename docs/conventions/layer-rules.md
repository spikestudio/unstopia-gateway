# レイヤー間のルール

技術スタック: TypeScript 5.8 / Node.js 22 / ESM

## 依存方向

```
Connector ──→ Gateway ──→ Session ──→ Engine
                 │                      ↑
                 └──→ Memory (クロスカット、読み取りのみ)
                 │
                 └──→ Cron

shared/ (型・ユーティリティ) ← 全レイヤーから参照可
```

- 矢印の逆方向の import は禁止（MUST）
- Engine は Connector / Gateway / Session に依存しない（MUST）
- Memory は全レイヤーから読み取り可能だが、書き込みは Session 経由（SHOULD）

## レイヤー別 import 可能範囲

| レイヤー | import 可能 | import 禁止 |
|---------|------------|------------|
| `engines/` | `shared/` のみ | `connectors/`, `sessions/`, `gateway/` |
| `sessions/` | `shared/`, `engines/` | `connectors/`, `gateway/` |
| `gateway/` | `shared/`, `engines/`, `sessions/`, `cron/`, `mcp/` | `connectors/`（逆参照） |
| `connectors/` | `shared/`, `gateway/`（API 経由のみ） | `engines/`, `sessions/` 直接参照 |
| `shared/` | Node.js 標準ライブラリのみ | プロジェクト内の他レイヤー |

```ts
// 正: engines/ は shared/ のみ参照
// packages/jimmy/src/engines/claude.ts
import type { EngineRunOpts, EngineResult } from "../shared/types.js";
import { logger } from "../shared/logger.js";

// 誤: engines/ が sessions/ を参照
import { SessionRegistry } from "../sessions/registry.js"; // ← 禁止
```

## インターフェースによる抽象化（DI）

外部依存（子プロセス・DB・ファイルシステム）はインターフェースで抽象化し、
コンストラクタ injection で渡す（MUST）。直接インスタンス化はテスト不可能なため禁止。

```ts
// 正: インターフェース経由で注入
class SessionManager {
  constructor(private registry: SessionRegistry) {}
}

// 誤: 内部で直接インスタンス化
class SessionManager {
  private registry = new SessionRegistry(); // ← テスト不可
}
```

## レイヤーをまたぐデータの受け渡し

- `shared/types.ts` で定義された型を使う（MUST）
- レイヤー間で生オブジェクト (`any`, `object`) を渡さない（MUST）
- Connector → Gateway はイベントオブジェクト（`IncomingMessage` 等）で渡す
- Gateway → Engine は `EngineRunOpts` 型で渡す
- Engine → Gateway は `EngineResult` 型で返す

```ts
// 正: 型付きインターフェース経由
async function run(opts: EngineRunOpts): Promise<EngineResult>

// 誤: any で渡す
async function run(opts: any): Promise<any>
```

## 単一責任（SRP）

1ファイル1パブリッククラス / 1関数1目的（SHOULD）。以下の兆候があれば分割を検討:

- ファイルが 300 行を超える
- 外部依存の import が 5 つを超える
- 関数名に `And` / `Or` が含まれる（例: `validateAndSave`）
