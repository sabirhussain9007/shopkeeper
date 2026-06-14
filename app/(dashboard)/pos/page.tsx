import { PosTerminal } from "@/features/pos/pos-terminal";
import { requirePermission } from "@/lib/rbac";

export default async function PosPage() {
  await requirePermission("pos:write");
  return <PosTerminal />;
}
