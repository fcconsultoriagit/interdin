import type { Metadata } from "next";
import { TaskListPage } from "@/components/task-list-page";
import { PageAccessGuard } from "@/components/page-access-guard";

export const metadata: Metadata = {
  title: "Quadro Kanban | Tarefas | InterDin",
};

export default function KanbanPage() {
  return (
    <PageAccessGuard resource="kanban">
      <PageAccessGuard resource="tarefas">
        <TaskListPage view="kanban" />
      </PageAccessGuard>
    </PageAccessGuard>
  );
}
