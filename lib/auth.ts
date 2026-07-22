import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDb } from "@/lib/db";
import { isShopAccessAllowed } from "@/lib/saas";
import { Shop, User } from "@/models";
import { loginSchema } from "@/schemas/domain";
import type { Permission } from "@/types";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60;
const DEFAULT_MAX_AGE = 8 * 60 * 60;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        await connectDb();
        const user = await User.findOne({ email: parsed.data.email, status: "active", deletedAt: { $exists: false } });
        if (!user) return null;

        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return null;

        const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordOk) {
          const attempts = (user.failedLoginAttempts ?? 0) + 1;
          const update: Record<string, unknown> = { failedLoginAttempts: attempts };
          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            update.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
          }
          await User.updateOne({ _id: user._id }, { $set: update });
          return null;
        }

        if (user.role !== "super_admin") {
          if (!user.shopId) return null;
          const shop = await Shop.findById(user.shopId).lean();
          if (!shop) return null;
          if (shop.status === "rejected" || shop.status === "suspended") return null;
        }

        await User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } },
        );

        try {
          const { logActivity } = await import("@/lib/activity");
          const { getAuthRequestHeaders } = await import("@/lib/auth-request");
          const { getClientDeviceInfo } = await import("@/lib/request-meta");
          const { headers: getHeaders } = await import("next/headers");
          const headerSource = getAuthRequestHeaders() ?? (await getHeaders());
          const info = getClientDeviceInfo({ headers: headerSource });
          await logActivity({
            shopId: user.shopId ? user.shopId.toString() : null,
            userId: user._id.toString(),
            userName: user.name,
            userEmail: user.email,
            userRole: user.role,
            action: "auth.login",
            entity: "user",
            entityId: user._id.toString(),
            module: "Auth",
            description: `Login: ${user.email}`,
            ip: info.ip,
            browser: info.browser,
            device: info.device,
            userAgent: info.userAgent,
            req: { headers: headerSource },
          });
        } catch {
          // Never block authentication on audit logging failures.
        }

        const remember = credentials?.remember === "true";

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions as Permission[],
          shopId: user.shopId ? user.shopId.toString() : null,
          remember,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.permissions = user.permissions;
        token.shopId = user.shopId ?? null;
        const remember = (user as { remember?: boolean }).remember;
        const maxAge = remember ? REMEMBER_MAX_AGE : DEFAULT_MAX_AGE;
        token.exp = Math.floor(Date.now() / 1000) + maxAge;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.permissions = token.permissions;
        session.user.shopId = token.shopId ?? null;
      }
      return session;
    },
  },
};

export async function refreshShopAccess(shopId: string | null | undefined) {
  if (!shopId) return false;
  await connectDb();
  const shop = await Shop.findById(shopId).lean();
  if (!shop) return false;
  if (shop.status === "active" && shop.expiresAt && new Date(shop.expiresAt).getTime() <= Date.now()) {
    await Shop.updateOne({ _id: shop._id }, { $set: { status: "expired" } });
    return false;
  }
  return isShopAccessAllowed(shop);
}
