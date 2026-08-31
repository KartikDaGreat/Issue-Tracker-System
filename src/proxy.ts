import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection and security headers.
 *
 * Renamed from `middleware.ts`: Next.js 16 deprecates that filename and the
 * `middleware` export in favour of `proxy` / `proxy.ts`.
 *
 * These checks are an optimistic first pass — every API route and server
 * component still enforces its own authorisation.
 */

const ROLE_GATES: { prefix: string; allowed: string[] }[] = [
  { prefix: "/admin", allowed: ["ADMIN"] },
  {
    prefix: "/inventory",
    allowed: ["ADMIN", "OFFICE_MANAGER", "FACILITIES_MANAGER"],
  },
  { prefix: "/reports", allowed: ["ADMIN", "PRINCIPAL"] },
];

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

function withSecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
  // HSTS only means anything over TLS, and would lock out local http testing.
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return res;
}

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/login")) {
    if (token) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL("/dashboard", req.url))
      );
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    // Preserve the query string too, so a filtered deep link survives login.
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  const role = token.role as string | undefined;
  for (const gate of ROLE_GATES) {
    const inScope =
      pathname === gate.prefix || pathname.startsWith(`${gate.prefix}/`);
    if (inScope && (!role || !gate.allowed.includes(role))) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL("/dashboard", req.url))
      );
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tickets/:path*",
    "/admin/:path*",
    "/inventory/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/login",
  ],
};
