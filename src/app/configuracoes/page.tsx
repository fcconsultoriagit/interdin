import { Settings2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function ConfiguracoesPage() {
  return (
    <PageAccessGuard resource="configuracoes">
      <ModulePlaceholder
        section="Configurações gerais"
        category="CONFIGURAÇÕES"
        description="Gerencie as preferências gerais da plataforma."
        icon={Settings2}
      />
    </PageAccessGuard>
  );
}
