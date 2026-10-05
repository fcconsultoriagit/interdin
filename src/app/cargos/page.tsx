import { AppFrame } from "@/components/app-frame";
import { ReferentialManager } from "@/components/referential-manager";

export default function CargosPage() {
  return (
    <AppFrame section="Cargos">
      <ReferentialManager kind="cargos" />
    </AppFrame>
  );
}
