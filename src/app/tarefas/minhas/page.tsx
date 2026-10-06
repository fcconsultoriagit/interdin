import type { Metadata } from "next";
import { MyTasksPage } from "@/components/task-list-page";
import { PageAccessGuard } from "@/components/page-access-guard";

export const metadata: Metadata = {
  title: "Minhas Tarefas | InterDin",
};

export default function MinhasTarefasPage() {
  return (
    <PageAccessGuard resource="minhas-tarefas">
      <MyTasksPage />
    </PageAccessGuard>
  );
}
