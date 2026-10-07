"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/app-frame";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

type MeetingStatus = "RASCUNHO" | "AGENDADA" | "REALIZADA" | "CANCELADA";
type Confirmation = "PENDENTE" | "CONFIRMADO" | "RECUSADO";
type UserOption = { id: string; nome: string; email: string };
type Participant = {
  key: string;
  tipo: "INTERNO" | "EXTERNO";
  userId: string;
  nome: string;
  email: string;
  confirmacao?: Confirmation;
};
type MeetingAttachment = {
  id: string;
  nome: string;
  url: string;
  tamanho: number | null;
  mimeType: string | null;
  createdAt: string;
};
type MeetingAgenda = {
  id: string;
  titulo: string;
  dataHora: string;
  localOuLink: string | null;
  privada: boolean;
  pauta: unknown;
  status: MeetingStatus;
  criadorId: string;
  criador: { id: string; nome: string };
  participantes: Array<Participant & { id: string }>;
  anexos: MeetingAttachment[];
};
type PendingMeetingAttachment = { key: string; file: File; nome: string };

const statuses: MeetingStatus[] = ["RASCUNHO", "AGENDADA", "REALIZADA", "CANCELADA"];
const emptyForm = {
  titulo: "",
  dataHora: "",
  localOuLink: "",
  privada: false,
  pauta: [] as string[],
  status: "AGENDADA" as MeetingStatus,
  participantes: [] as Participant[],
};

function localDateTime(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function readAgendaTopics(value: unknown) {
  return Array.isArray(value) ? value.filter((topic): topic is string => typeof topic === "string") : [];
}

function formatSize(size: number | null) {
  if (size === null) return "Tamanho não informado";
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function statusLabel(status: MeetingStatus) {
  return {
    RASCUNHO: "Rascunho",
    AGENDADA: "Agendada",
    REALIZADA: "Realizada",
    CANCELADA: "Cancelada",
  }[status];
}

export function MeetingAgendasPage() {
  const { hasPermission, user } = useAuthPermissions();
  const canCreate = hasPermission("reunioes", "criar");
  const canEdit = hasPermission("reunioes", "editar");
  const canDelete = hasPermission("reunioes", "excluir");
  const [agendas, setAgendas] = useState<MeetingAgenda[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingAgenda | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingAttachments, setPendingAttachments] = useState<PendingMeetingAttachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadAgendas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reunioes/agendas", { cache: "no-store" });
      const result = await response.json() as { agendas?: MeetingAgenda[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as agendas.");
      setAgendas(result.agendas ?? []);
    } catch (loadError) {
      console.error("Falha ao carregar agendas:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as agendas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial remote loading applies state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAgendas();
  }, [loadAgendas]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/reunioes/usuarios", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { usuarios?: UserOption[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os usuários.");
        setUsers(result.usuarios ?? []);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          console.error("Falha ao carregar usuários para reuniões:", loadError);
          setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os usuários.");
        }
      });
    return () => controller.abort();
  }, []);

  const orderedAgendas = useMemo(() => [...agendas].sort((left, right) => (
    new Date(left.dataHora).getTime() - new Date(right.dataHora).getTime()
  )), [agendas]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, dataHora: localDateTime(new Date()) });
    setPendingAttachments([]);
    setError("");
    setModalOpen(true);
  }

  function openEdit(agenda: MeetingAgenda) {
    setEditing(agenda);
    setForm({
      titulo: agenda.titulo,
      dataHora: localDateTime(new Date(agenda.dataHora)),
      localOuLink: agenda.localOuLink ?? "",
      privada: agenda.privada,
      pauta: readAgendaTopics(agenda.pauta),
      status: agenda.status,
      participantes: agenda.participantes.map((participant) => ({
        key: crypto.randomUUID(),
        tipo: participant.tipo,
        userId: participant.userId ?? "",
        nome: participant.nome,
        email: participant.email,
        confirmacao: participant.confirmacao,
      })),
    });
    setPendingAttachments([]);
    setError("");
    setModalOpen(true);
  }

  function updateParticipant(key: string, updates: Partial<Participant>) {
    setForm((current) => ({
      ...current,
      participantes: current.participantes.map((participant) => participant.key === key
        ? { ...participant, ...updates }
        : participant),
    }));
  }

  function selectInternalParticipant(key: string, userId: string) {
    const selected = users.find((candidate) => candidate.id === userId);
    updateParticipant(key, {
      userId,
      nome: selected?.nome ?? "",
      email: selected?.email ?? "",
    });
  }

  function addParticipant(tipo: Participant["tipo"] = "INTERNO") {
    setForm((current) => ({
      ...current,
      participantes: [...current.participantes, {
        key: crypto.randomUUID(),
        tipo,
        userId: "",
        nome: "",
        email: "",
      }],
    }));
  }

  function addTopic() {
    setForm((current) => ({ ...current, pauta: [...current.pauta, ""] }));
  }

  function moveTopic(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= form.pauta.length) return;
    setForm((current) => {
      const pauta = [...current.pauta];
      [pauta[index], pauta[target]] = [pauta[target], pauta[index]];
      return { ...current, pauta };
    });
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    setPendingAttachments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        key: crypto.randomUUID(),
        file,
        nome: file.name.replace(/\.[^.]+$/, "") || file.name,
      })),
    ]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function saveAgenda(event: FormEvent<HTMLFormElement>, action: "save" | "draft" | "send") {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const status: MeetingStatus = action === "draft" ? "RASCUNHO" : action === "send" ? "AGENDADA" : form.status;
      if (action === "send" && form.participantes.length === 0) {
        throw new Error("Adicione pelo menos um participante antes de enviar convites.");
      }
      const payload = {
        titulo: form.titulo,
        dataHora: new Date(form.dataHora).toISOString(),
        localOuLink: form.localOuLink.trim() || null,
        privada: form.privada,
        pauta: form.pauta.map((topic) => topic.trim()).filter(Boolean),
        status,
        participantes: form.participantes.map(({ tipo, userId, nome, email }) => ({
          tipo,
          userId: tipo === "INTERNO" ? userId : null,
          nome,
          email,
        })),
      };
      const response = await fetch(editing
        ? `/api/reunioes/agendas/${editing.id}`
        : "/api/reunioes/agendas", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { agenda?: MeetingAgenda; error?: string };
      if (!response.ok || !result.agenda) throw new Error(result.error ?? "Não foi possível salvar a agenda.");
      const agenda = result.agenda;
      setEditing(agenda);
      if (pendingAttachments.length) {
        const data = new FormData();
        data.set("names", JSON.stringify(pendingAttachments.map(({ nome }) => nome)));
        for (const attachment of pendingAttachments) data.append("files", attachment.file);
        const upload = await fetch(`/api/reunioes/agendas/${agenda.id}/anexos`, { method: "POST", body: data });
        const uploadResult = await upload.json() as { anexos?: MeetingAttachment[]; error?: string };
        if (!upload.ok) throw new Error(`A agenda foi salva, mas os anexos não foram enviados. ${uploadResult.error ?? "Tente novamente."}`);
        const attachments = uploadResult.anexos ?? [];
        setEditing((current) => current ? { ...current, anexos: [...current.anexos, ...attachments] } : current);
        setAgendas((current) => current.map((item) => item.id === agenda.id
          ? { ...item, anexos: [...item.anexos, ...attachments] }
          : item));
        setPendingAttachments([]);
      }
      if (action === "send") {
        const mailResponse = await fetch(`/api/reunioes/agendas/${agenda.id}/notificar`, { method: "POST" });
        const mailResult = await mailResponse.json() as {
          enviados?: number;
          total?: number;
          falhas?: Array<{ email: string; error: string }>;
          error?: string;
        };
        if (!mailResponse.ok) {
          const details = mailResult.falhas?.map(({ email, error: reason }) => `${email}: ${reason}`).join(" · ");
          throw new Error(`A agenda foi salva como agendada, mas houve falha no envio dos convites. ${details ?? mailResult.error ?? "Verifique a configuração SMTP."}`);
        }
        setNotice(`${mailResult.enviados ?? 0} de ${mailResult.total ?? 0} convites enviados.`);
      } else {
        setNotice(action === "draft" ? "Rascunho salvo. Nenhum e-mail foi enviado." : "Agenda salva.");
      }
      setModalOpen(false);
      await loadAgendas();
    } catch (saveError) {
      console.error("Falha ao salvar ou enviar agenda de reunião:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a agenda.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAgenda(agenda: MeetingAgenda) {
    if (!window.confirm(`Excluir a agenda "${agenda.titulo}"?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/reunioes/agendas/${agenda.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível excluir a agenda.");
      setNotice("Agenda excluída.");
      await loadAgendas();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a agenda.");
    }
  }

  async function removeAttachment(agendaId: string, attachment: MeetingAttachment) {
    try {
      const response = await fetch(`/api/reunioes/agendas/${agendaId}/anexos/${attachment.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível excluir o anexo.");
      setAgendas((current) => current.map((agenda) => agenda.id === agendaId
        ? { ...agenda, anexos: agenda.anexos.filter(({ id }) => id !== attachment.id) }
        : agenda));
      if (editing?.id === agendaId) {
        setEditing((current) => current ? {
          ...current,
          anexos: current.anexos.filter(({ id }) => id !== attachment.id),
        } : current);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o anexo.");
    }
  }

  return (
    <AppFrame section="Agendas" breadcrumbParent="Reuniões & Súmulas">
      <div className="page-wrap meeting-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><CalendarDays size={15} /> REUNIÕES & SÚMULAS</div>
            <h1>Agendas de Reuniões</h1>
            <p>Organize pautas, participantes, convites e confirmações de presença.</p>
          </div>
          {canCreate && <button className="button button-primary" type="button" onClick={openCreate}><CirclePlus size={17} /> Nova Agenda</button>}
        </div>
        {notice && <div className="feedback success-feedback" role="status"><CheckCircle2 size={17} />{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {error && !modalOpen && <div className="feedback error-feedback" role="alert"><AlertCircle size={17} />{error}<button type="button" aria-label="Fechar erro" onClick={() => setError("")}><X size={16} /></button></div>}
        {loading ? <div className="meeting-loading"><LoaderCircle size={19} className="spin" /> Carregando agendas…</div> : orderedAgendas.length === 0 ? (
          <section className="meeting-empty"><CalendarDays size={28} /><h2>Nenhuma reunião cadastrada</h2><p>As agendas que você pode visualizar aparecerão aqui.</p>{canCreate && <button className="button button-secondary" type="button" onClick={openCreate}><Plus size={16} /> Criar primeira agenda</button>}</section>
        ) : (
          <div className="meeting-agenda-list">
            {orderedAgendas.map((agenda) => {
              const canManage = canEdit && agenda.criadorId === user?.id;
              const topics = readAgendaTopics(agenda.pauta);
              return (
                <article className="meeting-agenda-card" key={agenda.id}>
                  <div className="meeting-agenda-card-main">
                    <div className="meeting-card-heading">
                      <div><h2>{agenda.titulo}</h2>{agenda.privada && <span className="meeting-private-badge">Privada</span>}</div>
                      <span className={`meeting-status meeting-status-${agenda.status.toLowerCase()}`}>{statusLabel(agenda.status)}</span>
                    </div>
                    <div className="meeting-card-details">
                      <span><CalendarDays size={16} />{new Date(agenda.dataHora).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bahia" })}</span>
                      {agenda.localOuLink && <span><MapPin size={16} />{agenda.localOuLink}</span>}
                      <span><Users size={16} />{agenda.participantes.length} participante{agenda.participantes.length === 1 ? "" : "s"}</span>
                      {agenda.anexos.length > 0 && <span><Paperclip size={16} />{agenda.anexos.length} anexo{agenda.anexos.length === 1 ? "" : "s"}</span>}
                    </div>
                    {topics.length > 0 && <ol className="meeting-agenda-topics">{topics.map((topic, index) => <li key={`${index}-${topic}`}>{topic}</li>)}</ol>}
                    <div className="meeting-participant-pills">
                      {agenda.participantes.map((participant) => {
                        const confirmation = participant.confirmacao ?? "PENDENTE";
                        return (
                          <span key={participant.id} className={`meeting-confirmation meeting-confirmation-${confirmation.toLowerCase()}`}>
                            {participant.nome}<small>{confirmation === "PENDENTE" ? "Pendente" : confirmation === "CONFIRMADO" ? "Confirmado" : "Recusado"}</small>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="meeting-card-actions">
                    {canManage && <button className="icon-button" type="button" aria-label={`Editar ${agenda.titulo}`} title="Editar" onClick={() => openEdit(agenda)}><Pencil size={17} /></button>}
                    {canDelete && agenda.criadorId === user?.id && <button className="icon-button" type="button" aria-label={`Excluir ${agenda.titulo}`} title="Excluir" onClick={() => void removeAgenda(agenda)}><Trash2 size={17} /></button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {modalOpen && (
        <div className="modal-backdrop task-modal-backdrop meeting-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section className="create-modal task-modal meeting-modal" role="dialog" aria-modal="true" aria-labelledby="meeting-modal-title">
            <header className="task-modal-header">
              <span className="modal-icon"><CalendarDays size={22} /></span>
              <div><h2 id="meeting-modal-title">{editing ? "Editar Agenda" : "Nova Agenda de Reunião"}</h2><p>Defina os detalhes, participantes e pauta da reunião.</p></div>
              <button className="icon-button" type="button" aria-label="Fechar agenda" disabled={saving} onClick={() => setModalOpen(false)}><X size={18} /></button>
            </header>
            <form onSubmit={(event) => {
              const action = (event.nativeEvent as SubmitEvent).submitter;
              const requestedAction = action instanceof HTMLButtonElement ? action.value : "save";
              void saveAgenda(event, requestedAction === "draft" ? "draft" : requestedAction === "send" ? "send" : "save");
            }}>
              <div className="task-form-body meeting-form-body">
                {error && <div className="feedback error-feedback meeting-form-error" role="alert"><AlertCircle size={17} />{error}</div>}
                <div className="meeting-form-grid">
                  <label className="form-label meeting-form-wide">Título
                    <input className="form-input" required maxLength={240} value={form.titulo} onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))} disabled={saving} />
                  </label>
                  <label className="form-label">Data e horário
                    <input className="form-input" type="datetime-local" required value={form.dataHora} onChange={(event) => setForm((current) => ({ ...current, dataHora: event.target.value }))} disabled={saving} />
                  </label>
                  <label className="form-label">Status
                    <select className="form-input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MeetingStatus }))} disabled={saving}>
                      {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                    </select>
                  </label>
                  <label className="form-label meeting-form-wide">Local ou link
                    <input className="form-input" maxLength={500} placeholder="Sala, endereço ou link da reunião" value={form.localOuLink} onChange={(event) => setForm((current) => ({ ...current, localOuLink: event.target.value }))} disabled={saving} />
                  </label>
                  <label className="task-private-toggle meeting-private-toggle">
                    <input type="checkbox" checked={form.privada} onChange={(event) => setForm((current) => ({ ...current, privada: event.target.checked }))} disabled={saving} />
                    <span><strong>Reunião privada</strong><small>Visível apenas para quem criou e participantes internos convocados.</small></span>
                  </label>

                  <fieldset className="meeting-fieldset meeting-form-wide">
                    <legend>Participantes</legend>
                    {form.participantes.map((participant, index) => (
                      <div className="meeting-participant-row" key={participant.key}>
                        <label className="meeting-participant-type">Tipo
                          <select className="form-input" value={participant.tipo} disabled={saving} onChange={(event) => updateParticipant(participant.key, {
                            tipo: event.target.value as Participant["tipo"],
                            userId: "",
                            nome: "",
                            email: "",
                          })}>
                            <option value="INTERNO">Interno</option><option value="EXTERNO">Externo</option>
                          </select>
                        </label>
                        {participant.tipo === "INTERNO" ? (
                          <>
                          <label className="meeting-participant-user">Servidor interno
                            <select className="form-input" required value={participant.userId} disabled={saving} onChange={(event) => selectInternalParticipant(participant.key, event.target.value)}>
                              <option value="">Selecione um usuário ativo</option>
                              {users.filter((candidate) => candidate.id === participant.userId || !form.participantes.some((other) => other.key !== participant.key && other.tipo === "INTERNO" && other.userId === candidate.id)).map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>{candidate.nome} · {candidate.email}</option>
                              ))}
                            </select>
                          </label>
                          <label className="meeting-participant-readonly">Nome
                            <input className="form-input" value={participant.nome} readOnly placeholder="Preenchido pelo cadastro" />
                          </label>
                          <label className="meeting-participant-readonly">E-mail
                            <input className="form-input" type="email" value={participant.email} readOnly placeholder="Preenchido pelo cadastro" />
                          </label>
                          </>
                        ) : (
                          <>
                            <label className="meeting-participant-user">Nome
                              <input className="form-input" required maxLength={160} value={participant.nome} disabled={saving} onChange={(event) => updateParticipant(participant.key, { nome: event.target.value })} />
                            </label>
                            <label className="meeting-participant-email">E-mail
                              <input className="form-input" type="email" required maxLength={254} value={participant.email} disabled={saving} onChange={(event) => updateParticipant(participant.key, { email: event.target.value })} />
                            </label>
                          </>
                        )}
                        <button className="icon-button meeting-remove-participant" type="button" disabled={saving} aria-label={`Remover participante ${index + 1}`} title="Remover participante" onClick={() => setForm((current) => ({ ...current, participantes: current.participantes.filter(({ key }) => key !== participant.key) }))}><X size={16} /></button>
                      </div>
                    ))}
                    <div className="meeting-participant-add-actions">
                      <button className="button button-secondary" type="button" disabled={saving} onClick={() => addParticipant("INTERNO")}><Plus size={15} /> Interno</button>
                      <button className="button button-secondary" type="button" disabled={saving} onClick={() => addParticipant("EXTERNO")}><Plus size={15} /> Externo</button>
                    </div>
                  </fieldset>

                  <fieldset className="meeting-fieldset meeting-form-wide">
                    <legend>Pauta da reunião</legend>
                    {form.pauta.length === 0 && <p className="meeting-field-hint">Adicione os tópicos na ordem em que serão tratados.</p>}
                    <ol className="meeting-topic-list">
                      {form.pauta.map((topic, index) => (
                        <li key={`topic-${index}`}>
                          <span className="meeting-topic-number">{index + 1}.</span>
                          <input className="form-input" aria-label={`Tópico ${index + 1}`} maxLength={500} required value={topic} onChange={(event) => setForm((current) => ({ ...current, pauta: current.pauta.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} disabled={saving} />
                          <button className="icon-button" type="button" disabled={saving || index === 0} aria-label={`Mover tópico ${index + 1} para cima`} onClick={() => moveTopic(index, -1)}><ChevronUp size={16} /></button>
                          <button className="icon-button" type="button" disabled={saving || index === form.pauta.length - 1} aria-label={`Mover tópico ${index + 1} para baixo`} onClick={() => moveTopic(index, 1)}><ChevronDown size={16} /></button>
                          <button className="icon-button" type="button" disabled={saving} aria-label={`Remover tópico ${index + 1}`} onClick={() => setForm((current) => ({ ...current, pauta: current.pauta.filter((_, itemIndex) => itemIndex !== index) }))}><X size={16} /></button>
                        </li>
                      ))}
                    </ol>
                    <button className="button button-secondary meeting-add-topic" type="button" disabled={saving || form.pauta.length >= 100} onClick={addTopic}><Plus size={15} /> Adicionar tópico</button>
                  </fieldset>

                  <fieldset className="meeting-fieldset meeting-form-wide">
                    <legend>Anexos da pauta</legend>
                    <div className="meeting-upload-line">
                      <p>Inclua documentos de referência para os participantes.</p>
                      <input ref={fileInput} className="visually-hidden" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv" onChange={(event) => addFiles(event.target.files)} />
                      <button className="button button-secondary" type="button" disabled={saving} onClick={() => fileInput.current?.click()}><Upload size={15} /> Anexar arquivos</button>
                    </div>
                    {editing?.anexos.map((attachment) => (
                      <div className="meeting-attachment-row" key={attachment.id}>
                        <FileText size={17} />
                        <span><strong>{attachment.nome}</strong><small>{formatSize(attachment.tamanho)}</small></span>
                        <a className="icon-button" href={`/api/reunioes/agendas/${editing.id}/anexos/${attachment.id}?inline=true`} target="_blank" rel="noopener noreferrer" aria-label={`Visualizar ${attachment.nome}`} title="Visualizar"><Eye size={16} /></a>
                        <a className="icon-button" href={`/api/reunioes/agendas/${editing.id}/anexos/${attachment.id}`} aria-label={`Baixar ${attachment.nome}`} title="Baixar"><Download size={16} /></a>
                        {canEdit && <button className="icon-button" type="button" disabled={saving} aria-label={`Excluir ${attachment.nome}`} onClick={() => void removeAttachment(editing.id, attachment)}><Trash2 size={16} /></button>}
                      </div>
                    ))}
                    {pendingAttachments.map((attachment) => (
                      <div className="meeting-attachment-row meeting-attachment-pending" key={attachment.key}>
                        <FileText size={17} />
                        <label><span className="visually-hidden">Nome do anexo {attachment.file.name}</span><input className="form-input" maxLength={180} required value={attachment.nome} disabled={saving} onChange={(event) => setPendingAttachments((current) => current.map((item) => item.key === attachment.key ? { ...item, nome: event.target.value } : item))} /><small>{attachment.file.name} · {formatSize(attachment.file.size)}</small></label>
                        <button className="icon-button" type="button" disabled={saving} aria-label={`Remover ${attachment.file.name}`} onClick={() => setPendingAttachments((current) => current.filter(({ key }) => key !== attachment.key))}><X size={16} /></button>
                      </div>
                    ))}
                  </fieldset>
                </div>
              </div>
              <footer className="meeting-form-footer">
                <button className="button button-secondary" type="button" disabled={saving} onClick={() => setModalOpen(false)}>Cancelar</button>
                <button className="button button-secondary" type="submit" value="draft" disabled={saving}><FileText size={15} /> Salvar Rascunho</button>
                <button className="button button-secondary" type="submit" value="save" disabled={saving}>{editing ? "Salvar alterações" : "Salvar agenda"}</button>
                <button className="button button-primary" type="submit" value="send" disabled={saving}><Send size={15} /> Salvar e Enviar</button>
                {saving && <span className="meeting-saving"><LoaderCircle size={15} className="spin" /> Salvando…</span>}
              </footer>
            </form>
          </section>
        </div>
      )}
    </AppFrame>
  );
}
