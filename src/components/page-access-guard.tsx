import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth";
import { can, type PermissionAction } from "@/lib/rbac";
import { AccessDenied } from "@/components/access-denied";

export async function PageAccessGuard({
  resource,
  action = "visualizar",
  children,
}: {
  resource: string;
  action?: PermissionAction;
  children: ReactNode;
}) {
  const user = await obterSessaoAtual();
  if (!user) redirect("/login");
  if (!can(user.permissoes, resource, action)) return <AccessDenied />;
  return children;
}
