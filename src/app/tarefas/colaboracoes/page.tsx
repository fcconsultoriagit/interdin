import { redirect } from "next/navigation";

export default function ColaboracoesPage() {
  redirect("/tarefas/minhas?tab=colaboracoes");
}
