import { NextResponse } from "next/server";
import { checkAll } from "@/lib/check";
import { isPlausibleHandle, normalizeHandle } from "@/lib/validation";

// Always run on-demand; never statically cache the probe results.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("username") ?? "";
  const username = normalizeHandle(raw);

  if (!username) {
    return NextResponse.json(
      { error: "Missing 'username' query parameter." },
      { status: 400 }
    );
  }

  if (!isPlausibleHandle(username)) {
    return NextResponse.json(
      {
        error:
          "Invalid username. Use letters, numbers, '.', '_' or '-' (max 50 chars).",
      },
      { status: 400 }
    );
  }

  const results = await checkAll(username);
  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
