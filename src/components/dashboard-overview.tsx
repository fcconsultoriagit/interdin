"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Cake,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FolderOpen,
  Hourglass,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { AppFrame } from "@/components/app-frame";

const processMetrics = [
  { label: "Todos", icon: FolderOpen, tone: "navy" },
  { label: "Em andamento", icon: Clock3, tone: "blue" },
  { label: "Pendentes", icon: Hourglass, tone: "gold" },
  { label: "Concluídos", icon: CheckCircle2, tone: "green" },
] as const;

const taskMetrics = [
  { label: "Total de Tarefas", icon: ClipboardCheck, tone: "navy" },
  { label: "Próximas do Prazo", icon: CalendarDays, tone: "blue" },
  { label: "Atrasadas", icon: AlertCircle, tone: "gold" },
  { label: "Decisões Atrasadas", icon: Clock3, tone: "red" },
] as const;

const scopeOptions = [
  "Visão Geral (Todos)",
  "Minha Unidade",
  "Minhas Atribuições",
] as const;

export function DashboardOverview() {
  const { user } = useAuthPermissions();
  const [scope, setScope] = useState<(typeof scopeOptions)[number]>(scopeOptions[0]);
  const unidade = user?.unidadeNome ?? "sua unidade";
  const greeting = scope === "Minha Unidade"
    ? `Acompanhe os indicadores da unidade ${unidade}.`
    : scope === "Minhas Atribuições"
      ? "Acompanhe suas tarefas e atribuições."
      : `Esta é a visão geral de todas as tarefas na ${unidade}.`;

  return (
    <AppFrame section="Visão geral">
      <div className="page-wrap dashboard-page">
        <section className="dashboard-welcome" aria-labelledby="dashboard-title">
          <div className="dashboard-welcome-copy">
            <span className="eyebrow">PAINEL INSTITUCIONAL</span>
            <h1 id="dashboard-title">Olá, {user?.nome ?? "usuário"}</h1>
            <p>{greeting}</p>
          </div>
          <label className="dashboard-scope">
            <span>Escopo da visão</span>
            <select
              aria-label="Filtrar escopo do dashboard"
              value={scope}
              onChange={(event) => {
                const nextScope = scopeOptions.find((option) => option === event.currentTarget.value);
                if (nextScope) setScope(nextScope);
              }}
            >
              {scopeOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </section>

        <section className="dashboard-section" aria-labelledby="collaborators-title">
          <div className="dashboard-section-heading">
            <span className="dashboard-section-icon"><UsersRound size={20} /></span>
            <div>
              <h2 id="collaborators-title">Colaboradores</h2>
              <p>Aniversários e equipe</p>
            </div>
          </div>
          <div className="dashboard-birthday-grid">
            <article className="dashboard-birthday-card">
              <div className="dashboard-card-heading">
                <span className="dashboard-card-icon gold"><Cake size={20} /></span>
                <h3>Aniversariante do Dia</h3>
              </div>
              <div className="dashboard-empty-birthday">
                <p>As datas de nascimento dos colaboradores ainda não estão cadastradas.</p>
              </div>
            </article>

            <article className="dashboard-birthday-card">
              <div className="dashboard-card-heading">
                <span className="dashboard-card-icon blue"><CalendarDays size={20} /></span>
                <h3>Aniversariantes do Mês</h3>
                <Link className="dashboard-subtle-link" href="/usuarios">Ver todos</Link>
              </div>
              <div className="dashboard-empty-birthday">
                <p>Cadastre as datas de nascimento para acompanhar os próximos aniversários.</p>
              </div>
            </article>
          </div>
        </section>

        <DashboardMetricSection
          title="Processos Administrativos"
          description="Acompanhe o andamento dos processos administrativos."
          icon={FolderOpen}
          metrics={processMetrics}
          emptyLabel="O módulo de processos ainda não possui dados integrados."
        />

        <DashboardMetricSection
          title="Gestão de Tarefas"
          description="Acompanhe o andamento das tarefas da equipe."
          icon={ClipboardCheck}
          metrics={taskMetrics}
          emptyLabel="Os indicadores serão exibidos quando houver tarefas registradas."
        />
      </div>
    </AppFrame>
  );
}

function DashboardMetricSection({
  title,
  description,
  icon: SectionIcon,
  metrics,
  emptyLabel,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  metrics: typeof processMetrics | typeof taskMetrics;
  emptyLabel: string;
}) {
  return (
    <section className="dashboard-section" aria-label={title}>
      <div className="dashboard-section-heading">
        <span className="dashboard-section-icon"><SectionIcon size={20} /></span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="dashboard-metrics-grid">
        {metrics.map(({ label, icon: Icon, tone }) => (
          <article className="dashboard-metric-card" key={label}>
            <span className={`dashboard-card-icon ${tone}`}><Icon size={20} /></span>
            <div className="dashboard-metric-copy">
              <span>{label}</span>
              <strong aria-label={`${label}: sem dados disponíveis`}>—</strong>
            </div>
          </article>
        ))}
      </div>
      <p className="dashboard-data-note">{emptyLabel}</p>
    </section>
  );
}
