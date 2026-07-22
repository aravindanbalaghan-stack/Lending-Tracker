import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login");
  const isPendingPage = path.startsWith("/pending");

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Check approval status. Unapproved users are held on /pending and can't
    // reach any data page. This is the app-level gate; the database RLS
    // (is_approved) is the second layer that protects the data itself.
    let status = "pending";
    try {
      const { data } = await supabase.rpc("my_approval_status");
      if (typeof data === "string") status = data;
    } catch {
      // If the RPC isn't available yet (migration not run), fail open so the
      // app keeps working — the gate simply isn't active until you run it.
      status = "approved";
    }

    const approved = status === "approved";

    if (!approved && !isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }
    if (approved && (isAuthPage || isPendingPage)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Run the auth middleware on everything EXCEPT:
    //  - Next.js internals (_next/static, _next/image)
    //  - the well-known folder (Digital Asset Links for the Android app)
    //  - any request that has a file extension (.json, .js, .png, .ico, ...)
    // The last point is the important one: it means manifest.json, sw.js,
    // and all icons/screenshots serve as real static files instead of being
    // intercepted by auth and returned as HTML (which broke PWABuilder).
    "/((?!_next/static|_next/image|\\.well-known|[^?]*\\.[a-zA-Z0-9]+(?:$|\\?)).*)",
  ],
};
