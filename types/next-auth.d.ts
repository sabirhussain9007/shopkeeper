import type { DefaultSession } from "next-auth";
import type { Permission, Role } from "@/types";

declare module "next-auth" {
  interface User {
    role: Role;
    permissions: Permission[];
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      permissions: Permission[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    permissions: Permission[];
  }
}
