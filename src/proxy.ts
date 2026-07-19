import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");
  const isLoaderIoVerification = pathname.startsWith("/loaderio-");
  const isPublicRoute = pathname === "/" || pathname.startsWith("/browse") || isLoaderIoVerification;
  // /api routes do their own auth (server actions use the cookie session;
  // cron endpoints use a bearer token). Skip the redirect-to-login wrapper.
  const isApiRoute = pathname.startsWith("/api");

  if (!user && !isAuthRoute && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    // An authenticated session with no matching profiles row is orphaned
    // (e.g. test data was cleared without signing the user out). Bouncing
    // it straight to /dashboard would just send it back here in a loop the
    // next time it hits a route that redirects on a missing profile — sign
    // it out instead so the login page loads normally.
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!profile) {
      await supabase.auth.signOut();
      return supabaseResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|fonts|.*\\.svg).*)"],
};
