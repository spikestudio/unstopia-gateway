/** アプリケーション共通エラー型 */
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}

/** AppError を生成するファクトリ */
export function appError(code: string, message: string, cause?: unknown): AppError {
  return { code, message, ...(cause !== undefined ? { cause } : {}) };
}
