import type { Metadata } from "next";
import { AppFrame } from "@/components/app-frame";
import { CategoryManager } from "@/components/category-manager";
import { PageAccessGuard } from "@/components/page-access-guard";

export const metadata: Metadata = {
  title: "Categorias | Configurações | InterDin",
};

export default function CategoriasPage() {
  return (
    <PageAccessGuard resource="categorias">
      <AppFrame section="Categorias">
        <CategoryManager />
      </AppFrame>
    </PageAccessGuard>
  );
}
