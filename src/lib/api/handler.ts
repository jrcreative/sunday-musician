import { NextResponse } from "next/server";

// Wraps an API route handler so uncaught throws come back as JSON instead of
// Next's HTML error page (which makes `res.json()` blow up on the client).
export function withJsonErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server error";
      console.error("[api]", msg, e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}
