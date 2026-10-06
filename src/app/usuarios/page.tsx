import type { Metadata } from "next";
import { PageAccessGuard } from "@/components/page-access-guard";
import UsuariosPage from "@/components/users-page";

export const metadata: Metadata = {
  title: "Usuários | Configurações | InterDin",
};

export default function UsuariosRoute() {
  return (
    <PageAccessGuard resource="usuarios">
      <UsuariosPage />
    </PageAccessGuard>
  );
}
