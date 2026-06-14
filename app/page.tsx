import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getRoleLandingPath } from "@/lib/access";
import { authOptions } from "@/lib/auth";
import type { Role } from "@/types";

export default async function Home() {
  const session = await getServerSession(authOptions);
  redirect(getRoleLandingPath(session?.user?.role as Role | undefined));
}
