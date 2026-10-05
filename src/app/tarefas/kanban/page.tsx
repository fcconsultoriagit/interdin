import { Columns3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function KanbanPage() {
  return (
    <ModulePlaceholder
      section="Quadro Kanban"
      category="GESTÃO DE TAREFAS"
      description="Visualize as tarefas organizadas em um quadro por etapa."
      icon={Columns3}
    />
  );
}
