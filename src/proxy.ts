import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and writes the renewed
// cookies onto the response. Server Components can't set cookies, so without
// this an expired access token (~1 hour) is refreshed server-side, the new
// refresh token is thrown away, and the user is silently signed out.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          // Cache headers the library sends with auth cookies, so no CDN
          // ever serves one user's session cookie to another user.
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Must run before anything else reads the session: this is what triggers
  // the refresh (and the setAll above) when the access token has expired.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Skip static assets, the service worker and the PWA manifest.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|swe-worker|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
