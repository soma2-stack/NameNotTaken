import type { Metadata } from "next";
import Link from "next/link";
import { PLAN_DISPLAY, type PaidPlan } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Thanks for upgrading — AvailifyAi",
  description: "Your AvailifyAi subscription is confirmed.",
  robots: { index: false },
};

/** Resolve the ?plan= query param to a known paid plan, if present. */
function resolvePlan(value: string | string[] | undefined): PaidPlan | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.toLowerCase();
  if (raw === "pro") return "pro";
  if (raw === "business") return "business";
  return null;
}

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { plan?: string | string[] };
}) {
  const plan = resolvePlan(searchParams.plan);
  const planName = plan ? PLAN_DISPLAY[plan].name : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#07080f] px-6 py-16 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(91,140,255,0.18), transparent 70%)",
        }}
        aria-hidden
      />
      <section className="relative z-10 w-full max-w-[560px] rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#46e0a0] to-[#1f8f63] shadow-[0_18px_45px_rgba(70,224,160,0.3)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-8 w-8"
            aria-hidden
          >
            <path
              d="M5 12.5l4.2 4.2L19 7"
              stroke="#07080f"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">
          {planName ? `You're on ${planName}!` : "You're all set!"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-[#aab0c4] sm:text-base">
          Thanks for upgrading to AvailifyAi
          {planName ? ` ${planName}` : ""}. Your payment was received and a
          receipt is on its way to your email from Stripe. You can manage or
          cancel your subscription anytime from the billing portal link in that
          email.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/#search"
            className="rounded-2xl bg-white px-6 py-3 text-sm font-black text-[#07080f] transition hover:bg-[#e9ecf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b8cff]"
          >
            Start searching
          </Link>
          <Link
            href="/#pricing"
            className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-bold text-[#c2c7d8] transition hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b8cff]"
          >
            Back to home
          </Link>
        </div>

        <p className="mt-6 text-xs text-[#7e859b]">
          Need help? Email{" "}
          <a
            className="text-[#8fb0ff] underline-offset-4 hover:underline"
            href="mailto:support@availifyai.com"
          >
            support@availifyai.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
