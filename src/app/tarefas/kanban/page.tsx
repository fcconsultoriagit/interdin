import { Columns3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function KanbanPage() {
  return (
    <PageAccessGuard resource="kanban">
      <ModulePlaceholder
        section="Quadro Kanban"
        category="GESTÃO DE TAREFAS"
        description="Visualize as tarefas organizadas em um quadro por etapa."
        icon={Columns3}
      />
    </PageAccessGuard>
  );
}
