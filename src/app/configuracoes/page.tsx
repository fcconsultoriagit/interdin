import { Settings2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function ConfiguracoesPage() {
  return (
    <ModulePlaceholder
      section="Configurações gerais"
      category="CONFIGURAÇÕES"
      description="Gerencie as preferências gerais da plataforma."
      icon={Settings2}
    />
  );
}
