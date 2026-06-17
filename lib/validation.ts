/**
 * Per-platform username validators. Each returns true when the handle could
 * plausibly exist on that platform. When a handle is invalid we skip the
 * network call entirely and report "unknown" with reason "invalid format".
 *
 * Rules are based on each platform's published handle constraints.
 */

const lengthOk = (u: string, min: number, max: number) =>
  u.length >= min && u.length <= max;

export const validators = {
  // 1–39 chars, alphanumeric or single hyphens, no leading/trailing/double hyphen.
  github: (u: string) =>
    lengthOk(u, 1, 39) && /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*$/.test(u),

  // 3–20 chars: letters, digits, underscores, hyphens.
  reddit: (u: string) => lengthOk(u, 3, 20) && /^[a-zA-Z0-9_-]+$/.test(u),

  // Handles: 3–30 chars: letters, digits, underscores, periods.
  youtube: (u: string) => lengthOk(u, 3, 30) && /^[a-zA-Z0-9._]+$/.test(u),

  // 2–24 chars: letters, digits, underscores, periods.
  tiktok: (u: string) => lengthOk(u, 2, 24) && /^[a-zA-Z0-9._]+$/.test(u),

  // 1–15 chars: letters, digits, underscores.
  x: (u: string) => lengthOk(u, 1, 15) && /^[a-zA-Z0-9_]+$/.test(u),

  // 1–30 chars: letters, digits, underscores, periods.
  instagram: (u: string) => lengthOk(u, 1, 30) && /^[a-zA-Z0-9._]+$/.test(u),

  // Same constraints as Instagram (Threads uses the Instagram identity).
  threads: (u: string) => lengthOk(u, 1, 30) && /^[a-zA-Z0-9._]+$/.test(u),

  // 4–25 chars: letters, digits, underscores.
  twitch: (u: string) => lengthOk(u, 4, 25) && /^[a-zA-Z0-9_]+$/.test(u),
} as const;

/**
 * A loose top-level sanity check for the raw query before we hand it to any
 * adapter. Keeps obviously-bogus input out of the pipeline.
 */
export function isPlausibleHandle(u: string): boolean {
  return u.length > 0 && u.length <= 50 && /^[a-zA-Z0-9._-]+$/.test(u);
}

/** Normalize user input: trim, drop a leading "@", lowercase is NOT applied. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}
