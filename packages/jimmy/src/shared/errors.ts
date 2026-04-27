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

/** Repository 操作のエラーコード */
export type RepositoryErrorCode = "NOT_FOUND" | "CONSTRAINT_VIOLATION" | "UNKNOWN";

/** Repository 操作に特化したエラー型 */
export interface RepositoryError extends AppError {
  readonly code: RepositoryErrorCode;
}

/** RepositoryError を生成するファクトリ */
export function repositoryError(code: RepositoryErrorCode, message: string, cause?: unknown): RepositoryError {
  return { code, message, ...(cause !== undefined ? { cause } : {}) };
}
