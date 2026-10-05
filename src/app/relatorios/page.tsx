import { FileText } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function RelatoriosPage() {
  return (
    <PageAccessGuard resource="relatorios">
      <ModulePlaceholder
        section="Relatórios"
        category="OPERAÇÕES E ANÁLISES"
        description="Acesse os relatórios e análises institucionais."
        icon={FileText}
      />
    </PageAccessGuard>
  );
}
