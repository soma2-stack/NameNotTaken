import { clerkClient } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { planForPriceId, type Plan } from "@/lib/billing";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Verifies the signature, then writes the resulting plan onto
 * the Clerk user so the rest of the app can gate features. Configure the
 * endpoint in Stripe to send: checkout.session.completed,
 * customer.subscription.created/updated/deleted. Set STRIPE_WEBHOOK_SECRET to
 * the signing secret Stripe gives you for this endpoint.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured.", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header.", { status: 400 });
  }

  const stripe = getStripe();
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error("Invalid Stripe signature", err);
    return new Response("Invalid signature.", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId =
          session.metadata?.clerkUserId || session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (clerkUserId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const plan =
            planFromSubscription(sub) ??
            ((session.metadata?.plan as Plan | undefined) ?? "free");
          await applyPlan(clerkUserId, plan, sub);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (clerkUserId) {
          const active = sub.status === "active" || sub.status === "trialing";
          const plan = active ? planFromSubscription(sub) ?? "free" : "free";
          await applyPlan(clerkUserId, plan, sub);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (clerkUserId) {
          await applyPlan(clerkUserId, "free", sub);
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error("Webhook handler error", err);
    return new Response("Handler error.", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

/** Map a subscription's price to one of our plans. */
function planFromSubscription(sub: Stripe.Subscription): Plan | null {
  return planForPriceId(sub.items.data[0]?.price?.id);
}

/** Persist the plan + Stripe identifiers onto the Clerk user. */
async function applyPlan(
  clerkUserId: string,
  plan: Plan,
  sub: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const client = await clerkClient();
  await client.users.updateUserMetadata(clerkUserId, {
    // publicMetadata is readable by the client (used for UI state).
    publicMetadata: { plan, subscriptionStatus: sub.status },
    // privateMetadata is server-only (used for checkout / billing portal).
    privateMetadata: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
    },
  });
}
