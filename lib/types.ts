export type Status = "available" | "taken" | "unknown";

export type Tier = "A" | "B";

export interface CheckResult {
  /** Display name of the platform, e.g. "GitHub". */
  platform: string;
  /** Outcome of the check. */
  status: Status;
  /** Short human description of how the result was determined. */
  checkedVia: string;
  /** Public profile URL for the handle (used for manual verification). */
  profileUrl: string;
  /** Optional explanation, e.g. "invalid format" or "rate limited". */
  reason?: string;
}

export interface PlatformAdapter {
  /** Display name. */
  name: string;
  /** "A" = real check, "B" = best-effort (may return unknown). */
  tier: Tier;
  /** Build the public profile URL for a username. */
  profileUrl: (username: string) => string;
  /** Validate the username against this platform's rules. */
  validate: (username: string) => boolean;
  /** Perform the availability check. Must never throw. */
  check: (username: string) => Promise<CheckResult>;
}
