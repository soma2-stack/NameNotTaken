import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Lazily construct the Stripe client so importing this module never throws at
 * build time when STRIPE_SECRET_KEY is absent. The key is read from the
 * environment and must be a server-only secret (`sk_…`) — never NEXT_PUBLIC.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your environment to enable payments."
    );
  }
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}
