import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";
import { getRoleLandingPath } from "@/lib/access";
import type { Role } from "@/types";

// Pages that only make sense for signed-out visitors.
const guestOnlyPaths = new Set(["/login", "/signup", "/create-shop", "/forgot-password", "/reset-password"]);

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

const authProxy = withAuth(
  function proxy(req) {
    const role = req.nextauth.token?.role as Role | undefined;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/super-admin") && role !== "super_admin") {
      return NextResponse.redirect(new URL(role === "cashier" ? "/pos" : "/dashboard", req.url));
    }

    if (role === "super_admin" && !path.startsWith("/super-admin")) {
      return NextResponse.redirect(new URL("/super-admin", req.url));
    }

    return withSecurityHeaders(NextResponse.next());
  },
  {
    pages: {
      signIn: "/login",
    },
  },
);

// `withAuth` returns early on its own sign-in page (and would bounce signed-out visitors
// away from the other guest pages), so guest-only routes are resolved before delegating.
export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (guestOnlyPaths.has(req.nextUrl.pathname)) {
    const token = await getToken({ req });
    if (token) return NextResponse.redirect(new URL(getRoleLandingPath(token.role as Role), req.url));
    return withSecurityHeaders(NextResponse.next());
  }

  return authProxy(req as NextRequestWithAuth, event);
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/create-shop",
    "/forgot-password",
    "/reset-password",
    "/dashboard/:path*",
    "/inventory/:path*",
    "/categories/:path*",
    "/brands/:path*",
    "/customers/:path*",
    "/vendors/:path*",
    "/suppliers/:path*",
    "/pos/:path*",
    "/ledger/:path*",
    "/sales/:path*",
    "/purchases/:path*",
    "/spot-purchases/:path*",
    "/employees/:path*",
    "/attendance/:path*",
    "/salaries/:path*",
    "/expenses/:path*",
    "/activity/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/accounting/:path*",
    "/bank/:path*",
    "/warehouses/:path*",
    "/customer-groups/:path*",
    "/coupons/:path*",
    "/login-history/:path*",
    "/super-admin/:path*",
  ],
};
