import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { MeetingModulePlaceholder } from "@/components/meeting-module-placeholder";
import { obterSessaoAtual } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Decisões | Reuniões & Súmulas | InterDin",
};

export default async function DecisoesPage() {
  const user = await obterSessaoAtual();
  if (!user) redirect("/login");
  if (!can(user.permissoes, "decisoes", "visualizar")) return <AccessDenied />;
  return <MeetingModulePlaceholder title="Decisões" description="Consulta e gestão das decisões registradas nas reuniões." />;
}
