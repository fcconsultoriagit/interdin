import { LayoutDashboard } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function PainelPage() {
  return (
    <ModulePlaceholder
      section="Visão geral"
      category="PAINEL INSTITUCIONAL"
      description="Acompanhe os principais indicadores e atualizações do sistema."
      icon={LayoutDashboard}
    />
  );
}
