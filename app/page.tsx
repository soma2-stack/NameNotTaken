"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useClerk,
} from "@clerk/nextjs";
import { DOMAIN_META, PLATFORM_META } from "@/lib/platform-meta";
import { PLAN_DISPLAY, type PaidPlan, type Plan } from "@/lib/billing";
import type { CheckResult, Status } from "@/lib/types";

type Phase = "idle" | "loading" | "done" | "error";

const BRAND_NAME = "AvailifyAi";
const SUPPORT_EMAIL = "support@availifyai.com";
const LAST_UPDATED = "June 17, 2026";
// Payments use server-side Stripe Checkout (POST /api/checkout) tied to the
// signed-in Clerk user. The user's real plan comes from GET /api/me, which
// reads it from Clerk metadata written by the Stripe webhook — so the unlocked
// state below cannot be faked from the browser.
const PRIMARY_PLATFORM_COUNT = 8;
const FREE_SEARCH_LIMIT = 3;
const BULK_SEARCH_LIMIT = 20;
const SUGGESTION_CHIPS = ["availifyai", "neonforge", "brandpilot", "creatorhq"];
const FREE_TIER_FEATURES = [
  "3 searches total",
  "Basic availability checks",
  ".com domain check",
  "Manual check links",
];
const PRO_TIER_FEATURES = [
  "Unlimited searches",
  "AI name assistant",
  "Bulk checker up to 20 names",
  ".com, .ai, .io, .net, and .co checks",
  "Watchlist and alerts",
];
const BUSINESS_TIER_FEATURES = [
  "Everything in Pro",
  "More advanced brand reports",
  "Higher limits",
  "Team-friendly use",
  "Priority support",
];
const AI_ASSISTANT_PROMPTS = [
  "Shorten it for a cleaner brand",
  "Find a stronger AI-focused angle",
  "Make it easier to pronounce",
];

const FEATURES = [
  {
    icon: "AI",
    title: "AI Name Assistant",
    body: "Brainstorm stronger, more memorable names and see which direction is most brandable.",
  },
  {
    icon: "20",
    title: "Bulk domain checker",
    body: "Pro users can check up to 20 name ideas at once instead of testing them one by one.",
  },
  {
    icon: "TLD",
    title: "Instant extension grid",
    body: "Compare .com, .ai, .io, .net, and .co side by side before you buy a domain.",
  },
  {
    icon: "♥",
    title: "Watchlist & alerts",
    body: "Save favorite names and track them for availability changes as your shortlist evolves.",
  },
];

const FAQS = [
  {
    question: "Can every platform be checked automatically?",
    answer:
      "Not always. GitHub, Reddit, YouTube, domains, and Twitch with credentials support reliable checks. Platforms like TikTok, Instagram, Facebook, and Discord often block automated lookups, so AvailifyAi marks those Manual Check Needed instead of guessing.",
  },
  {
    question: 'Why do some platforms say "Manual Check Needed"?',
    answer:
      "Some sites block server-side lookups or need a browser to render content. The Open link takes you to the real profile page so you can confirm directly.",
  },
  {
    question: "Is AvailifyAi free?",
    answer:
      "Yes. The free tier includes 3 total searches with basic availability checks. Pro is $10 per month for unlimited searches, bulk checks, AI help, premium TLDs, and watchlist alerts.",
  },
  {
    question: "Can I use it for a business name?",
    answer:
      "Yes. It is built for creators and founders who want consistent social handles and matching domains before committing to a name.",
  },
  {
    question: "Does it check domain names?",
    answer:
      "Yes. Free users see .com. Pro users unlock instant parallel checks for .com, .ai, .io, .net, and .co.",
  },
];

const STATUS_VIEW: Record<
  Status,
  {
    label: string;
    dot: string;
    badge: string;
    text: string;
    border: string;
  }
> = {
  available: {
    label: "Available",
    dot: "bg-[#46e0a0]",
    badge: "border-[#1f8f63]/80 bg-[#08291d] text-[#6fe9b4]",
    text: "text-[#6fe9b4]",
    border: "border-[#1f8f63]/50",
  },
  taken: {
    label: "Taken",
    dot: "bg-[#ff6b7a]",
    badge: "border-[#a33242]/80 bg-[#351017] text-[#ff8c98]",
    text: "text-[#ff8c98]",
    border: "border-[#a33242]/50",
  },
  unknown: {
    label: "Manual Check Needed",
    dot: "bg-[#ffc24d]",
    badge: "border-[#9a7428]/80 bg-[#33250b] text-[#ffd982]",
    text: "text-[#ffd982]",
    border: "border-[#9a7428]/50",
  },
};

const READY_BADGE =
  "border-white/10 bg-white/[0.04] text-[#9298ad]";

function normalizeInput(value: string): string {
  return value.trim().replace(/^@+/, "");
}

function parseBulkNames(value: string, isSubscribed: boolean): string[] {
  const limit = isSubscribed ? BULK_SEARCH_LIMIT : 1;
  const seen = new Set<string>();

  return value
    .split(/[\n,]+/)
    .map(normalizeInput)
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function getDomainTone(index: number): Status {
  const tones: Status[] = ["available", "unknown", "taken", "available", "unknown"];
  return tones[index % tones.length];
}

function getDomainPreviewLabel(status: Status): string {
  if (status === "available") return "Available";
  if (status === "taken") return "Taken";
  return "Checking needed";
}

function scoreName(handle: string, results: CheckResult[]): number {
  const clean = handle.replace(/[^a-zA-Z0-9]/g, "");
  const available = results.filter((r) => r.status === "available").length;
  const taken = results.filter((r) => r.status === "taken").length;
  const unknown = results.filter((r) => r.status === "unknown").length;
  let score = 72;

  if (clean.length >= 5 && clean.length <= 12) score += 10;
  if (clean.length > 12 && clean.length <= 18) score += 5;
  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(handle)) score += 7;
  if (!/[._-]/.test(handle)) score += 4;
  score += Math.min(10, available * 2);
  score -= Math.min(12, taken * 3);
  score -= Math.min(6, unknown);

  return Math.max(35, Math.min(96, score));
}

function makeAlternatives(handle: string): Array<{
  name: string;
  tag: string;
  score: number;
}> {
  const clean = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = clean || "availifyai";
  const candidates = [
    { name: `${base}hq`, tag: "Best overall", bump: 8 },
    { name: `real${base}`, tag: "Creator-friendly", bump: 4 },
    { name: `${base}gg`, tag: "Gaming-style", bump: 6 },
    { name: `the${base}`, tag: "Clean backup", bump: -2 },
    { name: `${base}io`, tag: "Domain-ready", bump: 3 },
  ];
  const seen = new Set<string>();

  return candidates
    .filter((item) => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return item.name.length <= 30;
    })
    .map((item) => ({
      name: item.name,
      tag: item.tag,
      score: Math.max(70, Math.min(96, 84 + item.bump)),
    }));
}

function getResultLabel(result: CheckResult): string {
  if (result.reason === "invalid format") return "Not valid here";
  return STATUS_VIEW[result.status].label;
}

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          size === "sm"
            ? "flex h-7 w-7 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#5b8cff] to-[#9b7bff]"
            : "flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#5b8cff] to-[#9b7bff] shadow-[0_14px_35px_rgba(91,140,255,0.25)]"
        }
      >
        <span
          className={
            size === "sm"
              ? "font-mono text-sm font-black text-[#07080f]"
              : "font-mono text-xl font-black text-[#07080f]"
          }
        >
          A
        </span>
      </div>
      <span className="text-base font-bold text-white">{BRAND_NAME}</span>
    </div>
  );
}

function PlatformLogo({
  initials,
  iconDomain,
  name,
}: {
  initials: string;
  iconDomain: string;
  name: string;
}) {
  return (
    <div
      className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/25"
      title={`${name} logo`}
    >
      <span className="font-mono text-xs font-bold text-[#cdd2e2]">
        {initials}
      </span>
      <span
        className="absolute inset-2 rounded-sm bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url("https://www.google.com/s2/favicons?domain=${encodeURIComponent(
            iconDomain
          )}&sz=64")`,
        }}
        aria-hidden
      />
    </div>
  );
}

function StatusBadge({
  result,
  loading,
}: {
  result?: CheckResult;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-[#c2c7d8]">
        Checking...
      </span>
    );
  }

  if (!result) {
    return (
      <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${READY_BADGE}`}>
        Ready
      </span>
    );
  }

  const view = STATUS_VIEW[result.status];
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${view.badge}`}
      aria-label={getResultLabel(result)}
    >
      {getResultLabel(result)}
    </span>
  );
}

function PlatformRow({
  initials,
  iconDomain,
  name,
  url,
  result,
  loading,
}: {
  initials: string;
  iconDomain: string;
  name: string;
  url: string;
  result?: CheckResult;
  loading?: boolean;
}) {
  const view = result ? STATUS_VIEW[result.status] : null;
  const canOpen = result?.status === "unknown" && result.reason !== "invalid format";

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white/[0.035] px-4 py-3 sm:flex-nowrap ${
        result ? view?.border : "border-white/10"
      }`}
    >
      <PlatformLogo initials={initials} iconDomain={iconDomain} name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              loading ? "animate-pulse bg-[#5b8cff]" : view?.dot ?? "bg-[#5b8cff]"
            }`}
            aria-hidden
          />
          <span className="font-semibold text-white">{name}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-[#7e859b]">
          {result?.reason && result.reason !== "invalid format"
            ? `${url} · ${result.reason}`
            : url}
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
        {canOpen && (
          <a
            href={result.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-2 py-1 text-sm font-bold text-[#8fb0ff] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b8cff]"
          >
            Open ↗
          </a>
        )}
        <StatusBadge result={result} loading={loading} />
      </div>
    </li>
  );
}

function DomainRow({
  domain,
  result,
  loading,
}: {
  domain: string;
  result?: CheckResult;
  loading?: boolean;
}) {
  const view = result ? STATUS_VIEW[result.status] : null;
  const canOpen = result?.status === "unknown" || result?.status === "taken";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-nowrap">
      <div className="min-w-0">
        <div className="truncate font-mono text-sm text-white">{domain}</div>
        {result?.reason && (
          <div className="mt-0.5 truncate text-xs text-[#7e859b]">
            {result.reason}
          </div>
        )}
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
        {canOpen && result && (
          <a
            href={result.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-2 py-1 text-sm font-bold text-[#8fb0ff] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b8cff]"
          >
            Whois ↗
          </a>
        )}
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${
            loading
              ? "border-white/10 bg-white/[0.04] text-[#c2c7d8]"
              : result
                ? view?.badge
                : READY_BADGE
          }`}
        >
          {loading ? "Checking..." : result ? getResultLabel(result) : "Ready"}
        </span>
      </div>
    </li>
  );
}

function FeatureCheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm font-semibold text-[#cdd2e2]">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#46e0a0]/30 bg-[#46e0a0]/10 text-xs text-[#6fe9b4]">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingCard({
  eyebrow,
  title,
  price,
  description,
  features,
  cta,
  href,
  featured = false,
  onCta,
  ctaDisabled = false,
}: {
  eyebrow: string;
  title: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  href?: string;
  featured?: boolean;
  /** When provided, the CTA renders as a button that calls this instead of a link. */
  onCta?: () => void;
  ctaDisabled?: boolean;
}) {
  const ctaClass = `mt-7 flex min-h-12 items-center justify-center rounded-2xl px-5 text-sm font-black disabled:opacity-60 ${
    featured
      ? "bg-gradient-to-br from-[#5b8cff] to-[#8a7bff] text-[#07080f]"
      : "border border-white/15 bg-white/[0.05] text-white hover:border-white/30"
  }`;
  return (
    <article
      className={`relative flex h-full flex-col rounded-[28px] border p-6 ${
        featured
          ? "border-[#5b8cff]/45 bg-[#5b8cff]/10 shadow-[0_40px_100px_-45px_rgba(91,140,255,0.55)]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      {featured && (
        <span className="mb-5 inline-flex w-fit items-center rounded-full border border-white/15 bg-black/25 px-4 py-2 text-xs font-black text-white">
          Best value
        </span>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className={`text-xs font-black uppercase ${
              featured ? "text-[#8fb0ff]" : "text-[#9298ad]"
            }`}
          >
            {eyebrow}
          </div>
          <h3 className="mt-2 text-2xl font-black text-white">{title}</h3>
        </div>
        <div className="text-right">
          <span className={featured ? "text-5xl font-black text-white" : "text-4xl font-black text-white"}>
            {price}
          </span>
          <span className="block text-sm font-bold text-[#7e859b]">/month</span>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#9298ad]">{description}</p>
      <FeatureCheckList items={features} />
      {onCta ? (
        <button
          type="button"
          onClick={onCta}
          disabled={ctaDisabled}
          className={ctaClass}
        >
          {cta}
        </button>
      ) : (
        <a href={href ?? "#"} className={ctaClass}>
          {cta}
        </a>
      )}
    </article>
  );
}

function TldGrid({
  displayHandle,
  isSubscribed,
  resultByName,
  isLoading,
}: {
  displayHandle: string;
  isSubscribed: boolean;
  resultByName: Map<string, CheckResult>;
  isLoading: boolean;
}) {
  const visibleDomains = isSubscribed
    ? DOMAIN_META
    : DOMAIN_META.filter((domain) => domain.extension === ".com");

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">TLD extension check</div>
          <div className="mt-1 text-xs text-[#7e859b]">
            {isSubscribed
              ? "Pro grid: .com, .ai, .io, .net, and .co in parallel"
              : "Free tier: .com only"}
          </div>
        </div>
        {!isSubscribed && (
          <span className="rounded-full border border-[#ffc24d]/35 bg-[#ffc24d]/10 px-3 py-1 text-xs font-black text-[#ffd982]">
            Pro unlocks 5 TLDs
          </span>
        )}
      </div>

      <div
        className={
          isSubscribed
            ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            : "grid gap-3 sm:grid-cols-2"
        }
      >
        {visibleDomains.map((domain, index) => {
          const result = resultByName.get(domain.name);
          const status = result?.status ?? getDomainTone(index);
          const view = STATUS_VIEW[status];
          const domainName = `${displayHandle.toLowerCase()}${domain.extension}`;
          const loading = isLoading && !result;
          const canOpen = result?.status === "unknown" || result?.status === "taken";

          return (
            <div
              key={domain.name}
              className={`rounded-2xl border bg-white/[0.035] p-4 ${result ? view.border : "border-white/10"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-lg border border-white/10 bg-black/25 px-2 py-1 font-mono text-xs font-black text-white">
                  {domain.extension}
                </span>
                <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-[#5b8cff]" : view.dot}`} />
              </div>
              <div className="mt-4 truncate font-mono text-sm font-black text-white">
                {domainName}
              </div>
              <div className={`mt-2 text-xs font-bold ${view.text}`}>
                {loading
                  ? "Checking..."
                  : result
                    ? getResultLabel(result)
                    : getDomainPreviewLabel(status)}
              </div>
              {canOpen && result && (
                <a
                  href={result.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex rounded-lg text-xs font-black text-[#8fb0ff] underline-offset-4 hover:underline"
                >
                  Whois
                </a>
              )}
            </div>
          );
        })}
      </div>

      {!isSubscribed && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-[#9298ad]">
          Upgrade to Pro to reveal .ai, .io, .net, and .co checks for every search.
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [bulkInput, setBulkInput] = useState("availifyai");
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [checkoutPending, setCheckoutPending] = useState(false);
  const isSubscribed = plan !== "free";
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const [searchCount, setSearchCount] = useState(0);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [contactSent, setContactSent] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load the caller's real plan from the server. Re-runs when auth state
  // changes (sign in / sign out) so unlocked features reflect the true plan.
  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.plan) setPlan(data.plan as Plan);
      })
      .catch(() => {
        /* keep the free default on failure */
      });
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  const resultByName = useMemo(
    () => new Map(results.map((result) => [result.platform, result])),
    [results]
  );
  const displayHandle = checked || normalizeInput(username) || "availifyai";
  const score = scoreName(displayHandle, results);
  const alternatives = useMemo(
    () => makeAlternatives(displayHandle),
    [displayHandle]
  );

  const manualCount = results.filter((r) => r.status === "unknown").length;
  const completeCount = results.length;
  const bestAlternative = alternatives[0];
  const isLoading = phase === "loading";
  const hasSearched = phase !== "idle" || results.length > 0 || Boolean(error);
  const visiblePlatforms = showAllPlatforms
    ? PLATFORM_META
    : PLATFORM_META.slice(0, PRIMARY_PLATFORM_COUNT);
  const hiddenPlatformCount = Math.max(
    0,
    PLATFORM_META.length - PRIMARY_PLATFORM_COUNT
  );
  const bulkNames = parseBulkNames(bulkInput, isSubscribed);
  const remainingFreeSearches = Math.max(0, FREE_SEARCH_LIMIT - searchCount);
  const hasAvailableResult = results.some((result) => result.status === "available");
  const savedNames = new Set(watchlist.map((item) => item.toLowerCase()));

  async function runCheck(value: string) {
    const handle = normalizeInput(value);
    if (!handle) return;
    if (!isSubscribed && searchCount >= FREE_SEARCH_LIMIT) {
      setError("Free searches used. Upgrade to Pro for unlimited searches.");
      setPhase("error");
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setUsername(handle);
    setBulkInput(handle);
    setChecked(handle);
    setPhase("loading");
    setError(null);
    setResults([]);
    if (!isSubscribed) setSearchCount((count) => Math.min(FREE_SEARCH_LIMIT, count + 1));

    window.requestAnimationFrame(() => {
      document
        .getElementById("results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const res = await fetch(
        `/api/check?username=${encodeURIComponent(handle)}`,
        { signal: ctrl.signal }
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const result = JSON.parse(trimmed) as CheckResult;
          setResults((prev) => [
            ...prev.filter((item) => item.platform !== result.platform),
            result,
          ]);
        }
      }

      const remaining = buffer.trim();
      if (remaining) {
        const result = JSON.parse(remaining) as CheckResult;
        setResults((prev) => [
          ...prev.filter((item) => item.platform !== result.platform),
          result,
        ]);
      }

      if (!ctrl.signal.aborted) setPhase("done");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = parseBulkNames(bulkInput, isSubscribed);
    if (names.length === 0) return;
    setBulkQueue(names);
    void runCheck(names[0]);
  }

  function checkNamed(name: string) {
    void runCheck(name);
  }

  function handleBulkInputChange(value: string) {
    if (isSubscribed) {
      setBulkInput(value);
      setUsername(parseBulkNames(value, true)[0] ?? "");
      return;
    }

    const firstLine = value.split(/[\n,]+/)[0] ?? "";
    setBulkInput(firstLine);
    setUsername(normalizeInput(firstLine));
  }

  function saveName(name: string) {
    if (!isSubscribed) return;
    setWatchlist((items) => {
      const key = name.toLowerCase();
      if (items.some((item) => item.toLowerCase() === key)) return items;
      return [name, ...items].slice(0, 8);
    });
  }

  async function startCheckout(target: PaidPlan) {
    setPaymentNotice(null);

    // Must be signed in to attach the subscription to an account.
    if (!isSignedIn) {
      openSignIn({
        // Bring them back to pricing after signing in; they tap upgrade again.
        afterSignInUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/#pricing`
            : undefined,
      });
      return;
    }

    setCheckoutPending(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target }),
      });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setPaymentNotice(data?.error ?? "Could not start checkout. Please try again.");
    } catch {
      setPaymentNotice("Could not start checkout. Please try again.");
    } finally {
      setCheckoutPending(false);
    }
  }

  async function openBillingPortal() {
    setPaymentNotice(null);
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setPaymentNotice(data?.error ?? "Could not open the billing portal.");
    } catch {
      setPaymentNotice("Could not open the billing portal.");
    }
  }

  function onCtaForPlan(target: PaidPlan) {
    if (plan === target) {
      void openBillingPortal();
    } else {
      void startCheckout(target);
    }
  }

  function onContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Connect this to Formspree, EmailJS, Resend, or a custom Next.js API route later.
    setContactSent(true);
    event.currentTarget.reset();
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#07080f] text-[#f2f4fb]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(120deg, rgba(91,140,255,0.14), transparent 34%, rgba(155,123,255,0.12) 68%, transparent), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "auto, 72px 72px, 72px 72px",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 64%, transparent 100%)",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-[1160px] items-center gap-6 px-6 py-5">
        <a href="#search" className="shrink-0">
          <Logo />
        </a>
        <nav className="hidden items-center gap-5 text-sm font-semibold text-[#aab0c4] md:flex lg:gap-7">
          <a className="hover:text-white" href="#features">
            Features
          </a>
          <a className="hover:text-white" href="#how">
            How It Works
          </a>
          <a className="hover:text-white" href="#pricing">
            Pricing
          </a>
          <a className="hover:text-white" href="#privacy">
            Privacy
          </a>
          <a className="hover:text-white" href="#contact">
            Contact
          </a>
          <a className="hover:text-white" href="#faq">
            FAQ
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-[#c2c7d8] transition hover:border-white/30 hover:text-white"
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <a
            href="#search"
            className="rounded-xl bg-gradient-to-br from-[#5b8cff] to-[#8a7bff] px-5 py-2.5 text-sm font-black text-[#07080f] shadow-[0_12px_30px_rgba(91,140,255,0.25)]"
          >
            Try Free
          </a>
        </div>
      </header>

      <section
        id="search"
        className="relative z-10 mx-auto max-w-[1160px] px-6 pb-12 pt-16 text-center sm:pt-24"
      >
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-[#c2c7d8]">
          <span className="h-2 w-2 rounded-full bg-[#46e0a0] shadow-[0_0_12px_rgba(70,224,160,0.8)]" />
          Live checks across {PLATFORM_META.length} apps + domains
        </div>
        <h1 className="mx-auto max-w-[15ch] text-[40px] font-black leading-[1.04] text-white [text-wrap:balance] sm:text-[64px] lg:text-[72px]">
          Find the perfect online name before someone else takes it.
        </h1>
        <p className="mx-auto mt-6 max-w-[58ch] text-base leading-8 text-[#aab0c4] sm:text-lg">
          Check handles, domains, and brand potential in seconds, then get
          smarter alternatives when your first idea is taken.
        </p>

        <div className="mx-auto mt-8 flex max-w-[700px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-black ${
                isSubscribed
                  ? "border-[#5b8cff]/40 bg-[#5b8cff]/10 text-[#8fb0ff]"
                  : "border-white/10 bg-black/25 text-[#9298ad]"
              }`}
            >
              {PLAN_DISPLAY[plan].name} plan
            </span>
            <span className="text-sm font-semibold text-[#9298ad]">
              {isSubscribed
                ? "All features unlocked."
                : "3 searches · .com only. Upgrade to unlock everything."}
            </span>
          </div>
          {isSubscribed ? (
            <button
              type="button"
              onClick={() => void openBillingPortal()}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-[#c2c7d8] transition hover:border-white/30 hover:text-white"
            >
              Manage billing
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startCheckout("pro")}
              disabled={checkoutPending}
              className="rounded-xl bg-gradient-to-br from-[#5b8cff] to-[#8a7bff] px-4 py-2 text-sm font-black text-[#07080f] transition disabled:opacity-60"
            >
              {checkoutPending ? "Starting…" : "Upgrade to Pro"}
            </button>
          )}
        </div>

        <form onSubmit={onSubmit} className="mx-auto mt-5 max-w-[700px]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-bold">
            <label htmlFor="bulk-names" className="uppercase text-[#7e859b]">
              {isSubscribed ? "Bulk search up to 20 names" : "Single search"}
            </label>
            <span
              className={`rounded-full border px-3 py-1 ${
                isSubscribed
                  ? "border-[#46e0a0]/35 bg-[#46e0a0]/10 text-[#6fe9b4]"
                  : "border-[#ffc24d]/35 bg-[#ffc24d]/10 text-[#ffd982]"
              }`}
            >
              {isSubscribed
                ? "Unlimited searches"
                : `${remainingFreeSearches}/${FREE_SEARCH_LIMIT} free searches left`}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-[20px] border border-white/10 bg-white/[0.045] p-2 shadow-[0_32px_80px_-28px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-4 top-4 font-mono text-xl text-[#6b7186]">
                @
              </span>
              <textarea
                id="bulk-names"
                name="bulk-names"
                rows={isSubscribed ? 5 : 1}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={
                  isSubscribed
                    ? "availifyai\nbrandpilot\ncreatorhq"
                    : "availifyai"
                }
                value={bulkInput}
                onChange={(event) => handleBulkInputChange(event.target.value)}
                className={`w-full resize-none rounded-2xl border border-transparent bg-transparent pl-10 pr-4 font-mono text-lg text-white placeholder:text-[#51586c] focus:border-[#5b8cff]/60 focus:outline-none focus:ring-2 focus:ring-[#5b8cff]/30 ${
                  isSubscribed ? "min-h-[150px] py-4" : "h-14 overflow-hidden py-3"
                }`}
              />
              {!isSubscribed && (
                <span className="absolute right-3 top-3 rounded-full border border-[#ffc24d]/35 bg-[#33250b] px-3 py-1 text-xs font-black text-[#ffd982]">
                  Bulk Search (Pro Only)
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || bulkNames.length === 0 || (!isSubscribed && remainingFreeSearches === 0)}
              className="min-h-14 rounded-2xl bg-gradient-to-br from-[#5b8cff] to-[#8a7bff] px-7 text-base font-black text-[#07080f] shadow-[0_16px_35px_rgba(91,140,255,0.28)] transition disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-[160px]"
            >
              {isLoading
                ? "Checking..."
                : isSubscribed && bulkNames.length > 1
                  ? `Check ${bulkNames.length} Names`
                  : "Check Name"}
            </button>
          </div>
          {isSubscribed && bulkNames.length > 1 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {bulkNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => checkNamed(name)}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs font-bold text-[#cdd2e2] hover:border-[#5b8cff]/50 hover:text-white"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => checkNamed(chip)}
              className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 font-mono text-xs font-semibold text-[#b8bfce] hover:border-[#5b8cff]/50 hover:text-white"
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      <section
        id="results"
        className="relative z-10 mx-auto grid max-w-[1160px] gap-5 px-6 py-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]"
      >
        <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-7">
          <div className="mb-6 grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] sm:grid-cols-4">
            <div className="border-b border-white/10 p-4 sm:border-b-0 sm:border-r">
              <div className="text-2xl font-black text-white">{completeCount}</div>
              <div className="mt-1 text-xs text-[#7e859b]">checks complete</div>
            </div>
            <div className="border-b border-white/10 p-4 sm:border-b-0 sm:border-r">
              <div className="text-2xl font-black text-[#ffc24d]">
                {manualCount}
              </div>
              <div className="mt-1 text-xs text-[#7e859b]">manual checks</div>
            </div>
            <div className="p-4">
              <div className="text-2xl font-black text-[#6fe9b4]">
                {alternatives.length}
              </div>
              <div className="mt-1 text-xs text-[#7e859b]">
                strong alternatives
              </div>
            </div>
            <div className="border-t border-white/10 p-4 sm:border-l sm:border-t-0">
              <div className="text-2xl font-black text-white">
                {isSubscribed ? "∞" : remainingFreeSearches}
              </div>
              <div className="mt-1 text-xs text-[#7e859b]">
                {isSubscribed ? "Pro searches" : "free searches left"}
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-[#7e859b]">
                {hasSearched ? "Results for" : "Ready for"}
              </div>
              <h2 className="mt-1 font-mono text-2xl font-black text-white sm:text-3xl">
                {displayHandle}
              </h2>
              <p className="mt-2 text-sm text-[#aab0c4]">
                {score >= 86
                  ? "Strong, brand-ready name"
                  : score >= 72
                    ? "Usable name with room to improve"
                    : "Try a stronger variation"}
              </p>
              {bulkQueue.length > 1 && (
                <p className="mt-2 text-xs font-semibold text-[#8fb0ff]">
                  Bulk queue ready: {bulkQueue.slice(0, 4).join(", ")}
                  {bulkQueue.length > 4 ? ` +${bulkQueue.length - 4} more` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <button
                type="button"
                onClick={() => saveName(displayHandle)}
                disabled={!isSubscribed || !hasAvailableResult || savedNames.has(displayHandle.toLowerCase())}
                className="min-h-12 rounded-2xl border border-[#ff6b7a]/35 bg-[#ff6b7a]/10 px-4 text-sm font-black text-[#ff9ca6] transition enabled:hover:border-[#ff6b7a]/70 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.035] disabled:text-[#7e859b]"
              >
                {isSubscribed
                  ? savedNames.has(displayHandle.toLowerCase())
                    ? "♥ Saved"
                    : "♡ Save Name"
                  : "Lock Watchlist"}
              </button>
              <div className="min-w-[170px] rounded-2xl border border-[#5b8cff]/25 bg-[#5b8cff]/10 p-4">
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-white">{score}</span>
                <span className="pb-1 text-sm font-bold text-[#7e859b]">
                  / 100
                </span>
              </div>
              <div className="mt-1 text-xs font-bold uppercase text-[#8fb0ff]">
                Name score
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5b8cff] to-[#46e0a0]"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-[#a33242]/70 bg-[#351017] px-4 py-3 text-sm font-semibold text-[#ff8c98]"
            >
              {error}
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {visiblePlatforms.map((platform) => (
              <PlatformRow
                key={platform.name}
                initials={platform.initials}
                iconDomain={platform.iconDomain}
                name={platform.name}
                url={platform.displayUrl(displayHandle)}
                result={resultByName.get(platform.name)}
                loading={isLoading && !resultByName.has(platform.name)}
              />
            ))}
          </ul>

          {hiddenPlatformCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPlatforms((open) => !open)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-[#8fb0ff] hover:border-[#5b8cff]/50 hover:text-white"
              aria-expanded={showAllPlatforms}
            >
              {showAllPlatforms
                ? "Show fewer apps"
                : `View more apps (${hiddenPlatformCount})`}
              <span aria-hidden>{showAllPlatforms ? "-" : "+"}</span>
            </button>
          )}

          <TldGrid
            displayHandle={displayHandle}
            isSubscribed={isSubscribed}
            resultByName={resultByName}
            isLoading={isLoading}
          />
        </div>

        <aside className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Honest checks</h2>
              <span className="rounded-full border border-[#ffc24d]/35 bg-[#ffc24d]/10 px-3 py-1 text-xs font-bold text-[#ffd982]">
                No guessing
              </span>
            </div>
            <p className="text-sm leading-6 text-[#9298ad]">
              Bot-hostile platforms are clearly marked Manual Check Needed.
              Available only appears when the response is reliable.
            </p>
            <div className="mt-4 space-y-2 text-sm font-semibold text-[#cdd2e2]">
              <div className="flex gap-2">
                <span className="text-[#6fe9b4]">✓</span>
                No fake availability
              </div>
              <div className="flex gap-2">
                <span className="text-[#6fe9b4]">✓</span>
                Official profile links
              </div>
              <div className="flex gap-2">
                <span className="text-[#6fe9b4]">✓</span>
                Streamed results as checks finish
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#5b8cff]/25 bg-[#5b8cff]/10 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase text-[#8fb0ff]">
                  AI Name Assistant
                </div>
                <h2 className="mt-1 text-lg font-black text-white">
                  Brainstorm with context
                </h2>
              </div>
              {!isSubscribed && (
                <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs font-black text-[#c2c7d8]">
                  Pro
                </span>
              )}
            </div>
            <p className="text-sm leading-6 text-[#c2c7d8]">
              {isSubscribed
                ? `Ask for sharper variations of ${displayHandle}, compare naming angles, and choose the strongest direction.`
                : "Upgrade to unlock guided AI brainstorming, naming angles, and smarter recommendation explanations."}
            </p>
            <div className="mt-4 space-y-2">
              {AI_ASSISTANT_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={!isSubscribed}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-xs font-bold text-[#cdd2e2] disabled:cursor-not-allowed disabled:text-[#7e859b] enabled:hover:border-[#5b8cff]/50 enabled:hover:text-white"
                >
                  {prompt}
                  <span className="text-[#8fb0ff]">{isSubscribed ? "Ask" : "Lock"}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="mb-1 text-xs font-bold uppercase text-[#5b8cff]">
              Smart alternatives
            </div>
            <h2 className="text-lg font-black text-white">
              Stronger variations of {displayHandle}
            </h2>
            <div className="mt-4 space-y-2">
              {alternatives.map((item) => (
                <div
                  key={item.name}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-bold text-white">
                      {item.name}
                    </span>
                    <span className="block text-xs text-[#7e859b]">
                      {item.tag}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-black text-[#6fe9b4]">
                      {item.score}
                    </span>
                    <button
                      type="button"
                      onClick={() => checkNamed(item.name)}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-[#8fb0ff] hover:bg-white/[0.06]"
                    >
                      Check
                    </button>
                    <button
                      type="button"
                      onClick={() => saveName(item.name)}
                      disabled={!isSubscribed || savedNames.has(item.name.toLowerCase())}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-[#ff9ca6] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-[#7e859b]"
                    >
                      {savedNames.has(item.name.toLowerCase()) ? "♥" : "♡"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#5b8cff]/25 bg-[#5b8cff]/10 p-5">
            <div className="mb-2 text-xs font-bold uppercase text-[#8fb0ff]">
              Best recommendation
            </div>
            <div className="font-mono text-lg font-black text-white">
              {bestAlternative.name}
            </div>
            <p className="mt-2 text-sm leading-6 text-[#c2c7d8]">
              Clean spelling, strong score, and a domain-ready variation for{" "}
              {displayHandle}.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Watchlist</h2>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-black ${
                  isSubscribed
                    ? "border-[#46e0a0]/35 bg-[#46e0a0]/10 text-[#6fe9b4]"
                    : "border-white/10 bg-black/25 text-[#9298ad]"
                }`}
              >
                {isSubscribed ? `${watchlist.length} saved` : "Locked"}
              </span>
            </div>
            {isSubscribed ? (
              watchlist.length > 0 ? (
                <div className="space-y-2">
                  {watchlist.map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <span className="min-w-0 truncate font-mono text-sm font-bold text-white">
                        {name}
                      </span>
                      <span className="text-xs font-bold text-[#6fe9b4]">
                        Alerts on
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-[#9298ad]">
                  Click a Save button next to an available or suggested name to
                  start your watchlist.
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
                  🔒
                </div>
                <div className="font-black text-white">Save names with Pro</div>
                <p className="mt-2 text-sm leading-6 text-[#9298ad]">
                  Your shortlist, favorites, and availability alerts unlock on
                  the $10/mo plan.
                </p>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section
        id="features"
        className="relative z-10 mx-auto max-w-[1160px] px-6 py-16"
      >
        <div className="mx-auto mb-11 max-w-2xl text-center">
          <div className="mb-3 text-xs font-black uppercase text-[#5b8cff]">
            Features
          </div>
          <h2 className="text-3xl font-black text-white [text-wrap:balance] sm:text-4xl">
            Know before you build your brand around a name.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[22px] border border-white/10 bg-white/[0.04] p-6"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#5b8cff]/30 bg-[#5b8cff]/15 text-xl">
                {feature.icon}
              </div>
              <h3 className="text-lg font-black text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#9298ad]">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="how"
        className="relative z-10 mx-auto max-w-[1160px] px-6 py-16"
      >
        <div className="mx-auto mb-11 max-w-2xl text-center">
          <div className="mb-3 text-xs font-black uppercase text-[#5b8cff]">
            How it works
          </div>
          <h2 className="text-3xl font-black text-white [text-wrap:balance] sm:text-4xl">
            From idea to usable handle in seconds.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["01", "Type your name", "Enter any username, handle, gamer tag, or brand name you are considering."],
            ["02", "Review platform results", "See availability across every platform with color-coded statuses and a clear summary."],
            ["03", "Pick the best option", "Lock in a name that is available everywhere or check a stronger alternative."],
          ].map(([number, title, body]) => (
            <article
              key={number}
              className="rounded-[22px] border border-white/10 bg-white/[0.035] p-6"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#5b8cff]/30 bg-[#5b8cff]/15 font-mono text-sm font-black text-[#8fb0ff]">
                {number}
              </div>
              <h3 className="text-lg font-black text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#9298ad]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="pricing"
        className="relative z-10 mx-auto max-w-[1160px] px-6 py-16"
      >
        <div className="mb-10 text-center">
          <div className="mb-3 text-xs font-black uppercase text-[#5b8cff]">
            Pricing
          </div>
          <h2 className="text-3xl font-black text-white [text-wrap:balance] sm:text-4xl">
            Start free, upgrade when names get serious.
          </h2>
          <p className="mx-auto mt-4 max-w-[58ch] leading-7 text-[#aab0c4]">
            Free is intentionally simple. Pro turns AvailifyAi into a serious
            naming workspace with bulk search, AI help, premium TLDs, and alerts.
          </p>
        </div>

        {paymentNotice && (
          <div className="mb-5 rounded-2xl border border-[#ffc24d]/35 bg-[#33250b] px-5 py-4 text-sm font-semibold text-[#ffd982]">
            {paymentNotice}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <PricingCard
            eyebrow="Free"
            title="Free"
            price="$0"
            description="A focused starter plan for testing a few name ideas before committing."
            features={FREE_TIER_FEATURES}
            cta="Start Free"
            href="#search"
          />
          <PricingCard
            eyebrow="Pro"
            title="Pro"
            price="$10"
            description="The serious naming workspace for creators, founders, and builders."
            features={PRO_TIER_FEATURES}
            cta={
              plan === "pro"
                ? "Manage billing"
                : checkoutPending
                  ? "Starting…"
                  : "Upgrade to Pro"
            }
            featured
            onCta={() => onCtaForPlan("pro")}
            ctaDisabled={checkoutPending}
          />
          <PricingCard
            eyebrow="Business"
            title="Business"
            price="$29"
            description="More room and support for teams comparing names across client or product work."
            features={BUSINESS_TIER_FEATURES}
            cta={
              plan === "business"
                ? "Manage billing"
                : checkoutPending
                  ? "Starting…"
                  : "Choose Business"
            }
            onCta={() => onCtaForPlan("business")}
            ctaDisabled={checkoutPending}
          />
        </div>
      </section>

      <section
        id="privacy"
        className="relative z-10 mx-auto max-w-[1160px] px-6 py-16"
      >
        <div className="mb-10 text-center">
          <div className="mb-3 text-xs font-black uppercase text-[#5b8cff]">
            Privacy
          </div>
          <h2 className="text-3xl font-black text-white [text-wrap:balance] sm:text-4xl">
            Privacy Policy
          </h2>
          <p className="mx-auto mt-4 max-w-[58ch] leading-7 text-[#aab0c4]">
            Last updated: {LAST_UPDATED}. This starter policy explains how
            AvailifyAi handles information while you search and compare names.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            [
              "Information we collect",
              "We may collect search inputs, basic usage data, contact form details, and account information if subscriptions are added.",
            ],
            [
              "How we use information",
              "We use information to run availability checks, improve the product, respond to messages, prevent abuse, and support subscriptions.",
            ],
            [
              "Search inputs",
              "Names or handles you search may be sent to third-party platforms and domain services so AvailifyAi can check availability.",
            ],
            [
              "Account and payments",
              "If paid plans are enabled, account and payment information may be processed by third-party payment providers such as Stripe.",
            ],
            [
              "Cookies and analytics",
              "We may use cookies or analytics tools to understand product usage, measure performance, and improve the experience.",
            ],
            [
              "Third-party services",
              "Availability checks, analytics, hosting, and payments may rely on third-party services with their own privacy practices.",
            ],
            [
              "Data security",
              "We use reasonable technical and organizational safeguards, but no internet service can guarantee perfect security.",
            ],
            [
              "User rights",
              "You can contact us to request access, correction, or deletion of personal information where applicable.",
            ],
          ].map(([title, body]) => (
            <article
              key={title}
              className="rounded-[22px] border border-white/10 bg-white/[0.04] p-6"
            >
              <h3 className="text-lg font-black text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#9298ad]">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-[22px] border border-[#5b8cff]/25 bg-[#5b8cff]/10 p-6">
          <h3 className="text-lg font-black text-white">Contact</h3>
          <p className="mt-3 text-sm leading-7 text-[#c2c7d8]">
            For privacy questions or requests, contact{" "}
            <a
              className="font-black text-[#8fb0ff] hover:text-white"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>

      <section
        id="contact"
        className="relative z-10 mx-auto max-w-[1160px] px-6 py-16"
      >
        <div className="grid gap-8 rounded-[30px] border border-white/10 bg-white/[0.04] p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-3 text-xs font-black uppercase text-[#5b8cff]">
              Contact
            </div>
            <h2 className="text-3xl font-black text-white [text-wrap:balance] sm:text-4xl">
              Tell us what you are building.
            </h2>
            <p className="mt-4 leading-7 text-[#aab0c4]">
              For support, business questions, or feedback, contact us at{" "}
              <a
                className="font-black text-[#8fb0ff] hover:text-white"
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <div className="mt-6 rounded-2xl border border-[#5b8cff]/25 bg-[#5b8cff]/10 p-5">
              <div className="text-sm font-black text-white">Fastest path</div>
              <p className="mt-2 text-sm leading-6 text-[#c2c7d8]">
                Send your question, pricing request, or feature idea and we will
                route it to the right place.
              </p>
            </div>
          </div>

          <form onSubmit={onContactSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase text-[#7e859b]">
                  Name
                </span>
                <input
                  required
                  name="name"
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white placeholder:text-[#51586c] focus:border-[#5b8cff]/60 focus:outline-none focus:ring-2 focus:ring-[#5b8cff]/30"
                  placeholder="Your name"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-[#7e859b]">
                  Email
                </span>
                <input
                  required
                  name="email"
                  type="email"
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white placeholder:text-[#51586c] focus:border-[#5b8cff]/60 focus:outline-none focus:ring-2 focus:ring-[#5b8cff]/30"
                  placeholder="you@example.com"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase text-[#7e859b]">
                Subject
              </span>
              <input
                required
                name="subject"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white placeholder:text-[#51586c] focus:border-[#5b8cff]/60 focus:outline-none focus:ring-2 focus:ring-[#5b8cff]/30"
                placeholder="How can we help?"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase text-[#7e859b]">
                Message
              </span>
              <textarea
                required
                name="message"
                rows={5}
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-[#51586c] focus:border-[#5b8cff]/60 focus:outline-none focus:ring-2 focus:ring-[#5b8cff]/30"
                placeholder="Share a few details..."
              />
            </label>
            <button
              type="submit"
              className="min-h-12 rounded-2xl bg-gradient-to-br from-[#5b8cff] to-[#8a7bff] px-6 text-sm font-black text-[#07080f]"
            >
              Send Message
            </button>
            {contactSent && (
              <div className="rounded-2xl border border-[#46e0a0]/35 bg-[#46e0a0]/10 px-4 py-3 text-sm font-semibold text-[#6fe9b4]">
                Thanks. Your message is ready for delivery once a contact
                provider is connected.
              </div>
            )}
          </form>
        </div>
      </section>

      <section
        id="faq"
        className="relative z-10 mx-auto max-w-[800px] px-6 py-16"
      >
        <div className="mb-10 text-center">
          <div className="mb-3 text-xs font-black uppercase text-[#5b8cff]">
            FAQ
          </div>
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const open = openFaq === index;
            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left font-bold text-white"
                >
                  {faq.question}
                  <span className="text-2xl text-[#8fb0ff]">
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open && (
                  <p className="px-5 pb-5 text-sm leading-7 text-[#9298ad]">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="relative z-10 mt-10 border-t border-white/10">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-2 text-sm text-[#7e859b]">
              Find your name before it disappears.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-[#aab0c4]">
            <a className="hover:text-white" href="#pricing">
              Pricing
            </a>
            <a className="hover:text-white" href="#privacy">
              Privacy
            </a>
            <a className="hover:text-white" href="#contact">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
