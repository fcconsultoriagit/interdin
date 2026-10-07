import { AppFrame } from "@/components/app-frame";
import { FileText } from "lucide-react";

export function MeetingModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppFrame section={title} breadcrumbParent="Reuniões & Súmulas">
      <div className="page-wrap meeting-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><FileText size={15} /> REUNIÕES & SÚMULAS</div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </div>
        <section className="meeting-empty">
          <FileText size={28} />
          <h2>Módulo em preparação</h2>
          <p>Esta área está prevista na navegação e será disponibilizada numa próxima etapa.</p>
        </section>
      </div>
    </AppFrame>
  );
}
