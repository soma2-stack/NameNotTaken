"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { DOMAIN_META, PLATFORM_META } from "@/lib/platform-meta";
import type { CheckResult, Status } from "@/lib/types";

type Phase = "idle" | "loading" | "done" | "error";

const SUGGESTION_CHIPS = ["gamerwolf", "dannyplays", "neonforge", "zentok"];

const FEATURES = [
  {
    icon: "⚡",
    title: "Multi-platform checks",
    body: "Quickly see where your name is available, taken, or needs manual verification across 8 platforms at once.",
  },
  {
    icon: "◎",
    title: "Name strength score",
    body: "A simple score based on length, readability, availability, and brand potential.",
  },
  {
    icon: "✦",
    title: "Smart alternatives",
    body: "When your first choice is taken, get stronger variations tagged by use case.",
  },
  {
    icon: "◆",
    title: "Brand-ready results",
    body: "Find matching domains, social handles, and creator-friendly name options in one focused view.",
  },
];

const FAQS = [
  {
    question: "Can every platform be checked automatically?",
    answer:
      "Not always. GitHub, Reddit, YouTube, domains, and Twitch with credentials support reliable checks. Platforms like TikTok and Instagram often block automated lookups, so NameNotTaken marks those Manual Check Needed instead of guessing.",
  },
  {
    question: 'Why do some platforms say "Manual Check Needed"?',
    answer:
      "Some sites block server-side lookups or need a browser to render content. The Open link takes you to the real profile page so you can confirm directly.",
  },
  {
    question: "Is NameNotTaken free?",
    answer:
      "Yes. Core checks across the supported platforms and domains run without an account.",
  },
  {
    question: "Can I use it for a business name?",
    answer:
      "Yes. It is built for creators and founders who want consistent social handles and matching domains before committing to a name.",
  },
  {
    question: "Does it check domain names?",
    answer:
      "Yes. It checks .com and .io with conservative DNS lookups and marks ambiguous responses for manual verification.",
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
  const base = clean || "neonforge";
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
          N
        </span>
      </div>
      <span className="text-base font-bold text-white">NameNotTaken</span>
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
  name,
  url,
  result,
  loading,
}: {
  initials: string;
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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25 font-mono text-xs font-bold text-[#cdd2e2]">
        {initials}
      </div>
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

export default function Home() {
  const [username, setUsername] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const abortRef = useRef<AbortController | null>(null);

  const resultByName = useMemo(
    () => new Map(results.map((result) => [result.platform, result])),
    [results]
  );
  const displayHandle = checked || normalizeInput(username) || "neonforge";
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

  async function runCheck(value: string) {
    const handle = normalizeInput(value);
    if (!handle) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setUsername(handle);
    setChecked(handle);
    setPhase("loading");
    setError(null);
    setResults([]);

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
    void runCheck(username);
  }

  function checkNamed(name: string) {
    void runCheck(name);
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
        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#aab0c4] md:flex">
          <a className="hover:text-white" href="#features">
            Features
          </a>
          <a className="hover:text-white" href="#how">
            How It Works
          </a>
          <a className="hover:text-white" href="#pricing">
            Pricing
          </a>
          <a className="hover:text-white" href="#faq">
            FAQ
          </a>
        </nav>
        <a
          href="#search"
          className="ml-auto rounded-xl bg-gradient-to-br from-[#5b8cff] to-[#8a7bff] px-5 py-2.5 text-sm font-black text-[#07080f] shadow-[0_12px_30px_rgba(91,140,255,0.25)]"
        >
          Try Free
        </a>
      </header>

      <section
        id="search"
        className="relative z-10 mx-auto max-w-[1160px] px-6 pb-12 pt-16 text-center sm:pt-24"
      >
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-[#c2c7d8]">
          <span className="h-2 w-2 rounded-full bg-[#46e0a0] shadow-[0_0_12px_rgba(70,224,160,0.8)]" />
          Live checks across 8 platforms + domains
        </div>
        <h1 className="mx-auto max-w-[15ch] text-[40px] font-black leading-[1.04] text-white [text-wrap:balance] sm:text-[64px] lg:text-[72px]">
          Find the perfect online name before someone else takes it.
        </h1>
        <p className="mx-auto mt-6 max-w-[58ch] text-base leading-8 text-[#aab0c4] sm:text-lg">
          Check handles, domains, and brand potential in seconds, then get
          smarter alternatives when your first idea is taken.
        </p>

        <form onSubmit={onSubmit} className="mx-auto mt-10 max-w-[700px]">
          <label htmlFor="username" className="sr-only">
            Username to check
          </label>
          <div className="flex flex-col gap-2 rounded-[20px] border border-white/10 bg-white/[0.045] p-2 shadow-[0_32px_80px_-28px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:flex-row">
            <div className="relative flex min-w-0 flex-1 items-center">
              <span className="pointer-events-none absolute left-4 font-mono text-xl text-[#6b7186]">
                @
              </span>
              <input
                id="username"
                name="username"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="neonforge"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-14 w-full rounded-2xl border border-transparent bg-transparent pl-10 pr-4 font-mono text-lg text-white placeholder:text-[#51586c] focus:border-[#5b8cff]/60 focus:outline-none focus:ring-2 focus:ring-[#5b8cff]/30"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !normalizeInput(username)}
              className="h-14 rounded-2xl bg-gradient-to-br from-[#5b8cff] to-[#8a7bff] px-7 text-base font-black text-[#07080f] shadow-[0_16px_35px_rgba(91,140,255,0.28)] transition disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isLoading ? "Checking..." : "Check Name ↗"}
            </button>
          </div>
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
          <div className="mb-6 grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] sm:grid-cols-3">
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
            </div>
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

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-[#a33242]/70 bg-[#351017] px-4 py-3 text-sm font-semibold text-[#ff8c98]"
            >
              {error}
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {PLATFORM_META.map((platform) => (
              <PlatformRow
                key={platform.name}
                initials={platform.initials}
                name={platform.name}
                url={platform.displayUrl(displayHandle)}
                result={resultByName.get(platform.name)}
                loading={isLoading && !resultByName.has(platform.name)}
              />
            ))}
          </ul>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 text-sm font-black text-white">Domains</div>
            <ul className="flex flex-col gap-2">
              {DOMAIN_META.map((domain) => {
                const result = resultByName.get(domain.name);
                const domainName = `${displayHandle.toLowerCase()}${domain.extension}`;
                return (
                  <DomainRow
                    key={domain.name}
                    domain={domainName}
                    result={result}
                    loading={isLoading && !result}
                  />
                );
              })}
            </ul>
          </div>
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

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="mb-1 text-xs font-bold uppercase text-[#5b8cff]">
              Smart alternatives
            </div>
            <h2 className="text-lg font-black text-white">
              Stronger variations of {displayHandle}
            </h2>
            <div className="mt-4 space-y-2">
              {alternatives.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => checkNamed(item.name)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left hover:border-[#5b8cff]/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-bold text-white">
                      {item.name}
                    </span>
                    <span className="block text-xs text-[#7e859b]">
                      {item.tag}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-black text-[#6fe9b4]">
                      {item.score}
                    </span>
                    <span className="text-xs font-bold text-[#8fb0ff]">
                      Check
                    </span>
                  </span>
                </button>
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
        <div className="grid gap-8 rounded-[30px] border border-[#5b8cff]/30 bg-[#5b8cff]/10 p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 text-xs font-black text-white">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#5b8cff] to-[#9b7bff] text-xs text-[#07080f]">
                ★
              </span>
              Pro
            </div>
            <h2 className="text-3xl font-black text-white sm:text-4xl">
              NameNotTaken Pro
            </h2>
            <p className="mt-4 max-w-[42ch] leading-7 text-[#c2c7d8]">
              Save your searches, compare names, export a full brand report,
              and generate smarter alternatives with AI.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#search"
                className="rounded-2xl bg-gradient-to-br from-[#5b8cff] to-[#8a7bff] px-6 py-3 text-sm font-black text-[#07080f]"
              >
                Join Waitlist
              </a>
              <a
                href="#features"
                className="rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-bold text-white"
              >
                View Pro Features
              </a>
            </div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/30 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-black text-white">Saved names</span>
              <span className="text-xs font-bold text-[#8fb0ff]">4 saved</span>
            </div>
            <div className="space-y-2">
              {alternatives.slice(0, 3).map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <span className="min-w-0 truncate font-mono text-sm text-white">
                    {item.name}
                  </span>
                  <span className="font-black text-[#6fe9b4]">{item.score}</span>
                </div>
              ))}
            </div>
            <div className="my-4 h-px bg-white/10" />
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-3 text-xs font-black uppercase text-[#7e859b]">
                Score comparison
              </div>
              {[displayHandle, bestAlternative.name].map((name, index) => {
                const value = index === 0 ? score : bestAlternative.score;
                return (
                  <div
                    key={name}
                    className={index === 0 ? "flex items-center gap-3" : "mt-3 flex items-center gap-3"}
                  >
                    <span className="w-28 truncate font-mono text-xs text-[#aab0c4]">
                      {name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={
                          index === 0
                            ? "h-full rounded-full bg-[#5b8cff]"
                            : "h-full rounded-full bg-[#46e0a0]"
                        }
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-black text-white">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
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
          <div className="flex gap-6 text-sm text-[#aab0c4]">
            <a className="hover:text-white" href="#search">
              Privacy
            </a>
            <a className="hover:text-white" href="#search">
              Terms
            </a>
            <a className="hover:text-white" href="#search">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
