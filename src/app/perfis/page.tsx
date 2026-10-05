import { PageAccessGuard } from "@/components/page-access-guard";
import ProfilesPage from "@/components/profiles-page";

export default function PerfisPage() {
  return (
    <PageAccessGuard resource="perfis">
      <ProfilesPage />
    </PageAccessGuard>
  );
}
