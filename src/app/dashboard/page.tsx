import { DashboardOverview } from "@/components/dashboard-overview";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function DashboardPage() {
  return (
    <PageAccessGuard resource="painel">
      <DashboardOverview />
    </PageAccessGuard>
  );
}
