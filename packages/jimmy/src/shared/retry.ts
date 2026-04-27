/**
 * Compute exponential backoff delay in milliseconds.
 * delay = min(baseMs * 2^attempt, maxMs)
 */
export function exponentialBackoffMs(attempt: number, baseMs: number, maxMs: number): number {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}

/**
 * Retry an async operation with exponential backoff.
 * Returns the result on success, throws on final failure.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; baseMs: number; maxMs: number; onRetry?: (attempt: number, err: unknown) => void },
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < opts.maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < opts.maxAttempts - 1) {
        opts.onRetry?.(i, err);
        await new Promise((r) => setTimeout(r, exponentialBackoffMs(i, opts.baseMs, opts.maxMs)));
      }
    }
  }
  throw lastErr;
}
