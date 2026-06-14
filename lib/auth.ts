import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDb } from "@/lib/db";
import { User } from "@/models";
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
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        await connectDb();
        const user = await User.findOne({ email: parsed.data.email, status: "active", deletedAt: { $exists: false } }).lean();
        if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions as Permission[],
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.permissions = token.permissions;
      }
      return session;
    },
  },
};
