import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDb } from "@/lib/db";
import { isShopAccessAllowed } from "@/lib/saas";
import { Shop, User } from "@/models";
import { loginSchema } from "@/schemas/domain";
import type { Permission } from "@/types";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        await connectDb();
        const user = await User.findOne({ email: parsed.data.email, status: "active", deletedAt: { $exists: false } }).lean();
        if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;

        if (user.role !== "super_admin") {
          if (!user.shopId) return null;
          const shop = await Shop.findById(user.shopId).lean();
          if (!shop) return null;
          // Allow login for pending/expired so owner can see status page
          if (shop.status === "rejected" || shop.status === "suspended") return null;
        }

        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

        try {
          const { logActivity } = await import("@/lib/activity");
          const { getClientDeviceInfo } = await import("@/lib/request-meta");
          const info = getClientDeviceInfo(req as { headers?: Headers } | null);
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
          });
        } catch {
          // Never block authentication on audit logging failures.
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions as Permission[],
          shopId: user.shopId ? user.shopId.toString() : null,
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
