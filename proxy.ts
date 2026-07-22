import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function proxy(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/super-admin") && role !== "super_admin") {
      return NextResponse.redirect(new URL(role === "cashier" ? "/pos" : "/dashboard", req.url));
    }

    if (role === "super_admin" && !path.startsWith("/super-admin")) {
      return NextResponse.redirect(new URL("/super-admin", req.url));
    }

    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return response;
  },
  {
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: [
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
