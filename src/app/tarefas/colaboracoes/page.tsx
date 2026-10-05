import { Share2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function ColaboracoesPage() {
  return (
    <PageAccessGuard resource="colaboracoes">
      <ModulePlaceholder
        section="Colaborações"
        category="GESTÃO DE TAREFAS"
        description="Acompanhe tarefas compartilhadas e colaborações entre equipes."
        icon={Share2}
      />
    </PageAccessGuard>
  );
}
