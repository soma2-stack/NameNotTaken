import type { CheckResult } from "./types";

/**
 * Tiny in-memory TTL cache. This is purely an optional optimization to avoid
 * hammering upstream platforms when the same handle is checked repeatedly.
 *
 * On serverless platforms (e.g. Vercel) this lives only for the lifetime of a
 * warm instance — there is no shared/persistent store, and that is fine.
 */

interface Entry {
  value: CheckResult;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const store = new Map<string, Entry>();

const key = (platform: string, username: string) =>
  `${platform}::${username.toLowerCase()}`;

export function getCached(platform: string, username: string): CheckResult | null {
  const entry = store.get(key(platform, username));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key(platform, username));
    return null;
  }
  return entry.value;
}

export function setCached(
  platform: string,
  username: string,
  value: CheckResult
): void {
  // Never cache "unknown" — those are transient (timeouts, blocks, rate limits)
  // and should be retried on the next request.
  if (value.status === "unknown") return;
  store.set(key(platform, username), { value, expiresAt: Date.now() + TTL_MS });
}
