import { ListTodo } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function MinhasTarefasPage() {
  return (
    <ModulePlaceholder
      section="Minhas Tarefas"
      category="GESTÃO DE TAREFAS"
      description="Consulte as tarefas atribuídas ao seu usuário."
      icon={ListTodo}
    />
  );
}
