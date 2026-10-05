import { TaskListPage } from "@/components/task-list-page";
import { PageAccessGuard } from "@/components/page-access-guard";

export default function KanbanPage() {
  return (
    <PageAccessGuard resource="kanban">
      <PageAccessGuard resource="tarefas">
        <TaskListPage view="kanban" />
      </PageAccessGuard>
    </PageAccessGuard>
  );
}
