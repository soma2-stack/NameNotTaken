import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";

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
 * Opens the Stripe Billing Portal so a subscriber can update, upgrade, or
 * cancel their plan. Requires a signed-in user with a known Stripe customer.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const customerId = user.privateMetadata?.stripeCustomerId as
    | string
    | undefined;

  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account found yet. Subscribe first." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${originFor(req)}/#pricing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("billing-portal error", err);
    return NextResponse.json(
      { error: "Could not open the billing portal. Please try again." },
      { status: 500 }
    );
  }
}
