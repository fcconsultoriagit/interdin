import { LayoutDashboard } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function PainelPage() {
  return (
    <PageAccessGuard resource="painel">
      <ModulePlaceholder
        section="Visão geral"
        category="PAINEL INSTITUCIONAL"
        description="Acompanhe os principais indicadores e atualizações do sistema."
        icon={LayoutDashboard}
      />
    </PageAccessGuard>
  );
}
