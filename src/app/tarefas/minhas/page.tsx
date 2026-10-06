import type { Metadata } from "next";
import { MyTasksPage } from "@/components/task-list-page";
import { PageAccessGuard } from "@/components/page-access-guard";

export const metadata: Metadata = {
  title: "Minhas Tarefas | InterDin",
};

export default async function MinhasTarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "colaboracoes" ? "ondeColaboro" : "atribuídas";

  return (
    <PageAccessGuard resource="minhas-tarefas">
      <MyTasksPage initialTab={initialTab} />
    </PageAccessGuard>
  );
}
