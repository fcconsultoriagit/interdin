import type { Metadata } from "next";
import { PageAccessGuard } from "@/components/page-access-guard";
import { DashboardOverview } from "@/components/dashboard-overview";

export const metadata: Metadata = {
  title: "Visão Geral | InterDin",
};

export default function HomePage() {
  return (
    <PageAccessGuard resource="painel">
      <DashboardOverview />
    </PageAccessGuard>
  );
}
