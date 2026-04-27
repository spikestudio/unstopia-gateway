/** OK バリアント */
export type Ok<T> = { readonly ok: true; readonly value: T };

/** Err バリアント */
export type Err<E> = { readonly ok: false; readonly error: E };

/** Result<T, E> — 成功または失敗を表す discriminated union */
export type Result<T, E> = Ok<T> | Err<E>;

/** 成功値を持つ Result を生成する */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** エラー値を持つ Result を生成する */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Result が Ok かどうかを判定する（型ガード） */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/** Result が Err かどうかを判定する（型ガード） */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}
