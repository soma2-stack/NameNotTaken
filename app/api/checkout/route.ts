import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { priceIdFor, type PaidPlan } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFor(req: Request): string {
  return (
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

/**
 * Creates a Stripe Checkout Session for the signed-in user and returns its URL.
 * The session is tied to the Clerk user id so the webhook can mark the right
 * account as subscribed.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in before upgrading." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan as PaidPlan;
  if (plan !== "pro" && plan !== "business") {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const priceId = priceIdFor(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `The ${plan} price is not configured yet.` },
      { status: 500 }
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress;
  const existingCustomer =
    (user.privateMetadata?.stripeCustomerId as string | undefined) || undefined;

  const origin = originFor(req);

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      // Reuse an existing customer if we have one; otherwise prefill the email.
      ...(existingCustomer
        ? { customer: existingCustomer }
        : email
          ? { customer_email: email }
          : {}),
      // Echoed back on the session and propagated to the subscription so the
      // webhook can resolve the Clerk user on every related event.
      metadata: { clerkUserId: userId, plan },
      subscription_data: { metadata: { clerkUserId: userId, plan } },
      allow_promotion_codes: true,
      success_url: `${origin}/success?plan=${plan}`,
      cancel_url: `${origin}/#pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout error", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
