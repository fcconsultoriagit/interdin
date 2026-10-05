import { AppFrame } from "@/components/app-frame";
import { PageAccessGuard } from "@/components/page-access-guard";
import { ReferentialManager } from "@/components/referential-manager";

export default function UnidadesPage() {
  return (
    <PageAccessGuard resource="unidades">
      <AppFrame section="Unidades">
        <ReferentialManager kind="unidades" />
      </AppFrame>
    </PageAccessGuard>
  );
}
