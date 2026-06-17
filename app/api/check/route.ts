import { NextResponse } from "next/server";
import { adapters } from "@/lib/platforms";
import { runAdapter } from "@/lib/check";
import { isPlausibleHandle, normalizeHandle } from "@/lib/validation";

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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      await Promise.allSettled(
        adapters.map(async (adapter) => {
          const result = await runAdapter(adapter, username);
          try {
            controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
          } catch {
            // Client disconnected mid-stream; other adapters will also fail but
            // Promise.allSettled absorbs the errors cleanly.
          }
        })
      );
      try {
        controller.close();
      } catch {
        // Already closed due to client disconnect.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
