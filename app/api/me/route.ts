import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/plan";
import { entitlementFor } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the caller's sign-in state, plan, and entitlements for the client. */
export async function GET() {
  const { signedIn, plan } = await getUserPlan();
  return NextResponse.json(
    { signedIn, plan, entitlement: entitlementFor(plan) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
