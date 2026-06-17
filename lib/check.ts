import { adapters } from "./platforms";
import { getCached, setCached } from "./cache";
import type { CheckResult, PlatformAdapter } from "./types";

/**
 * Run a single adapter safely:
 *  1. invalid handle  → "unknown" + "invalid format" (no network call)
 *  2. cache hit       → return cached result
 *  3. otherwise       → run the check, catching every error → "unknown"
 */
export async function runAdapter(
  adapter: PlatformAdapter,
  username: string
): Promise<CheckResult> {
  if (!adapter.validate(username)) {
    return {
      platform: adapter.name,
      status: "unknown",
      checkedVia: "validation",
      profileUrl: adapter.profileUrl(username),
      reason: "invalid format",
    };
  }

  const cached = getCached(adapter.name, username);
  if (cached) return cached;

  try {
    const res = await adapter.check(username);
    setCached(adapter.name, username, res);
    return res;
  } catch (err) {
    // Timeouts (AbortError) and network failures all land here.
    const reason =
      err instanceof Error && err.name === "AbortError" ? "timeout" : "network error";
    return {
      platform: adapter.name,
      status: "unknown",
      checkedVia: "error",
      profileUrl: adapter.profileUrl(username),
      reason,
    };
  }
}

/** Check a username across every platform concurrently. */
export async function checkAll(username: string): Promise<CheckResult[]> {
  return Promise.all(adapters.map((a) => runAdapter(a, username)));
}
