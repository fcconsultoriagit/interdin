import { Share2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function ColaboracoesPage() {
  return (
    <ModulePlaceholder
      section="Colaborações"
      category="GESTÃO DE TAREFAS"
      description="Acompanhe tarefas compartilhadas e colaborações entre equipes."
      icon={Share2}
    />
  );
}
