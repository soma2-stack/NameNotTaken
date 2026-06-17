/** A realistic desktop browser User-Agent. Some platforms reject obvious bots. */
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const DEFAULT_TIMEOUT_MS = 5000;

/**
 * fetch() wrapper that enforces a hard timeout and always sends a realistic
 * User-Agent. Throws on timeout (AbortError) or network failure; callers are
 * expected to catch and degrade to "unknown".
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
        ...(init.headers ?? {}),
      },
      // We never want Next.js to cache these probes.
      cache: "no-store",
      redirect: init.redirect ?? "manual",
    });
  } finally {
    clearTimeout(timer);
  }
}
