# ADR-002: アーキテクチャ方針

| 項目 | 内容 |
|------|------|
| ステータス | 承認済み |
| 日付 | 2026-04-22 |
| 決定者 | sanojimaru |

## コンテキスト

jinn の「bus, not brain」哲学を継承しつつ、独自拡張（記憶システム・多層スキル管理・新エンジン）を追加する際のアーキテクチャ方針を定める。

## 決定

### コアアーキテクチャ方針: Bus, not brain

jinn のアーキテクチャ哲学を継承する。
**Gateway 自体は AI ロジックを持たない。** 全ての知性は Engine（Claude Code / Codex / Gemini）に委譲する。

```
Connector → Gateway → Session → Engine (Claude/Codex/Gemini/Antigravity)
                 ↓
            Memory (クロスカット)
```

### レイヤー構成

| レイヤー | 責務 | 場所 |
|---------|------|------|
| Engine | AI CLI のラッパー。`InterruptibleEngine` を実装 | `packages/jimmy/src/engines/` |
| Connector | プラットフォーム固有のメッセージ送受信 | `packages/jimmy/src/connectors/` |
| Session | 会話状態管理・コスト追跡・FIFO キュー | `packages/jimmy/src/sessions/` |
| Gateway | HTTP API・WebSocket・ルーティング | `packages/jimmy/src/gateway/` |
| Memory | クロスセッション記憶（Phase 1 追加予定） | `packages/jimmy/src/memory/` |

### 拡張方針

**既存アーキテクチャとの互換性を維持する。**

1. 新エンジンは `InterruptibleEngine` インターフェースを実装して追加
2. 新機能は独立モジュール（`memory/`, `multi-skill/`）として追加
3. jinn オリジナルの public API への破壊的変更は行わない

### エンジンインターフェース

```typescript
interface InterruptibleEngine extends Engine {
  name: string;
  run(opts: EngineRunOpts): Promise<EngineResult>;
  kill(sessionId: string, reason?: string): void;
  isAlive(sessionId: string): boolean;
  killAll(): void;
}
```

新エンジン追加時はこのインターフェースを実装し `packages/jimmy/src/engines/<name>.ts` に配置する。

### 記憶システム方針（Phase 1）

3層構造で設計する:

| 層 | 内容 | 実装 |
|----|------|------|
| Working Memory | 現セッション内の文脈（既存 SQLite） | 変更なし |
| Episodic Memory | クロスセッションの事実・出来事 | LevelDB (classic-level) |
| Semantic Memory | ベクトル検索による関連記憶検索 | LevelDB + 埋め込みベクトル |

## 結果

- jinn との互換性を保ちつつ拡張できる
- 新機能は独立モジュールとして分離されるため、アップストリームへの追従が容易
- `InterruptibleEngine` インターフェースにより、エンジン追加の影響範囲が限定される

## 関連

- `packages/jimmy/src/shared/types.ts` — `InterruptibleEngine` インターフェース定義
- `docs/architecture/adr/ADR-001-tech-stack.md` — 技術スタック選定
