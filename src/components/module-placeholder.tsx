import type { LucideIcon } from "lucide-react";
import { AppFrame } from "@/components/app-frame";

type ModulePlaceholderProps = {
  section: string;
  category: string;
  description: string;
  icon: LucideIcon;
};

export function ModulePlaceholder({
  section,
  category,
  description,
  icon: Icon,
}: ModulePlaceholderProps) {
  return (
    <AppFrame section={section}>
      <div className="page-wrap">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Icon size={15} /> {category}</div>
            <h1>{section}</h1>
            <p>{description}</p>
          </div>
        </div>
        <section className="module-placeholder" aria-labelledby="module-placeholder-title">
          <span className="module-placeholder-icon"><Icon size={23} /></span>
          <div>
            <h2 id="module-placeholder-title">Área em preparação</h2>
            <p>Esta rota já está disponível na navegação. O fluxo operacional desta área ainda não foi implementado.</p>
          </div>
        </section>
      </div>
    </AppFrame>
  );
}
