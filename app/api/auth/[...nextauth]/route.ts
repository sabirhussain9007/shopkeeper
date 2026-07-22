import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { runWithAuthRequest } from "@/lib/auth-request";

const nextAuthHandler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

function withAuthRequest(handler: (req: Request, ctx: RouteContext) => Promise<Response>) {
  return (req: Request, ctx: RouteContext) => runWithAuthRequest(req, () => handler(req, ctx));
}

export const GET = withAuthRequest(nextAuthHandler);
export const POST = withAuthRequest(nextAuthHandler);
