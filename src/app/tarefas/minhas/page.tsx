import type { Metadata } from "next";
import { ListTodo } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PageAccessGuard } from "@/components/page-access-guard";

export const metadata: Metadata = {
  title: "Minhas Tarefas | InterDin",
};

export default function MinhasTarefasPage() {
  return (
    <PageAccessGuard resource="minhas-tarefas">
      <ModulePlaceholder
        section="Minhas Tarefas"
        category="GESTÃO DE TAREFAS"
        description="Consulte as tarefas atribuídas ao seu usuário."
        icon={ListTodo}
      />
    </PageAccessGuard>
  );
}
