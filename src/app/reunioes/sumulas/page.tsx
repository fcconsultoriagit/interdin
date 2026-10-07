import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { MeetingModulePlaceholder } from "@/components/meeting-module-placeholder";
import { obterSessaoAtual } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Súmulas | Reuniões & Súmulas | InterDin",
};

export default async function SumulasPage() {
  const user = await obterSessaoAtual();
  if (!user) redirect("/login");
  if (!can(user.permissoes, "sumulas", "visualizar")) return <AccessDenied />;
  return <MeetingModulePlaceholder title="Súmulas" description="Consulta e gestão de súmulas de reuniões." />;
}
