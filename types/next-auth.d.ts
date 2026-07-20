import type { DefaultSession } from "next-auth";
import type { Permission, Role } from "@/types";

declare module "next-auth" {
  interface User {
    role: Role;
    permissions: Permission[];
    shopId?: string | null;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      permissions: Permission[];
      shopId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    permissions: Permission[];
    shopId?: string | null;
  }
}
