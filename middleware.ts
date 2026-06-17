import { clerkMiddleware } from "@clerk/nextjs/server";

// Attaches Clerk auth to every request. It does NOT force sign-in anywhere —
// the app stays fully usable for anonymous (free) visitors. Routes that require
// a signed-in user (checkout, billing portal) enforce that themselves via
// `auth()`. The Stripe webhook is intentionally left unauthenticated; it is
// verified by Stripe signature instead.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
