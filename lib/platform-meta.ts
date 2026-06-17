import type { Tier } from "./types";

export type PlatformMeta = {
  name: string;
  tier: Tier;
  initials: string;
  displayUrl: (username: string) => string;
};

export type DomainMeta = {
  name: string;
  extension: ".com" | ".io";
  initials: string;
};

// Kept client-safe on purpose: the server adapters import network and Node APIs.
export const PLATFORM_META: PlatformMeta[] = [
  {
    name: "GitHub",
    tier: "A",
    initials: "GH",
    displayUrl: (username) => `github.com/${username}`,
  },
  {
    name: "Reddit",
    tier: "A",
    initials: "Rd",
    displayUrl: (username) => `reddit.com/user/${username}`,
  },
  {
    name: "YouTube",
    tier: "A",
    initials: "YT",
    displayUrl: (username) => `youtube.com/@${username}`,
  },
  {
    name: "TikTok",
    tier: "B",
    initials: "TT",
    displayUrl: (username) => `tiktok.com/@${username}`,
  },
  {
    name: "X",
    tier: "B",
    initials: "X",
    displayUrl: (username) => `x.com/${username}`,
  },
  {
    name: "Instagram",
    tier: "B",
    initials: "IG",
    displayUrl: (username) => `instagram.com/${username}`,
  },
  {
    name: "Threads",
    tier: "B",
    initials: "Th",
    displayUrl: (username) => `threads.net/@${username}`,
  },
  {
    name: "Twitch",
    tier: "B",
    initials: "TW",
    displayUrl: (username) => `twitch.tv/${username}`,
  },
];

export const DOMAIN_META: DomainMeta[] = [
  { name: "Domain .com", extension: ".com", initials: ".com" },
  { name: "Domain .io", extension: ".io", initials: ".io" },
];
