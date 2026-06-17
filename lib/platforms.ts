import { fetchWithTimeout, USER_AGENT } from "./http";
import { validators } from "./validation";
import type { CheckResult, PlatformAdapter, Status } from "./types";

/** Build a CheckResult tersely. */
function result(
  platform: string,
  status: Status,
  checkedVia: string,
  profileUrl: string,
  reason?: string
): CheckResult {
  return { platform, status, checkedVia, profileUrl, reason };
}

const enc = encodeURIComponent;

/* -------------------------------------------------------------------------- */
/*  Tier A — real checks                                                       */
/* -------------------------------------------------------------------------- */

const github: PlatformAdapter = {
  name: "GitHub",
  tier: "A",
  profileUrl: (u) => `https://github.com/${u}`,
  validate: validators.github,
  check: async (u) => {
    const url = github.profileUrl(u);
    const res = await fetchWithTimeout(
      `https://api.github.com/users/${enc(u)}`,
      { headers: { Accept: "application/vnd.github+json" }, redirect: "follow" }
    );
    if (res.status === 404) return result("GitHub", "available", "GitHub API", url);
    if (res.status === 200) return result("GitHub", "taken", "GitHub API", url);
    if (res.status === 403 || res.status === 429)
      return result("GitHub", "unknown", "GitHub API", url, "rate limited");
    return result("GitHub", "unknown", "GitHub API", url, `http ${res.status}`);
  },
};

const reddit: PlatformAdapter = {
  name: "Reddit",
  tier: "A",
  profileUrl: (u) => `https://www.reddit.com/user/${u}`,
  validate: validators.reddit,
  check: async (u) => {
    const url = reddit.profileUrl(u);
    const res = await fetchWithTimeout(
      `https://www.reddit.com/user/${enc(u)}/about.json`,
      { redirect: "follow" }
    );
    if (res.status === 404)
      return result("Reddit", "available", "Reddit API", url);
    if (res.status === 429)
      return result("Reddit", "unknown", "Reddit API", url, "rate limited");
    if (res.status === 200) {
      const data = (await res.json().catch(() => null)) as
        | { data?: { name?: string }; error?: number }
        | null;
      // A real account returns { kind, data: { name, ... } }.
      if (data && !data.error && data.data && data.data.name)
        return result("Reddit", "taken", "Reddit API", url);
      // 200 with an error body / no account payload means it's free.
      return result("Reddit", "available", "Reddit API", url);
    }
    return result("Reddit", "unknown", "Reddit API", url, `http ${res.status}`);
  },
};

const youtube: PlatformAdapter = {
  name: "YouTube",
  tier: "A",
  profileUrl: (u) => `https://www.youtube.com/@${u}`,
  validate: validators.youtube,
  check: async (u) => {
    const url = youtube.profileUrl(u);
    const res = await fetchWithTimeout(`https://www.youtube.com/@${enc(u)}`, {
      redirect: "follow",
    });
    if (res.status === 404)
      return result("YouTube", "available", "youtube.com", url);
    if (res.status === 200) {
      const body = await res.text().catch(() => "");
      // Guard against soft-200 error pages: only call it "taken" when the page
      // actually resolves to a channel. A real handle page links to a canonical
      // /channel/UC... URL and carries a channelId.
      const hasChannel =
        /\/channel\/UC[\w-]{20,}/.test(body) || /"channelId":"UC[\w-]{20,}"/.test(body);
      const looksLikeError =
        /"status":"ERROR"/.test(body) ||
        /This page isn['’&#x27;]*t available/i.test(body);
      if (hasChannel && !looksLikeError)
        return result("YouTube", "taken", "youtube.com", url);
      if (looksLikeError)
        return result("YouTube", "available", "youtube.com", url);
      return result("YouTube", "unknown", "youtube.com", url, "ambiguous page");
    }
    return result("YouTube", "unknown", "youtube.com", url, `http ${res.status}`);
  },
};

/* -------------------------------------------------------------------------- */
/*  Tier B — best-effort (never guesses; degrades to "unknown")               */
/* -------------------------------------------------------------------------- */

/**
 * Shared conservative scraper for bot-hostile platforms. Returns "available"
 * only on an unambiguous 404, "taken" only when a profile marker is present,
 * and "unknown" for everything else (blocks, login walls, JS-only shells).
 */
async function bestEffortScrape(
  platform: string,
  fetchUrl: string,
  profileUrl: string,
  takenMarkers: RegExp[],
  notFoundMarkers: RegExp[] = []
): Promise<CheckResult> {
  const res = await fetchWithTimeout(fetchUrl, { redirect: "manual" });

  if (res.status === 404)
    return result(platform, "available", "best-effort scrape", profileUrl);

  // Redirect to a login/consent wall → we genuinely can't tell.
  if (res.status >= 300 && res.status < 400)
    return result(platform, "unknown", "best-effort scrape", profileUrl, "redirected");

  if (res.status === 429 || res.status === 403)
    return result(platform, "unknown", "best-effort scrape", profileUrl, "blocked");

  if (res.status === 200) {
    const body = await res.text().catch(() => "");
    if (notFoundMarkers.some((re) => re.test(body)))
      return result(platform, "available", "best-effort scrape", profileUrl);
    if (takenMarkers.some((re) => re.test(body)))
      return result(platform, "taken", "best-effort scrape", profileUrl);
    return result(platform, "unknown", "best-effort scrape", profileUrl, "ambiguous");
  }

  return result(platform, "unknown", "best-effort scrape", profileUrl, `http ${res.status}`);
}

const tiktok: PlatformAdapter = {
  name: "TikTok",
  tier: "B",
  profileUrl: (u) => `https://www.tiktok.com/@${u}`,
  validate: validators.tiktok,
  check: (u) =>
    bestEffortScrape(
      "TikTok",
      `https://www.tiktok.com/@${enc(u)}`,
      tiktok.profileUrl(u),
      [/"uniqueId":"/, /"userInfo":/],
      [/"statusCode":10202/, /Couldn['’]t find this account/i]
    ),
};

const x: PlatformAdapter = {
  name: "X",
  tier: "B",
  profileUrl: (u) => `https://x.com/${u}`,
  validate: validators.x,
  // x.com is a client-rendered SPA that returns 200 for everything, so a
  // server-side scrape can't reliably distinguish. Always best-effort → unknown.
  check: (u) =>
    bestEffortScrape("X", `https://x.com/${enc(u)}`, x.profileUrl(u), []),
};

const instagram: PlatformAdapter = {
  name: "Instagram",
  tier: "B",
  profileUrl: (u) => `https://www.instagram.com/${u}/`,
  validate: validators.instagram,
  check: (u) =>
    bestEffortScrape(
      "Instagram",
      `https://www.instagram.com/${enc(u)}/`,
      instagram.profileUrl(u),
      [/"profilePage_/, /<meta property="og:title"/],
      [/Sorry, this page isn't available/i]
    ),
};

const threads: PlatformAdapter = {
  name: "Threads",
  tier: "B",
  profileUrl: (u) => `https://www.threads.net/@${u}`,
  validate: validators.threads,
  check: (u) =>
    bestEffortScrape(
      "Threads",
      `https://www.threads.net/@${enc(u)}`,
      threads.profileUrl(u),
      [/<meta property="og:title"/],
      [/Sorry, this page isn't available/i]
    ),
};

/** Cache the Twitch app token for its lifetime within a warm instance. */
let twitchToken: { value: string; expiresAt: number } | null = null;

async function getTwitchToken(id: string, secret: string): Promise<string | null> {
  if (twitchToken && Date.now() < twitchToken.expiresAt) return twitchToken.value;
  const res = await fetchWithTimeout("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: "client_credentials",
    }),
    redirect: "follow",
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number }
    | null;
  if (!data?.access_token) return null;
  twitchToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
  };
  return twitchToken.value;
}

const twitch: PlatformAdapter = {
  name: "Twitch",
  tier: "B",
  profileUrl: (u) => `https://www.twitch.tv/${u}`,
  validate: validators.twitch,
  check: async (u) => {
    const url = twitch.profileUrl(u);
    const id = process.env.TWITCH_CLIENT_ID;
    const secret = process.env.TWITCH_CLIENT_SECRET;
    if (!id || !secret)
      return result("Twitch", "unknown", "manual", url, "no API credentials");

    const token = await getTwitchToken(id, secret);
    if (!token) return result("Twitch", "unknown", "Twitch Helix API", url, "auth failed");

    const res = await fetchWithTimeout(
      `https://api.twitch.tv/helix/users?login=${enc(u)}`,
      {
        headers: { "Client-Id": id, Authorization: `Bearer ${token}` },
        redirect: "follow",
      }
    );
    if (res.status === 429)
      return result("Twitch", "unknown", "Twitch Helix API", url, "rate limited");
    if (!res.ok)
      return result("Twitch", "unknown", "Twitch Helix API", url, `http ${res.status}`);
    const data = (await res.json().catch(() => null)) as
      | { data?: unknown[] }
      | null;
    if (!data || !Array.isArray(data.data))
      return result("Twitch", "unknown", "Twitch Helix API", url, "bad response");
    return data.data.length > 0
      ? result("Twitch", "taken", "Twitch Helix API", url)
      : result("Twitch", "available", "Twitch Helix API", url);
  },
};

/** Registry, in display order. */
export const adapters: PlatformAdapter[] = [
  github,
  reddit,
  youtube,
  tiktok,
  x,
  instagram,
  threads,
  twitch,
];

export { USER_AGENT };
