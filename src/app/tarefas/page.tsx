import { TaskListPage } from "@/components/task-list-page";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function TodasTarefasPage() {
  return (
    <PageAccessGuard resource="tarefas">
      <TaskListPage />
    </PageAccessGuard>
  );
}
