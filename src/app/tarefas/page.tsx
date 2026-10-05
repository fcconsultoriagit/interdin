import { ListChecks } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function TodasTarefasPage() {
  return (
    <PageAccessGuard resource="tarefas">
      <ModulePlaceholder
        section="Todas as Tarefas"
        category="GESTÃO DE TAREFAS"
        description="Consulte e acompanhe as tarefas registradas no sistema."
        icon={ListChecks}
      />
    </PageAccessGuard>
  );
}
