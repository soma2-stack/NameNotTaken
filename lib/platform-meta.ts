/**
 * Client-safe list of the platforms we check, in display order. Used to render
 * per-row loading placeholders before the API responds. Keep in sync with the
 * adapter registry in platforms.ts.
 */
export interface PlatformMeta {
  name: string;
  tier: "A" | "B";
}

export const PLATFORM_META: PlatformMeta[] = [
  { name: "GitHub", tier: "A" },
  { name: "Reddit", tier: "A" },
  { name: "YouTube", tier: "A" },
  { name: "TikTok", tier: "B" },
  { name: "X", tier: "B" },
  { name: "Instagram", tier: "B" },
  { name: "Threads", tier: "B" },
  { name: "Twitch", tier: "B" },
];
