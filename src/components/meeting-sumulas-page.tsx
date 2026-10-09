"use client";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  CirclePlus,
  Clipboard,
  Eye,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/app-frame";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

type SumulaStatus = "RASCUNHO" | "ENVIADA" | "FINALIZADA";
type DecisionStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO";
type MeetingAgendaOption = {
  id: string;
  titulo: string;
  dataHora: string;
  pauta: unknown;
  participantes: Array<{
    userId: string | null;
    nome: string;
    email: string;
    confirmacao: string;
  }>;
};
type SumulaParticipant = {
  id?: string;
  userId: string | null;
  nome: string;
  email: string;
  presencaConfirmada: boolean;
};
type SumulaDecision = {
  id?: string;
  assunto: string;
  deliberacao: string;
  responsavelNome: string;
  responsavelEmail: string;
  prazo: string | null;
  status: DecisionStatus;
};
type MeetingSumula = {
  id: string;
  codigo: string;
  titulo: string;
  dataReuniao: string;
  privada: boolean;
  status: SumulaStatus;
  agendaId: string | null;
  autorId: string;
  autor: { id: string; nome: string };
  agenda: { id: string; titulo: string; dataHora: string } | null;
  participantes: SumulaParticipant[];
  decisoes: SumulaDecision[];
};
type SumulaForm = {
  titulo: string;
  dataReuniao: string;
  privada: boolean;
  agendaId: string;
  participantes: SumulaParticipant[];
  decisoes: SumulaDecision[];
};

const statusLabels: Record<SumulaStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  FINALIZADA: "Finalizada",
};

const blankForm: SumulaForm = {
  titulo: "",
  dataReuniao: "",
  privada: false,
  agendaId: "",
  participantes: [],
  decisoes: [],
};

function dateInputValue(value: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function agendaTopics(value: unknown) {
  return Array.isArray(value)
    ? value.filter((topic): topic is string => typeof topic === "string").map((topic) => topic.trim()).filter(Boolean)
    : [];
}

function formatMeetingDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { dateStyle: "long", timeZone: "America/Bahia" });
}

function emptyDecision(): SumulaDecision {
  return {
    assunto: "",
    deliberacao: "",
    responsavelNome: "",
    responsavelEmail: "",
    prazo: null,
    status: "PENDENTE",
  };
}

export function MeetingSumulasPage() {
  const { hasPermission, user } = useAuthPermissions();
  const canCreate = hasPermission("sumulas", "criar");
  const canEdit = hasPermission("sumulas", "editar");
  const canDelete = hasPermission("sumulas", "excluir");
  const [sumulas, setSumulas] = useState<MeetingSumula[]>([]);
  const [agendas, setAgendas] = useState<MeetingAgendaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODAS");
  const [authorFilter, setAuthorFilter] = useState("TODOS");
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view" | null>(null);
  const [editing, setEditing] = useState<MeetingSumula | null>(null);
  const [form, setForm] = useState<SumulaForm>(blankForm);
  const openedSharedCode = useRef("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sumulaResponse, agendaResponse] = await Promise.all([
        fetch("/api/reunioes/sumulas", { cache: "no-store" }),
        fetch("/api/reunioes/sumulas/agendas", { cache: "no-store" }),
      ]);
      const [sumulaResult, agendaResult] = await Promise.all([
        sumulaResponse.json() as Promise<{ sumulas?: MeetingSumula[]; error?: string }>,
        agendaResponse.json() as Promise<{ agendas?: MeetingAgendaOption[]; error?: string }>,
      ]);
      if (!sumulaResponse.ok) throw new Error(sumulaResult.error ?? "Não foi possível carregar as súmulas.");
      if (!agendaResponse.ok) throw new Error(agendaResult.error ?? "Não foi possível carregar as agendas.");
      setSumulas(sumulaResult.sumulas ?? []);
      setAgendas(agendaResult.agendas ?? []);
    } catch (loadError) {
      console.error("Falha ao carregar o módulo de súmulas:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as súmulas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load server data after mounting the interactive page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const authors = useMemo(() => {
    const byId = new Map(sumulas.map(({ autor }) => [autor.id, autor.nome]));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [sumulas]);

  const visibleSumulas = useMemo(() => sumulas.filter((sumula) => {
    const matchesQuery = !query.trim() ||
      sumula.titulo.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")) ||
      sumula.codigo.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
    return matchesQuery &&
      (statusFilter === "TODAS" || sumula.status === statusFilter) &&
      (authorFilter === "TODOS" || sumula.autorId === authorFilter);
  }), [authorFilter, query, statusFilter, sumulas]);

  function openCreate() {
    setEditing(null);
    setForm({ ...blankForm, dataReuniao: dateInputValue(new Date().toISOString()) });
    setError("");
    setModalMode("create");
  }

  const openSumula = useCallback((sumula: MeetingSumula, mode: "edit" | "view") => {
    setEditing(sumula);
    setForm({
      titulo: sumula.titulo,
      dataReuniao: dateInputValue(sumula.dataReuniao),
      privada: sumula.privada,
      agendaId: sumula.agendaId ?? "",
      participantes: sumula.participantes.map((participant) => ({ ...participant })),
      decisoes: sumula.decisoes.map((decision) => ({ ...decision })),
    });
    setError("");
    setModalMode(mode);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("codigo");
    if (!code || modalMode || openedSharedCode.current === code) return;
    const sharedSumula = sumulas.find((sumula) => sumula.codigo.toLocaleLowerCase("pt-BR") === code.toLocaleLowerCase("pt-BR"));
    if (!sharedSumula) return;
    openedSharedCode.current = code;
    const timer = window.setTimeout(() => openSumula(sharedSumula, "view"), 0);
    return () => window.clearTimeout(timer);
  }, [modalMode, openSumula, sumulas]);

  function linkAgenda(agendaId: string) {
    const agenda = agendas.find((item) => item.id === agendaId);
    if (!agenda) {
      setForm((current) => ({ ...current, agendaId: "", titulo: "", participantes: [] }));
      return;
    }
    setForm((current) => ({
      ...current,
      agendaId,
      titulo: agenda.titulo,
      dataReuniao: dateInputValue(agenda.dataHora),
      participantes: agenda.participantes.map((participant) => ({
        userId: participant.userId,
        nome: participant.nome,
        email: participant.email,
        presencaConfirmada: participant.confirmacao === "CONFIRMADO",
      })),
      decisoes: agendaTopics(agenda.pauta).map((assunto) => ({
        ...emptyDecision(),
        assunto,
      })),
    }));
  }

  function updateParticipant(index: number, patch: Partial<SumulaParticipant>) {
    setForm((current) => ({
      ...current,
      participantes: current.participantes.map((participant, itemIndex) =>
        itemIndex === index ? { ...participant, ...patch } : participant),
    }));
  }

  function updateDecision(index: number, patch: Partial<SumulaDecision>) {
    setForm((current) => ({
      ...current,
      decisoes: current.decisoes.map((decision, itemIndex) =>
        itemIndex === index ? { ...decision, ...patch } : decision),
    }));
  }

  async function saveSumula(event: FormEvent<HTMLFormElement>, targetStatus: SumulaStatus) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        titulo: form.titulo,
        dataReuniao: new Date(`${form.dataReuniao}T12:00:00.000Z`).toISOString(),
        privada: form.privada,
        agendaId: form.agendaId || null,
        status: targetStatus,
        participantes: form.participantes.map(({ userId, nome, email, presencaConfirmada }) => ({
          userId,
          nome,
          email,
          presencaConfirmada,
        })),
        decisoes: form.decisoes.map((decision) => ({
          ...decision,
          prazo: decision.prazo ? new Date(`${decision.prazo}T12:00:00.000Z`).toISOString() : null,
        })),
      };
      const response = await fetch(editing ? `/api/reunioes/sumulas/${editing.id}` : "/api/reunioes/sumulas", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { sumula?: MeetingSumula; error?: string };
      if (!response.ok || !result.sumula) throw new Error(result.error ?? "Não foi possível salvar a súmula.");
      setNotice(targetStatus === "RASCUNHO"
        ? `Rascunho ${result.sumula.codigo} salvo.`
        : targetStatus === "ENVIADA"
          ? `${result.sumula.codigo} salva com status Enviada. O compartilhamento externo pode ser feito pela ação do cartão.`
          : `${result.sumula.codigo} finalizada.`);
      setModalMode(null);
      await loadData();
    } catch (saveError) {
      console.error("Falha ao salvar súmula:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a súmula.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSumula(sumula: MeetingSumula) {
    if (!window.confirm(`Excluir a súmula ${sumula.codigo}? As decisões vinculadas também serão excluídas.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/reunioes/sumulas/${sumula.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível excluir a súmula.");
      setNotice(`Súmula ${sumula.codigo} excluída.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a súmula.");
    }
  }

  async function shareSumula(sumula: MeetingSumula) {
    const link = `${window.location.origin}/reunioes/sumulas?codigo=${encodeURIComponent(sumula.codigo)}`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice(`Link de ${sumula.codigo} copiado para a área de transferência.`);
    } catch (shareError) {
      console.error("Falha ao copiar link da súmula:", shareError);
      setError("Não foi possível copiar o link. Verifique a permissão da área de transferência.");
    }
  }

  return (
    <AppFrame section="Súmulas" breadcrumbParent="Reuniões & Súmulas">
      <div className="page-wrap meeting-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><FileText size={15} /> REUNIÕES & SÚMULAS</div>
            <h1>Súmulas de Reunião</h1>
            <p>Registre participantes, deliberações e encaminhamentos das reuniões.</p>
          </div>
          {canCreate && <button className="button button-primary" type="button" onClick={openCreate}><CirclePlus size={17} /> Nova Súmula</button>}
        </div>
        {notice && <div className="feedback success-feedback" role="status"><CheckCircle2 size={17} />{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {error && !modalMode && <div className="feedback error-feedback" role="alert"><AlertCircle size={17} />{error}<button type="button" aria-label="Fechar erro" onClick={() => setError("")}><X size={16} /></button></div>}

        <div className="meeting-sumula-filters">
          <label className="meeting-sumula-search">Pesquisar
            <input className="form-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título ou código SUM-…" />
          </label>
          <label>Status
            <select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="TODAS">Todos os status</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="ENVIADA">Enviada</option>
              <option value="FINALIZADA">Finalizada</option>
            </select>
          </label>
          <label>Autor
            <select className="form-input" value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
              <option value="TODOS">Todos os autores</option>
              {authors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </div>

        {loading ? <div className="meeting-loading"><LoaderCircle size={19} className="spin" /> Carregando súmulas…</div> : visibleSumulas.length === 0 ? (
          <section className="meeting-empty"><FileText size={28} /><h2>{sumulas.length ? "Nenhuma súmula encontrada" : "Nenhuma súmula cadastrada"}</h2><p>{sumulas.length ? "Altere os filtros ou a pesquisa." : "As súmulas disponíveis para você aparecerão aqui."}</p>{canCreate && sumulas.length === 0 && <button className="button button-secondary" type="button" onClick={openCreate}><Plus size={16} /> Criar primeira súmula</button>}</section>
        ) : (
          <div className="meeting-agenda-list">
            {visibleSumulas.map((sumula) => {
              const manageable = canEdit && sumula.autorId === user?.id;
              return (
                <article className="meeting-agenda-card meeting-sumula-card" key={sumula.id}>
                  <div className="meeting-agenda-card-main">
                    <div className="meeting-card-heading">
                      <div><span className="meeting-sumula-code">{sumula.codigo}</span><h2>{sumula.titulo}</h2>{sumula.privada && <span className="meeting-private-badge"><LockKeyhole size={12} /> Privada</span>}</div>
                      <span className={`meeting-sumula-status meeting-sumula-status-${sumula.status.toLowerCase()}`}>{statusLabels[sumula.status]}</span>
                    </div>
                    <div className="meeting-card-details">
                      <span><CalendarDays size={16} />{formatMeetingDate(sumula.dataReuniao)}</span>
                      {sumula.agenda && <span><FileText size={16} />Agenda: {sumula.agenda.titulo}</span>}
                      <span><Users size={16} />{sumula.participantes.length} participante{sumula.participantes.length === 1 ? "" : "s"}</span>
                      <span>Autoria: {sumula.autor.nome}</span>
                      <span>{sumula.decisoes.length} decisão{sumula.decisoes.length === 1 ? "" : "ões"}</span>
                    </div>
                  </div>
                  <div className="meeting-card-actions">
                    <button className="icon-button" type="button" aria-label={`Visualizar ${sumula.codigo}`} title="Visualizar" onClick={() => openSumula(sumula, "view")}><Eye size={17} /></button>
                    <button className="icon-button" type="button" aria-label={`Compartilhar ${sumula.codigo}`} title="Copiar link para compartilhar" onClick={() => void shareSumula(sumula)}><Clipboard size={17} /></button>
                    {manageable && <button className="icon-button" type="button" aria-label={`Editar ${sumula.codigo}`} title="Editar" onClick={() => openSumula(sumula, "edit")}><Pencil size={17} /></button>}
                    {canDelete && sumula.autorId === user?.id && <button className="icon-button" type="button" aria-label={`Excluir ${sumula.codigo}`} title="Excluir" onClick={() => void deleteSumula(sumula)}><Trash2 size={17} /></button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {modalMode && (
        <div className="modal-backdrop task-modal-backdrop meeting-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalMode(null); }}>
          <section className="create-modal task-modal meeting-modal meeting-sumula-modal" role="dialog" aria-modal="true" aria-labelledby="sumula-modal-title">
            <header className="task-modal-header">
              <span className="modal-icon"><FileText size={22} /></span>
              <div><h2 id="sumula-modal-title">{modalMode === "view" ? "Visualizar Súmula" : editing ? "Editar Súmula" : "Nova Súmula"}</h2><p>{editing ? editing.codigo : "Preencha os detalhes e encaminhamentos da reunião."}</p></div>
              <button className="icon-button" type="button" aria-label="Fechar súmula" disabled={saving} onClick={() => setModalMode(null)}><X size={18} /></button>
            </header>
            <form onSubmit={(event) => {
              const submitter = (event.nativeEvent as SubmitEvent).submitter;
              const targetStatus = submitter instanceof HTMLButtonElement && submitter.value === "enviada"
                ? "ENVIADA"
                : submitter instanceof HTMLButtonElement && submitter.value === "finalizada"
                  ? "FINALIZADA"
                  : "RASCUNHO";
              void saveSumula(event, targetStatus);
            }}>
              <div className="task-form-body meeting-form-body">
                {error && <div className="feedback error-feedback meeting-form-error" role="alert"><AlertCircle size={17} />{error}</div>}
                <div className="meeting-form-grid">
                  <fieldset className="meeting-fieldset meeting-form-wide">
                    <legend>1. Detalhes</legend>
                    <div className="meeting-form-grid meeting-sumula-detail-grid">
                      <label className="form-label">Título*
                        <input className="form-input" required maxLength={240} value={form.titulo} disabled={saving || modalMode === "view"} onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))} />
                      </label>
                      <label className="form-label">Data da reunião*
                        <input className="form-input" type="date" required value={form.dataReuniao} disabled={saving || modalMode === "view"} onChange={(event) => setForm((current) => ({ ...current, dataReuniao: event.target.value }))} />
                      </label>
                      <label className="form-label meeting-form-wide">Vincular a uma Agenda (opcional)
                        <select className="form-input" value={form.agendaId} disabled={saving || modalMode === "view"} onChange={(event) => linkAgenda(event.target.value)}>
                          <option value="">Sem agenda vinculada</option>
                          {agendas.map((agenda) => <option key={agenda.id} value={agenda.id}>{agenda.titulo} · {formatMeetingDate(agenda.dataHora)}</option>)}
                        </select>
                      </label>
                      <label className="meeting-sumula-private-toggle"><input type="checkbox" checked={form.privada} disabled={saving || modalMode === "view"} onChange={(event) => setForm((current) => ({ ...current, privada: event.target.checked }))} /> Súmula privada</label>
                    </div>
                  </fieldset>

                  <fieldset className="meeting-fieldset meeting-form-wide">
                    <legend>2. Decisões e encaminhamentos</legend>
                    {form.decisoes.length === 0 && <p className="meeting-field-hint">Inclua cada deliberação e seu responsável.</p>}
                    {form.decisoes.map((decision, index) => (
                      <div className="meeting-sumula-decision" key={decision.id ?? `decision-${index}`}>
                        <div className="meeting-sumula-decision-heading"><strong>Decisão {index + 1}</strong>{modalMode !== "view" && <button className="icon-button" type="button" disabled={saving} aria-label={`Remover decisão ${index + 1}`} onClick={() => setForm((current) => ({ ...current, decisoes: current.decisoes.filter((_, itemIndex) => itemIndex !== index) }))}><X size={16} /></button>}</div>
                        <div className="meeting-form-grid">
                          <label className="form-label">Assunto
                            <input className="form-input" maxLength={240} value={decision.assunto} disabled={saving || modalMode === "view"} onChange={(event) => updateDecision(index, { assunto: event.target.value })} />
                          </label>
                          <label className="form-label">Prazo
                            <input className="form-input" type="date" value={decision.prazo ? dateInputValue(decision.prazo) : ""} disabled={saving || modalMode === "view"} onChange={(event) => updateDecision(index, { prazo: event.target.value || null })} />
                          </label>
                          <label className="form-label meeting-form-wide">Decisão / Encaminhamento*
                            <textarea className="form-input meeting-sumula-textarea" required maxLength={10000} value={decision.deliberacao} disabled={saving || modalMode === "view"} onChange={(event) => updateDecision(index, { deliberacao: event.target.value })} />
                          </label>
                          <label className="form-label">Responsável (nome)*
                            <input className="form-input" required maxLength={160} value={decision.responsavelNome} disabled={saving || modalMode === "view"} onChange={(event) => updateDecision(index, { responsavelNome: event.target.value })} />
                          </label>
                          <label className="form-label">E-mail do responsável
                            <input className="form-input" type="email" maxLength={254} value={decision.responsavelEmail} disabled={saving || modalMode === "view"} onChange={(event) => updateDecision(index, { responsavelEmail: event.target.value })} />
                          </label>
                        </div>
                      </div>
                    ))}
                    {modalMode !== "view" && <button className="button button-secondary meeting-add-topic" type="button" disabled={saving || form.decisoes.length >= 200} onClick={() => setForm((current) => ({ ...current, decisoes: [...current.decisoes, emptyDecision()] }))}><Plus size={15} /> Adicionar Decisão</button>}
                  </fieldset>

                  <fieldset className="meeting-fieldset meeting-form-wide">
                    <legend>3. Participantes</legend>
                    {form.participantes.length === 0 && <p className="meeting-field-hint">Nenhum participante adicionado.</p>}
                    {form.participantes.map((participant, index) => (
                      <div className="meeting-sumula-participant" key={participant.id ?? `participant-${index}`}>
                        <label className="form-label">Nome
                          <input className="form-input" required maxLength={160} value={participant.nome} disabled={saving || modalMode === "view"} onChange={(event) => updateParticipant(index, { nome: event.target.value })} />
                        </label>
                        <label className="form-label">E-mail
                          <input className="form-input" type="email" required maxLength={254} value={participant.email} disabled={saving || modalMode === "view"} onChange={(event) => updateParticipant(index, { email: event.target.value })} />
                        </label>
                        <label className="meeting-sumula-attendance"><input type="checkbox" checked={participant.presencaConfirmada} disabled={saving || modalMode === "view"} onChange={(event) => updateParticipant(index, { presencaConfirmada: event.target.checked })} /> Presença confirmada</label>
                        {modalMode !== "view" && <button className="icon-button" type="button" disabled={saving} aria-label={`Remover participante ${index + 1}`} onClick={() => setForm((current) => ({ ...current, participantes: current.participantes.filter((_, itemIndex) => itemIndex !== index) }))}><X size={16} /></button>}
                      </div>
                    ))}
                    {modalMode !== "view" && <button className="button button-secondary meeting-add-topic" type="button" disabled={saving || form.participantes.length >= 200} onClick={() => setForm((current) => ({ ...current, participantes: [...current.participantes, { userId: null, nome: "", email: "", presencaConfirmada: false }] }))}><Plus size={15} /> Adicionar participante</button>}
                  </fieldset>
                </div>
              </div>
              <footer className="meeting-form-footer">
                {modalMode === "view" ? (
                  <button className="button button-secondary" type="button" onClick={() => setModalMode(null)}>Fechar</button>
                ) : (
                  <>
                    <button className="button button-secondary" type="button" disabled={saving} onClick={() => setModalMode(null)}>Cancelar</button>
                    <button className="button button-secondary" type="submit" value="rascunho" disabled={saving}><FileText size={15} /> Salvar Rascunho</button>
                    <button className="button button-secondary" type="submit" value="finalizada" disabled={saving}><Check size={15} /> Finalizar</button>
                    <button className="button button-primary" type="submit" value="enviada" disabled={saving}><Send size={15} /> Salvar e Enviar</button>
                    {saving && <span className="meeting-saving"><LoaderCircle size={15} className="spin" /> Salvando…</span>}
                  </>
                )}
              </footer>
            </form>
          </section>
        </div>
      )}
    </AppFrame>
  );
}
