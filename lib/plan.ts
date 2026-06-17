import { auth, clerkClient } from "@clerk/nextjs/server";
import { normalizePlan, type Plan } from "./billing";

export interface UserPlan {
  signedIn: boolean;
  userId: string | null;
  plan: Plan;
}

/**
 * Resolve the current request's plan from Clerk. Anonymous visitors (and any
 * user without a subscription) are treated as "free". The plan lives in the
 * user's publicMetadata, written by the Stripe webhook — so this is the
 * authoritative, browser-proof source for entitlement decisions.
 */
export async function getUserPlan(): Promise<UserPlan> {
  const { userId } = await auth();
  if (!userId) {
    return { signedIn: false, userId: null, plan: "free" };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return {
      signedIn: true,
      userId,
      plan: normalizePlan(user.publicMetadata?.plan),
    };
  } catch {
    // If Clerk is unreachable, fail closed to the free plan rather than 500.
    return { signedIn: true, userId, plan: "free" };
  }
}
