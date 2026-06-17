/**
 * Billing + entitlement model for AvailifyAi.
 *
 * Real per-user gating: a signed-in user's plan is stored on their Clerk
 * account (publicMetadata.plan) and written there by the Stripe webhook when a
 * subscription starts, changes, or cancels. The server reads that plan to
 * decide what each request is entitled to — the browser cannot fake it.
 *
 * Secrets (Stripe secret key, webhook secret, price IDs) live in server-only
 * env vars. The only public Stripe value is the publishable nothing here — do
 * not put `sk_…` keys in this file.
 */

export type Plan = "free" | "pro" | "business";
export type PaidPlan = "pro" | "business";

export function isPaidPlan(plan: Plan): plan is PaidPlan {
  return plan === "pro" || plan === "business";
}

/** Coerce an unknown value (e.g. Clerk metadata) into a valid Plan. */
export function normalizePlan(value: unknown): Plan {
  return value === "pro" || value === "business" ? value : "free";
}

export interface PlanDisplay {
  key: Plan;
  name: string;
  price: string;
  cadence: string;
}

export const PLAN_DISPLAY: Record<Plan, PlanDisplay> = {
  free: { key: "free", name: "Free", price: "$0", cadence: "/mo" },
  pro: { key: "pro", name: "Pro", price: "$10", cadence: "/mo" },
  business: { key: "business", name: "Business", price: "$29", cadence: "/mo" },
};

/**
 * What each plan is allowed to do. This is the single source of truth consulted
 * on the server (and mirrored to the client for UI state).
 */
export interface Entitlement {
  plan: Plan;
  /** Searches are unbounded for paid plans. */
  unlimitedSearches: boolean;
  /** Total searches allowed on the free plan (ignored when unlimited). */
  freeSearchLimit: number;
  /** Max names accepted by the bulk checker per submission. */
  bulkLimit: number;
  /** Premium TLD checks (.ai, .io, .net, .co) in addition to .com. */
  premiumTlds: boolean;
  /** AI name assistant. */
  aiAssistant: boolean;
  /** Saveable watchlist + alerts. */
  watchlist: boolean;
}

export const ENTITLEMENTS: Record<Plan, Entitlement> = {
  free: {
    plan: "free",
    unlimitedSearches: false,
    freeSearchLimit: 3,
    bulkLimit: 1,
    premiumTlds: false,
    aiAssistant: false,
    watchlist: false,
  },
  pro: {
    plan: "pro",
    unlimitedSearches: true,
    freeSearchLimit: 3,
    bulkLimit: 20,
    premiumTlds: true,
    aiAssistant: true,
    watchlist: true,
  },
  business: {
    plan: "business",
    unlimitedSearches: true,
    freeSearchLimit: 3,
    bulkLimit: 50,
    premiumTlds: true,
    aiAssistant: true,
    watchlist: true,
  },
};

export function entitlementFor(plan: Plan): Entitlement {
  return ENTITLEMENTS[plan] ?? ENTITLEMENTS.free;
}

/**
 * Platform names (from lib/platforms.ts) that are premium-only. The /api/check
 * route strips these from the response for plans without `premiumTlds`, so the
 * paid TLD data never reaches a free client.
 */
export const PREMIUM_TLD_PLATFORMS = new Set<string>([
  "Domain .ai",
  "Domain .io",
  "Domain .net",
  "Domain .co",
]);

/* -------------------------------------------------------------------------- */
/*  Stripe price IDs (server-only env). Create recurring prices in Stripe and  */
/*  paste their `price_…` IDs here via env. These are NOT public.              */
/* -------------------------------------------------------------------------- */

export function priceIdFor(plan: PaidPlan): string {
  return plan === "pro"
    ? process.env.STRIPE_PRO_PRICE_ID ?? ""
    : process.env.STRIPE_BUSINESS_PRICE_ID ?? "";
}

/** Reverse lookup used by the webhook to map a Stripe price back to a plan. */
export function planForPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return "business";
  return null;
}
