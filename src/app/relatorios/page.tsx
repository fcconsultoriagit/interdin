import { FileText } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function RelatoriosPage() {
  return (
    <ModulePlaceholder
      section="Relatórios"
      category="OPERAÇÕES E ANÁLISES"
      description="Acesse os relatórios e análises institucionais."
      icon={FileText}
    />
  );
}
