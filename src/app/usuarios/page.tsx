import { PageAccessGuard } from "@/components/page-access-guard";
import UsuariosPage from "@/components/users-page";

export default function UsuariosRoute() {
  return (
    <PageAccessGuard resource="usuarios">
      <UsuariosPage />
    </PageAccessGuard>
  );
}
