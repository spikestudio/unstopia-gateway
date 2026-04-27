# エラーハンドリング方針

<!-- TODO: プロジェクトに合わせて記述してください -->

## 基本方針

- エラーは呼び出し元に伝播させる（サイレントに握りつぶさない）
- トランジェントエラー（ECONNRESET / タイムアウト等）はエンジン層でリトライ
- 致命的エラーはログを残してプロセスを継続（daemon なのでクラッシュさせない）

## ログレベル

- `logger.error`: 回復不可能なエラー
- `logger.warn`: 回復可能だが注意が必要
- `logger.info`: 通常の動作ログ
- `logger.debug`: デバッグ用詳細ログ

## Result<T, E> パターン

Phase 2（ES-021）から `shared/result.ts` の `Result<T, E>` 型を段階的に導入する。

### いつ Result を使うか

| ケース | 推奨 |
|--------|------|
| Repository 操作（DB I/O） | `Result<T, RepositoryError>` |
| 外部 API 呼び出し | `Result<T, AppError>` |
| 内部ユーティリティ（純粋関数） | 通常の return / throw で可 |
| Engine 実行の成功/失敗境界 | `Result<EngineResult, EngineError>` |

### 基本パターン

```typescript
import { ok, err, type Result } from "../shared/result.js";
import { type AppError, appError } from "../shared/errors.js";

async function fetchData(id: string): Promise<Result<Data, AppError>> {
  try {
    const data = await repository.findById(id);
    return ok(data);
  } catch (cause) {
    return err(appError("FETCH_FAILED", `fetchData failed: ${id}`, cause));
  }
}

// 呼び出し元
const result = await fetchData("123");
if (result.ok) {
  console.log(result.value);
} else {
  logger.error(result.error.message);
}
```

### 移行方針

- **新規コード**: Result パターンを優先する
- **既存コード**: 段階的移行。Repository 境界（ES-021）→ Engine 境界（将来 Epic）の順
- **禁止事項**: `result.value!`（非 null アサーション）は使用しない。`if (result.ok)` でナローイングすること
