import { AppFrame } from "@/components/app-frame";
import { ReferentialManager } from "@/components/referential-manager";

export default function UnidadesPage() {
  return (
    <AppFrame section="Unidades">
      <ReferentialManager kind="unidades" />
    </AppFrame>
  );
}
