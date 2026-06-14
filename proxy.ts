import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/inventory/:path*", "/categories/:path*", "/customers/:path*", "/suppliers/:path*", "/pos/:path*", "/ledger/:path*", "/sales/:path*", "/purchases/:path*", "/reports/:path*", "/settings/:path*"],
};
