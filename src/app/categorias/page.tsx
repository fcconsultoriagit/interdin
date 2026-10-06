import { AppFrame } from "@/components/app-frame";
import { CategoryManager } from "@/components/category-manager";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function CategoriasPage() {
  return (
    <PageAccessGuard resource="categorias">
      <AppFrame section="Categorias">
        <CategoryManager />
      </AppFrame>
    </PageAccessGuard>
  );
}
