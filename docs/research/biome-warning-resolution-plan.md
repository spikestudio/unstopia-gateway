# Biome 警告解消計画

作成日: 2026-04-22
現状: 555件の警告（エラーなし）

## サマリー

| グループ | Issue | 件数 | 工数 | 優先度 |
|---------|-------|------|------|--------|
| G1: 自動修正 | #12 | ~116件 | XS | 高（即座に実行可能） |
| G2: any 型除去 | #13 | ~122件 | L | 中（型定義設計が必要） |
| G3: null 安全化 | #14 | ~67件 | M | 中（パターンが明確） |
| G4: アクセシビリティ | #15 | ~206件 | L | 低（Web UI 専用） |
| G5: React 品質 | #16 | ~44件 | S | 中（バグリスクあり） |
| **合計** | | **555件** | | |

## 推奨実施順序

```
G1 (XS) → G5 (S) → G3 (M) → G2 (L) → G4 (L)
```

### 理由

1. **G1 を先に**: `biome --write` で即座に 116件削減。他グループのノイズが減る
2. **G5 次**: hooks deps 修正はバグ修正の意味合いあり。早めに対応
3. **G3**: `!` 演算子の置換はパターンが明確で機械的に進められる
4. **G2**: `any` → 型定義は設計判断が伴う。コードベース理解が深まってから
5. **G4 は後回し**: Web UI の a11y は機能要件ではなく品質向上。Phase 実装後に対応

## グループ別詳細

### G1: 自動修正 (~116件) — Issue #12

`biome check --write` で解消可能。

| ルール | 件数 | 修正内容 |
|--------|------|---------|
| `useLiteralKeys` | 39 | `obj["key"]` → `obj.key` |
| `useTemplate` | 37 | 文字列連結 → テンプレートリテラル |
| `useOptionalChain` | 19 | `x && x.y` → `x?.y` |
| `noGlobalIsNan` | 15 | `isNaN()` → `Number.isNaN()` |
| `noConfusingVoidType` | 6 | union 型内の `void` を除去 |

### G2: any 型除去 (~122件) — Issue #13

| ルール | 件数 | 対象 |
|--------|------|------|
| `noExplicitAny` | 119 | jimmy 114件 / web 8件 |
| `noImplicitAnyLet` | 2 | - |
| `noBannedTypes` | 1 | `{}` 型 |

置換戦略:
- JSON パース: `unknown` + 型ガード
- エラーキャッチ: `catch` のみ（TypeScript 4+ では `err` 型不要）
- 外部 API レスポンス: インターフェース定義
- 汎用コールバック: 具体的な引数型

### G3: null 安全化 (~67件) — Issue #14

| ルール | 件数 | 対象 |
|--------|------|------|
| `noNonNullAssertion` | 63 | jimmy 28件 / web 35件 |
| `noAssignInExpressions` | 4 | web |

### G4: アクセシビリティ (~206件) — Issue #15

Web ダッシュボード (`packages/web`) のみ。機能要件ではなく品質向上。

最多: `useButtonType` (115件) → `<button type="button">` に統一

### G5: React 品質 (~44件) — Issue #16

| ルール | 件数 | リスク |
|--------|------|-------|
| `useExhaustiveDependencies` | 20 | 中（deps 変更で動作変化の可能性） |
| `noArrayIndexKey` | 15 | 低（安定 key への置換） |
| `noConsole` | 6 | 低（logger への置換） |
| `noUnusedFunctionParameters` | 2 | 低 |
| `noGlobalIsFinite` | 1 | 低 |

`useExhaustiveDependencies` は依存配列追加により無限ループのリスクあり。修正後は必ず動作確認すること。

## 計測ベースライン (2026-04-22)

```
Jimmy:  237 warnings
Web:    318 warnings
Total:  555 warnings
Errors: 0
```
