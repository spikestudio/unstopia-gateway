# リサーチ: コードベース複雑度分析と DI 化方針

| 項目 | 内容 |
|------|------|
| 調査日 | 2026-04-25 |
| 調査目的 | リファクタリング・DI 化の優先ターゲットと実施方針を根拠付きで決定する |
| リサーチ種別 | コードベース分析 + 技術選定 |
| 依頼元 | ユーザー直接 |

---

## 1. 複雑度ランキング（本番コードのみ）

計測指標: 行数 / import 数 / 条件分岐数（if・switch・else・case の合計）

| 順位 | ファイル | 行数 | import 数 | 条件分岐数 | 複雑度評価 |
|------|---------|------|-----------|-----------|-----------|
| 🔴 1 | `gateway/api.ts` | 2668 | 26 | 310 | **最高** — 単一ファイルに全 API ルートが集中 |
| 🔴 2 | `sessions/manager.ts` | 982 | 15 | 89 | **高** — DI の主要ターゲット |
| 🔴 3 | `engines/claude.ts` | 622 | 4 | 89 | **高** — ストリーミング処理の条件分岐が多い |
| 🟡 4 | `gateway/server.ts` | 779 | 27 | 76 | **中高** — import が最多、Composition Root 候補 |
| 🟡 5 | `sessions/context.ts` | 825 | 6 | 59 | **中高** — 関数数 16、コンテキスト構築ロジックが密集 |
| 🟡 6 | `sessions/registry.ts` | 698 | 7 | 25 | **中** — 関数数 33、SQLite 操作が集中 |
| 🟢 7 | `mcp/gateway-server.ts` | 420 | 1 | — | **低** — import 少、機能集中 |
| 🟢 8 | `cli/setup.ts` | 539 | 9 | — | **低中** — CLI コマンド、単体テスト容易 |

---

## 2. 循環依存の詳細マップ

`import type` により TypeScript の型レベルでは緩和されているが、実行時の依存グラフとしては以下の3サイクルが存在する。

### サイクル A: gateway ⟷ sessions（最重要）

```
gateway/server.ts
  → sessions/manager.ts        ← SessionManager の生成・利用
  → sessions/registry.ts       ← DB 操作

sessions/manager.ts
  → gateway/budgets.ts         ← セッション実行前の予算チェック
```

**問題:** `gateway/server.ts` が `SessionManager` を生成・管理しているが、`SessionManager` は予算チェックのために `gateway/budgets` を呼び出す。責務の境界が曖昧。

### サイクル B: cron ⟷ sessions

```
cron/runner.ts
  → sessions/manager.ts        ← SessionManager 型参照・呼び出し
cron/scheduler.ts
  → sessions/manager.ts        ← SessionManager 型参照

sessions/manager.ts
  → cron/jobs.ts               ← Cron ジョブ定義の参照
  → cron/scheduler.ts          ← Cron スケジューラー操作
```

**問題:** Cron がセッションを開始し、セッションが Cron を操作する相互依存。

### サイクル C: cron → gateway（一方向だが gateway のサイクルを増幅）

```
cron/runner.ts
  → gateway/org.ts             ← 組織・従業員の検索
```

**問題:** Cron ジョブの実行時に「どの従業員に送るか」を解決するために `gateway/org` を参照。Cron が Gateway に依存している。

### 依存グラフ全体

```
shared/  (基盤層 — 依存なし)
  ↑
engines/ ←── claude / codex / gemini / mock
connectors/ ←── telegram / slack / discord / whatsapp / cron
mcp/
stt/
  ↑
cron/ ⟷ sessions/ ⟷ gateway/ ← cli/
  ↑──────────────────┘
       (3 サイクル)
```

---

## 3. DI パターン選択肢の比較

### 選択肢

| 手法 | デコレータ要否 | ESM 互換 | 学習コスト | バンドル増加 | メンテナンス |
|------|-------------|----------|-----------|-------------|------------|
| **手動 DI** | 不要 | ✅ 完全 | 低 | ゼロ | 不要 |
| **Awilix** | 不要 | ✅ 完全 | 中 | 小（~15KB） | 活発 |
| **tsyringe** | 必要（`experimentalDecorators`） | ⚠️ 要確認 | 低中 | 中 | 安定 |
| **InversifyJS** | 必要 | ⚠️ 要確認 | 中高 | 大 | 中程度 |
| **Effect** | 不要 | ✅ 完全 | **高** | 大 | 活発 |

### 本プロジェクトへの適合評価

本プロジェクトは:
- `experimentalDecorators` 未使用
- ESM（`.js` 拡張子 import）
- クラスベース（`SessionManager` 等）+ 関数ベース混在
- モジュール数は ~10（大規模 DI フレームワーク不要）

→ **デコレータ系（tsyringe / InversifyJS）は設定変更コストが高く不適**。Effect は既存設計との衝突が大きい。

---

## 4. 推薦アクション

### フェーズ 1: 手動 DI の導入（低コスト・即効性高）

**対象: `gateway/server.ts` を Composition Root に昇格**

現状 `server.ts` でエンジン・コネクター・SessionManager を生成しているが、依存が散在している。明示的な Composition Root パターンを導入し、全依存を1箇所で組み立てる。

```typescript
// Before: server.ts で直接 new
const manager = new SessionManager(config, engines, connectorNames);

// After: composition-root.ts で一元管理
function buildContainer(config: JinnConfig) {
  const engines = buildEngines(config);
  const connectors = buildConnectors(config);
  const manager = new SessionManager(config, engines, connectors);
  return { manager, engines, connectors };
}
```

**効果:** 循環依存サイクル A（gateway ⟷ sessions）の起点を明確化。テストで差し替え可能に。

### フェーズ 2: `gateway/api.ts` の分割（最優先・効果最大）

2668 行・310 条件分岐は単一ファイルとして限界を超えている。以下の4ドメインに分割する:

| 新ファイル | 担当 API |
|---------|---------|
| `gateway/api/sessions-api.ts` | セッション CRUD・実行・ストリーミング |
| `gateway/api/org-api.ts` | 組織・従業員・部署管理 |
| `gateway/api/files-api.ts` | ファイルアップロード・管理 |
| `gateway/api/skills-api.ts` | スキル管理・検索 |

**効果:** テスト容易性向上、PR レビュー負荷軽減、各 API の独立変更が可能に。

### フェーズ 3: 循環依存の解消

**サイクル A（gateway ⟷ sessions）解消方針:**

`BudgetChecker` インターフェースを `shared/types.ts` に定義し、`sessions/manager.ts` は実装に依存しない:

```typescript
// shared/types.ts に追加
export interface BudgetChecker {
  checkBudget(employeeId: string, cost: number): Promise<boolean>;
}

// sessions/manager.ts — gateway への直接依存を除去
constructor(config, engines, budgetChecker: BudgetChecker) { ... }

// gateway/server.ts — 実装を注入
const manager = new SessionManager(config, engines, new GatewayBudgetChecker(config));
```

**サイクル B（cron ⟷ sessions）解消方針:**

`SessionRunner` インターフェースを分離し、Cron は SessionManager 本体ではなくインターフェースに依存:

```typescript
// shared/types.ts に追加
export interface SessionRunner {
  run(opts: SessionRunOpts): Promise<void>;
}
```

### 優先順位まとめ

| 優先度 | アクション | 工数感 | 効果 |
|--------|---------|--------|------|
| ⭐⭐⭐ | `gateway/api.ts` を4ファイルに分割 | 中 | 最大（可読性・テスト容易性） |
| ⭐⭐⭐ | `gateway/server.ts` を Composition Root 化 | 小 | DI 基盤の確立 |
| ⭐⭐ | サイクル A 解消（BudgetChecker インターフェース抽出） | 中 | 循環依存の根本解消 |
| ⭐⭐ | `sessions/manager.ts` の責務分離（EngineRunner 抽出） | 中 | テスト容易性 |
| ⭐ | Awilix 導入（モジュール数増加後） | 中 | DI 自動化 |

---

## 5. リスクと注意点

| リスク | 内容 | 対策 |
|--------|------|------|
| リグレッション | `api.ts` 分割時の API 動作変更 | 分割前に統合テストを追加、段階的に移行 |
| 循環依存の深さ | madge で検出できない動的 require | `npx madge --circular --extensions ts src/` で事前計測 |
| テストカバレッジ低下 | リファクタリング後に閾値を下回る | 分割単位でカバレッジを計測しながら進める |
| Awilix の ESM 互換 | Named exports との衝突 | `awilix` v10+ は ESM 対応済みを確認済み |

---

## ソース

- [LogRocket: Top 5 TypeScript DI containers](https://blog.logrocket.com/top-five-typescript-dependency-injection-containers/) — 参照日: 2026-04-25
- [npm-compare: awilix vs inversify vs tsyringe](https://npm-compare.com/awilix,inversify,tsyringe) — 参照日: 2026-04-25
- [Awilix GitHub](https://github.com/jeffijoe/awilix) — 参照日: 2026-04-25
- [Medium: Fixing Circular Dependencies in TypeScript](https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de) — 参照日: 2026-04-25
- コードベース実測値（`wc -l`, `grep -c` による計測）— 2026-04-25
