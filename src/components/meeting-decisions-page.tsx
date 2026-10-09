"use client";

import { AlertCircle, CalendarDays, CheckCircle2, ClipboardList, LoaderCircle, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

type DecisionStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO";
type MeetingDecision = {
  id: string;
  assunto: string;
  deliberacao: string;
  responsavelNome: string;
  responsavelEmail: string;
  prazo: string | null;
  status: DecisionStatus;
  sumula: {
    id: string;
    codigo: string;
    titulo: string;
    privada: boolean;
    autorId: string;
    autor: { nome: string };
  };
};

const decisionStatusLabels: Record<DecisionStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
};

export function MeetingDecisionsPage() {
  const { hasPermission, user } = useAuthPermissions();
  const canEdit = hasPermission("decisoes", "editar");
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODAS");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reunioes/decisoes", { cache: "no-store" });
      const result = await response.json() as { decisoes?: MeetingDecision[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as decisões.");
      setDecisions(result.decisoes ?? []);
    } catch (loadError) {
      console.error("Falha ao carregar decisões:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as decisões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load server data after mounting the interactive page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDecisions();
  }, [loadDecisions]);

  const visibleDecisions = useMemo(() => decisions.filter((decision) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !normalizedQuery ||
      decision.assunto.toLocaleLowerCase("pt-BR").includes(normalizedQuery) ||
      decision.deliberacao.toLocaleLowerCase("pt-BR").includes(normalizedQuery) ||
      decision.sumula.codigo.toLocaleLowerCase("pt-BR").includes(normalizedQuery) ||
      decision.sumula.titulo.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    return matchesQuery && (statusFilter === "TODAS" || decision.status === statusFilter);
  }), [decisions, query, statusFilter]);

  async function updateStatus(decision: MeetingDecision, status: DecisionStatus) {
    setUpdatingId(decision.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/reunioes/decisoes/${decision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar a decisão.");
      setDecisions((current) => current.map((item) => item.id === decision.id ? { ...item, status } : item));
      setNotice(`Status da decisão "${decision.assunto}" atualizado para ${decisionStatusLabels[status]}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível atualizar a decisão.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <AppFrame section="Decisões" breadcrumbParent="Reuniões & Súmulas">
      <div className="page-wrap meeting-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><ClipboardList size={15} /> REUNIÕES & SÚMULAS</div>
            <h1>Decisões e Encaminhamentos</h1>
            <p>Acompanhe os responsáveis e prazos das deliberações registradas nas súmulas.</p>
          </div>
        </div>
        {notice && <div className="feedback success-feedback" role="status"><CheckCircle2 size={17} />{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {error && <div className="feedback error-feedback" role="alert"><AlertCircle size={17} />{error}<button type="button" aria-label="Fechar erro" onClick={() => setError("")}><X size={16} /></button></div>}
        <div className="meeting-sumula-filters">
          <label className="meeting-sumula-search">Pesquisar
            <input className="form-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Assunto, deliberação ou código SUM-…" />
          </label>
          <label>Status
            <select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="TODAS">Todos os status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </label>
        </div>
        {loading ? <div className="meeting-loading"><LoaderCircle size={19} className="spin" /> Carregando decisões…</div> : visibleDecisions.length === 0 ? (
          <section className="meeting-empty"><ClipboardList size={28} /><h2>{decisions.length ? "Nenhuma decisão encontrada" : "Nenhuma decisão registrada"}</h2><p>{decisions.length ? "Altere os filtros ou a pesquisa." : "As decisões das súmulas que você pode visualizar aparecerão aqui."}</p></section>
        ) : (
          <div className="meeting-agenda-list">
            {visibleDecisions.map((decision) => {
              const canManage = canEdit && decision.sumula.autorId === user?.id;
              return (
                <article className="meeting-agenda-card meeting-decision-card" key={decision.id}>
                  <div className="meeting-agenda-card-main">
                    <div className="meeting-card-heading">
                      <div><span className="meeting-sumula-code">{decision.sumula.codigo}</span><h2>{decision.assunto}</h2></div>
                      <span className={`meeting-decision-status meeting-decision-status-${decision.status.toLowerCase()}`}>{decisionStatusLabels[decision.status]}</span>
                    </div>
                    <p className="meeting-decision-description">{decision.deliberacao}</p>
                    <div className="meeting-card-details">
                      <span><ClipboardList size={16} />Súmula: {decision.sumula.titulo}</span>
                      <span><UserRound size={16} />{decision.responsavelNome}{decision.responsavelEmail ? ` · ${decision.responsavelEmail}` : ""}</span>
                      <span><CalendarDays size={16} />Prazo: {decision.prazo ? new Date(decision.prazo).toLocaleDateString("pt-BR", { dateStyle: "medium", timeZone: "America/Bahia" }) : "Não definido"}</span>
                    </div>
                  </div>
                  {canManage && (
                    <label className="meeting-decision-status-control">Atualizar status
                      <select
                        className="form-input"
                        value={decision.status}
                        disabled={updatingId === decision.id}
                        onChange={(event) => void updateStatus(decision, event.target.value as DecisionStatus)}
                      >
                        <option value="PENDENTE">Pendente</option>
                        <option value="EM_ANDAMENTO">Em andamento</option>
                        <option value="CONCLUIDO">Concluído</option>
                      </select>
                      {updatingId === decision.id && <LoaderCircle size={15} className="spin" />}
                    </label>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppFrame>
  );
}
