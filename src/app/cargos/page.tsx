import { AppFrame } from "@/components/app-frame";
import { PageAccessGuard } from "@/components/page-access-guard";
import { ReferentialManager } from "@/components/referential-manager";

export default function CargosPage() {
  return (
    <PageAccessGuard resource="cargos">
      <AppFrame section="Cargos">
        <ReferentialManager kind="cargos" />
      </AppFrame>
    </PageAccessGuard>
  );
}
