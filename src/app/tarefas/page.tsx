import type { Metadata } from "next";
import { TaskListPage } from "@/components/task-list-page";
import { PageAccessGuard } from "@/components/page-access-guard";

export const metadata: Metadata = {
  title: "Todas as Tarefas | InterDin",
};

export default function TodasTarefasPage() {
  return (
    <PageAccessGuard resource="tarefas">
      <TaskListPage />
    </PageAccessGuard>
  );
}
