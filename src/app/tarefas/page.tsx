import { ListChecks } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function TodasTarefasPage() {
  return (
    <ModulePlaceholder
      section="Todas as Tarefas"
      category="GESTÃO DE TAREFAS"
      description="Consulte e acompanhe as tarefas registradas no sistema."
      icon={ListChecks}
    />
  );
}
