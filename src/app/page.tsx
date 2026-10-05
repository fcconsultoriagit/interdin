import { PageAccessGuard } from "@/components/page-access-guard";
import ProfilesPage from "@/components/profiles-page";

export default function HomePage() {
  return (
    <PageAccessGuard resource="perfis">
      <ProfilesPage />
    </PageAccessGuard>
  );
}
