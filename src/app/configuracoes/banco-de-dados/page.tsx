import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { DatabaseSettingsPage } from "@/components/database-settings-page";
import { obterSessaoAtual } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Banco de Dados | Configurações | InterDin",
};

export default async function BancoDeDadosPage() {
  const user = await obterSessaoAtual();
  if (!user) redirect("/login");
  if (!user.permissoes.administradorTotal) return <AccessDenied />;
  return <DatabaseSettingsPage />;
}
