import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { MeetingAgendasPage } from "@/components/meeting-agendas-page";
import { obterSessaoAtual } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Agendas de Reuniões | InterDin",
};

export default async function AgendasPage() {
  const user = await obterSessaoAtual();
  if (!user) redirect("/login");
  if (!can(user.permissoes, "reunioes", "visualizar")) return <AccessDenied />;
  return <MeetingAgendasPage />;
}
