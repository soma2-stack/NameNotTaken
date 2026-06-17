"use client";

import { useState } from "react";
import { PLATFORM_META } from "@/lib/platform-meta";
import type { CheckResult } from "@/lib/types";
import { LoadingRow, ResultRow } from "./components/ResultRow";

type Phase = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [username, setUsername] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const handle = username.trim().replace(/^@+/, "");
    if (!handle) return;

    setPhase("loading");
    setError(null);
    setResults([]);
    setChecked(handle);

    try {
      const res = await fetch(`/api/check?username=${encodeURIComponent(handle)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as CheckResult[];
      setResults(data);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  const availableCount = results.filter((r) => r.status === "available").length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          handle-check
        </h1>
        <p className="mt-2 text-neutral-400">
          See if a username is free across the platforms that matter.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mb-8">
        <label htmlFor="username" className="sr-only">
          Username to check
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-neutral-500">
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
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 py-4 pl-9 pr-4 text-lg text-neutral-100 placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            />
          </div>
          <button
            type="submit"
            disabled={phase === "loading" || !username.trim()}
            className="rounded-xl bg-sky-500 px-6 py-4 text-lg font-semibold text-neutral-950 transition-colors hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "loading" ? "Checking…" : "Check"}
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {phase !== "idle" && (
        <section aria-live="polite">
          {phase === "done" && (
            <p className="mb-3 text-sm text-neutral-400">
              <span className="font-mono text-neutral-200">@{checked}</span> ·{" "}
              {availableCount} available · {results.length} platforms
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {phase === "loading"
              ? PLATFORM_META.map((p) => <LoadingRow key={p.name} name={p.name} />)
              : results.map((r) => <ResultRow key={r.platform} result={r} />)}
          </ul>
        </section>
      )}

      <footer className="mt-auto pt-10 text-center text-xs text-neutral-600">
        <p>
          Tier A checks are real (GitHub, Reddit, YouTube). Tier B is best-effort
          and may report “unknown” — use the Open ↗ link to verify.
        </p>
      </footer>
    </main>
  );
}
