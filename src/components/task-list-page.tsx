"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FilePlus2,
  Filter,
  Handshake,
  ListChecks,
  ListTodo,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Search,
  Columns3,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { AppFrame } from "@/components/app-frame";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

const statusOptions = [
  { value: "NAO_INICIADO", label: "Não Iniciado" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "PENDENTE_COORDENACAO", label: "Pendente Coordenação" },
  { value: "CONCLUIDO", label: "Concluído" },
  { value: "ARQUIVADA", label: "Arquivada" },
] as const;
const kanbanStatuses = statusOptions.filter(({ value }) => value !== "ARQUIVADA");
const priorityOptions = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "URGENTE", label: "Urgente" },
] as const;

type TaskStatus = (typeof statusOptions)[number]["value"];
type TaskPriority = (typeof priorityOptions)[number]["value"];
type UserOption = { id: string; nome: string };
type UnitOption = { id: string; nome: string; sigla: string };
type CategoryOption = { id: string; sigla: string; nome: string; cor: string };
type TaskAttachment = {
  id: string;
  nome: string;
  nomeOriginal: string;
  url: string;
  mimeType: string | null;
  tamanho: number | null;
  taskId: string;
  enviadoPorId: string | null;
  createdAt: string;
  enviadoPor: UserOption | null;
};
type PendingAttachment = { id: string; file: File; nome: string; previewUrl: string | null };
type Task = {
  id: string;
  numero: number;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  notasImportantes: string | null;
  privada: boolean;
  status: TaskStatus;
  prioridade: TaskPriority;
  categoria: string | null;
  categoriaId: string | null;
  category: CategoryOption | null;
  progresso: number;
  prazo: string | null;
  dataTarefa: string;
  responsavelId: string | null;
  criadorId: string;
  unidadeId: string | null;
  unidadesCompartilhadas: string[];
  colaboradoresIds: string[];
  createdAt: string;
  anexosCount: number;
  responsavel: UserOption | null;
  criador: UserOption;
  unidade: UnitOption | null;
};
type TaskForm = {
  titulo: string;
  dataTarefa: string;
  privada: boolean;
  unidadeId: string;
  unidadesCompartilhadas: string[];
  descricao: string;
  responsavelId: string;
  prazo: string;
  status: TaskStatus;
  categoriaId: string;
  prioridade: TaskPriority;
  progresso: number;
  notasImportantes: string;
  colaboradoresIds: string[];
};
type TaskOptions = {
  usuarios: UserOption[];
  unidades: UnitOption[];
  categorias: CategoryOption[];
};
type TaskResponse = {
  tarefas: Task[];
  pagina: number;
  porPagina: number;
  total: number;
  paginas: number;
  contagens: Record<TaskStatus, number>;
  opcoes: TaskOptions;
  error?: string;
};
type MyTasksTab = "atribuídas" | "ondeColaboro" | "criadasPorMim";
type MyTasksResponse = {
  tarefas: Record<MyTasksTab, Task[]>;
  contagens: Record<MyTasksTab, number>;
  opcoes: TaskOptions;
  error?: string;
};

const initialOptions: TaskOptions = { usuarios: [], unidades: [], categorias: [] };
const emptyCounts = Object.fromEntries(statusOptions.map(({ value }) => [value, 0])) as Record<TaskStatus, number>;
const subscribeToClientReady = () => () => {};
const getClientReady = () => true;
const getServerClientReady = () => false;
const emptyForm: TaskForm = {
  titulo: "",
  dataTarefa: dateTimeLocalValue(new Date()),
  privada: false,
  unidadeId: "",
  unidadesCompartilhadas: [],
  descricao: "",
  responsavelId: "",
  prazo: "",
  status: "NAO_INICIADO",
  categoriaId: "",
  prioridade: "MEDIA",
  progresso: 0,
  notasImportantes: "",
  colaboradoresIds: [],
};

function dateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function formatFileSize(size: number | null) {
  if (size === null) return "Tamanho indisponível";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function releasePendingPreviews(attachments: PendingAttachment[]) {
  for (const { previewUrl } of attachments) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }
}

function attachmentIcon(fileName: string) {
  const extension = fileName.split(".").pop()?.toLocaleLowerCase("en-US");
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension ?? "")) return FileImage;
  if (["xls", "xlsx", "ods", "csv"].includes(extension ?? "")) return FileSpreadsheet;
  if (["pdf", "doc", "docx", "ppt", "pptx", "odt", "txt"].includes(extension ?? "")) return FileText;
  return File;
}

async function uploadPendingAttachments(taskId: string, attachments: PendingAttachment[]) {
  if (attachments.length === 0) return;
  const formData = new FormData();
  formData.set("taskId", taskId);
  formData.set("names", JSON.stringify(attachments.map(({ nome }) => nome)));
  for (const attachment of attachments) formData.append("files", attachment.file);
  const response = await fetch(`/api/upload?taskId=${encodeURIComponent(taskId)}`, { method: "POST", body: formData });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Não foi possível enviar os anexos.");
}

function getStatusLabel(status: TaskStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function getPriorityLabel(priority: TaskPriority) {
  return priorityOptions.find((option) => option.value === priority)?.label ?? priority;
}

function categoryBadgeStyle(category: CategoryOption | null): CSSProperties | undefined {
  if (!category) return undefined;
  return {
    color: category.cor,
    borderColor: category.cor,
    backgroundColor: `${category.cor}1A`,
  };
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR")).join("");
}

function isOverdue(task: Task) {
  return task.prazo !== null &&
    new Date(task.prazo).getTime() < Date.now() &&
    task.status !== "CONCLUIDO" &&
    task.status !== "ARQUIVADA";
}

function notifyAssignedTaskCountRefresh() {
  window.dispatchEvent(new Event("interdin-task-count-refresh"));
}

export function TaskListPage({ view = "list" }: { view?: "list" | "kanban" }) {
  const { hasPermission, user } = useAuthPermissions();
  const canCreate = hasPermission("tarefas", "criar");
  const canEdit = hasPermission("tarefas", "editar");
  const canView = hasPermission("tarefas", "visualizar");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState(emptyCounts);
  const [options, setOptions] = useState(initialOptions);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [attachmentTask, setAttachmentTask] = useState<Task | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [movingTaskIds, setMovingTaskIds] = useState<Set<string>>(() => new Set());
  const portalReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReady,
    getServerClientReady,
  );

  const query = useMemo(() => {
    const params = new URLSearchParams({ pagina: String(page), porPagina: view === "kanban" ? "100" : "12" });
    if (search.trim()) params.set("busca", search.trim());
    if (view === "list") {
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("categoria", categoryFilter);
      if (responsibleFilter) params.set("responsavelId", responsibleFilter);
      if (unitFilter) params.set("unidadeId", unitFilter);
      if (dateFrom) params.set("dataDe", dateFrom);
      if (dateTo) params.set("dataAte", dateTo);
    } else {
      params.set("ocultarArquivadas", "true");
    }
    return params.toString();
  }, [page, search, statusFilter, categoryFilter, responsibleFilter, unitFilter, dateFrom, dateTo, view]);

  const loadTasks = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/tarefas?${query}`, { signal, cache: "no-store" });
      const payload = await response.json() as TaskResponse;
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as tarefas.");
      setTasks(payload.tarefas);
      setCounts(payload.contagens);
      setOptions(payload.opcoes);
      setPages(payload.paginas);
      setTotal(payload.total);
    } catch (loadError) {
      if (signal.aborted) return;
      console.error("Falha ao carregar tarefas:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as tarefas.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadTasks(controller.signal), 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadTasks]);

  function openCreate() {
    setEditingTask(null);
    setViewingTask(null);
    setForm({
      ...emptyForm,
      dataTarefa: dateTimeLocalValue(new Date()),
      unidadeId: user?.unidadeId ?? "",
      responsavelId: user?.id ?? "",
    });
    releasePendingPreviews(pendingAttachments);
    setPendingAttachments([]);
    setError("");
    setModalOpen(true);
  }

  function openTask(task: Task, readOnly: boolean) {
    const taskCategory = task.category;
    setEditingTask(readOnly ? null : task);
    setViewingTask(readOnly ? task : null);
    releasePendingPreviews(pendingAttachments);
    setPendingAttachments([]);
    setForm({
      titulo: task.titulo,
      dataTarefa: dateTimeLocalValue(new Date(task.dataTarefa)),
      privada: task.privada,
      unidadeId: task.unidadeId ?? "",
      unidadesCompartilhadas: task.unidadesCompartilhadas,
      descricao: task.descricao ?? "",
      responsavelId: !readOnly && !user?.podeAtribuirParaOutros
        ? user?.id ?? ""
        : task.responsavelId ?? "",
      prazo: task.prazo ? dateTimeLocalValue(new Date(task.prazo)) : "",
      status: task.status,
      categoriaId: task.categoriaId ?? "",
      prioridade: task.prioridade,
      progresso: task.progresso,
      notasImportantes: task.notasImportantes ?? "",
      colaboradoresIds: task.colaboradoresIds,
    });
    if (taskCategory) {
      setOptions((current) => current.categorias.some(({ id }) => id === taskCategory.id)
        ? current
        : { ...current, categorias: [...current.categorias, taskCategory] });
    }
    setError("");
    setModalOpen(true);
  }

  function updateForm<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateResponsible(responsavelId: string) {
    setForm((current) => ({
      ...current,
      responsavelId,
      colaboradoresIds: current.colaboradoresIds.filter((id) => id !== responsavelId),
    }));
  }

  function toggleSelection(key: "unidadesCompartilhadas" | "colaboradoresIds", id: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((selected) => selected !== id)
        : [...current[key], id],
    }));
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        colaboradoresIds: user?.podeConvidarColaboradores ? form.colaboradoresIds : undefined,
        categoriaId: form.categoriaId || null,
        responsavelId: form.responsavelId || null,
        unidadeId: form.unidadeId || null,
        prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
        dataTarefa: new Date(form.dataTarefa).toISOString(),
      };
      const response = await fetch(editingTask ? `/api/tarefas/${editingTask.id}` : "/api/tarefas", {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { tarefa?: Task; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar a tarefa.");
      const savedTask = result.tarefa;
      const taskId = editingTask?.id ?? savedTask?.id;
      if (!taskId) throw new Error("A resposta da API não contém a tarefa salva.");
      if (!editingTask && savedTask) setEditingTask(savedTask);
      if (pendingAttachments.length > 0) {
        try {
          await uploadPendingAttachments(taskId, pendingAttachments);
          releasePendingPreviews(pendingAttachments);
          setPendingAttachments([]);
        } catch (uploadError) {
          throw new Error(`A tarefa foi salva, mas os anexos não foram enviados. ${uploadError instanceof Error ? uploadError.message : ""} Tente salvar novamente para reenviar.`);
        }
      }
      setModalOpen(false);
      notifyAssignedTaskCountRefresh();
      setNotice(editingTask ? "Tarefa atualizada com sucesso." : "Tarefa criada com sucesso.");
      const controller = new AbortController();
      await loadTasks(controller.signal);
    } catch (saveError) {
      console.error("Falha ao salvar tarefa:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  function setStatus(status: string) {
    setPage(1);
    setStatusFilter((current) => current === status ? "" : status);
  }

  async function moveTask(task: Task, nextStatus: TaskStatus) {
    if (!canEdit || task.status === nextStatus || movingTaskIds.has(task.id)) return;
    const previousStatus = task.status;
    setError("");
    setMovingTaskIds((current) => new Set(current).add(task.id));
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    setCounts((current) => ({
      ...current,
      [previousStatus]: Math.max(0, current[previousStatus] - 1),
      [nextStatus]: current[nextStatus] + 1,
    }));
    try {
      const response = await fetch(`/api/tarefas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json() as { tarefa?: Task; error?: string };
      if (!response.ok || !result.tarefa) {
        throw new Error(result.error ?? "Não foi possível mover a tarefa.");
      }
      setTasks((current) => current.map((item) => item.id === task.id ? result.tarefa! : item));
      notifyAssignedTaskCountRefresh();
    } catch (moveError) {
      console.error("Falha ao mover tarefa no quadro:", moveError);
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: previousStatus } : item));
      setCounts((current) => ({
        ...current,
        [previousStatus]: current[previousStatus] + 1,
        [nextStatus]: Math.max(0, current[nextStatus] - 1),
      }));
      setError(moveError instanceof Error ? moveError.message : "Não foi possível mover a tarefa.");
    } finally {
      setMovingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  const activeFilters = [statusFilter, categoryFilter, responsibleFilter, unitFilter, dateFrom, dateTo].filter(Boolean).length;

  return (
    <AppFrame section={view === "kanban" ? "Quadro Kanban" : "Todas as Tarefas"} breadcrumbParent="Tarefas">
      <div className="page-wrap task-page">
        <div className="page-heading task-page-heading">
          <div>
            <div className="eyebrow">{view === "kanban" ? <Columns3 size={15} /> : <ListChecks size={15} />} GESTÃO DE TAREFAS</div>
            <h1>{view === "kanban" ? "Quadro Kanban" : "Tarefas"}</h1>
            <p>{view === "kanban" ? "Acompanhe e mova tarefas entre as etapas." : "Visão completa de todas as tarefas"}</p>
          </div>
          <div className="task-heading-actions">
            {view === "list" && <button className="button button-secondary" type="button" onClick={() => window.print()}>
              <Printer size={17} /> Imprimir Relatório
            </button>}
            {canCreate && (
              <button className="button button-primary" type="button" onClick={openCreate}>
                <Plus size={18} /> Nova Tarefa
              </button>
            )}
          </div>
        </div>

        {notice && <div className="feedback success-feedback" role="status"><CheckCircle2 size={17} />{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {error && !modalOpen && <div className="feedback error-feedback" role="alert"><AlertCircle size={17} />{error}<button type="button" aria-label="Fechar erro" onClick={() => setError("")}><X size={16} /></button></div>}

        {view === "kanban" && (
          <section className="task-filter-card kanban-filter-card" aria-label="Buscar tarefas no quadro">
            <div className="task-filters">
              <label className="task-search-field">
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Buscar por título ou nº do chamado..."
                  value={search}
                  onChange={(event) => { setPage(1); setSearch(event.target.value); }}
                />
              </label>
              <span className="kanban-board-total">{total} {total === 1 ? "tarefa" : "tarefas"}</span>
            </div>
          </section>
        )}

        {view === "list" && <>
        <section className="task-status-grid" aria-label="Resumo por status">
          {statusOptions.map(({ value, label }) => (
            <button
              key={value}
              className={`task-status-card status-${value.toLowerCase()}${statusFilter === value ? " selected" : ""}`}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={statusFilter === value}
            >
              <span>{label}</span>
              <strong>{counts[value]}</strong>
            </button>
          ))}
        </section>
        </>}

        {view === "list" && (
        <section className="task-filter-card" aria-label="Filtros de tarefas">
          <div className="task-filter-heading"><Filter size={17} /><strong>Filtros</strong>{activeFilters > 0 && <span>{activeFilters} ativos</span>}</div>
          <div className="task-filters">
            <label className="task-search-field">
              <Search size={17} />
              <input
                type="search"
                placeholder="Buscar por título ou nº do chamado..."
                value={search}
                onChange={(event) => { setPage(1); setSearch(event.target.value); }}
              />
            </label>
            <label className="filter-select-label">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
                <option value="">Todos</option>
                {statusOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span>Categoria</span>
              <select value={categoryFilter} onChange={(event) => { setPage(1); setCategoryFilter(event.target.value); }}>
                <option value="">Todas</option>
                {options.categorias.map((category) => <option key={category.id} value={category.id} style={{ color: category.cor }}>[{category.sigla}] {category.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span>Responsável</span>
              <select value={responsibleFilter} onChange={(event) => { setPage(1); setResponsibleFilter(event.target.value); }}>
                <option value="">Todos</option>
                {options.usuarios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span>Unidade</span>
              <select value={unitFilter} onChange={(event) => { setPage(1); setUnitFilter(event.target.value); }}>
                <option value="">Todas</option>
                {options.unidades.map((item) => <option key={item.id} value={item.id}>{item.sigla} · {item.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label task-date-filter">
              <span>Data Criação (De)</span>
              <input type="date" value={dateFrom} onChange={(event) => { setPage(1); setDateFrom(event.target.value); }} />
            </label>
            <label className="filter-select-label task-date-filter">
              <span>Data Criação (Até)</span>
              <input type="date" value={dateTo} onChange={(event) => { setPage(1); setDateTo(event.target.value); }} />
            </label>
            {activeFilters > 0 && (
              <button className="task-clear-filters" type="button" onClick={() => {
                setSearch("");
                setStatusFilter("");
                setCategoryFilter("");
                setResponsibleFilter("");
                setUnitFilter("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}>Limpar filtros</button>
            )}
          </div>
        </section>
        )}

        {view === "kanban" ? (
          <section className="kanban-board" aria-label="Quadro de tarefas por status">
            {loading ? (
              <div className="task-list-state kanban-loading"><LoaderCircle className="spin" size={24} />Carregando tarefas...</div>
            ) : kanbanStatuses.map(({ value, label }) => (
              <KanbanColumn
                key={value}
                status={value}
                label={label}
                count={counts[value]}
                tasks={tasks.filter((task) => task.status === value)}
                canView={canView}
                canEdit={canEdit}
                movingTaskIds={movingTaskIds}
                onView={(task) => openTask(task, true)}
                onEdit={(task) => openTask(task, false)}
                onAttachments={setAttachmentTask}
                onMove={moveTask}
              />
            ))}
            {!loading && pages > 1 && (
              <div className="kanban-pagination">
                <span>Exibindo página {page} de {pages} ({tasks.length} de {total} tarefas)</span>
                <div>
                  <button className="button button-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} />Anterior</button>
                  <button className="button button-secondary" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Próxima<ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </section>
        ) : (
        <section className="task-list-section" aria-label="Lista de tarefas">
          <div className="task-list-title">
            <h2>Todas as Tarefas</h2>
            <span>{total} {total === 1 ? "tarefa" : "tarefas"}</span>
          </div>
          {loading ? (
            <div className="task-list-state"><LoaderCircle className="spin" size={24} />Carregando tarefas...</div>
          ) : tasks.length === 0 ? (
            <div className="task-list-state task-empty-state">
              <span><FilePlus2 size={24} /></span>
              <strong>Nenhuma tarefa encontrada</strong>
              <p>{search || activeFilters ? "Ajuste os filtros e tente novamente." : "Crie a primeira tarefa para iniciar o acompanhamento."}</p>
              {canCreate && !search && activeFilters === 0 && <button className="button button-primary" type="button" onClick={openCreate}><Plus size={17} />Nova Tarefa</button>}
            </div>
          ) : (
            <div className="task-cards">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} canView={canView} canEdit={canEdit}
                  onView={() => openTask(task, true)} onEdit={() => openTask(task, false)}
                  onAttachments={() => setAttachmentTask(task)} />
              ))}
            </div>
          )}
          {!loading && pages > 1 && (
            <div className="task-pagination">
              <span>Página {page} de {pages}</span>
              <div>
                <button className="icon-button" type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={18} /></button>
                <button className="icon-button" type="button" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}><ChevronRight size={18} /></button>
              </div>
            </div>
          )}
        </section>
        )}
      </div>

      {modalOpen && portalReady && createPortal(
        <TaskModal
          form={form}
          options={options}
          currentUser={user ? { id: user.id, nome: user.nome } : null}
          canAssignToOthers={user?.podeAtribuirParaOutros ?? false}
          canInviteCollaborators={user?.podeConvidarColaboradores ?? false}
          saving={saving}
          error={error}
          readOnly={viewingTask !== null}
          editing={editingTask !== null}
          onClose={() => {
            releasePendingPreviews(pendingAttachments);
            setPendingAttachments([]);
            setModalOpen(false);
            setError("");
            void loadTasks(new AbortController().signal);
          }}
          onChange={updateForm}
          onResponsibleChange={updateResponsible}
          onToggle={toggleSelection}
          taskId={editingTask?.id ?? viewingTask?.id ?? null}
          canManageAttachments={editingTask
            ? canEdit || (canCreate && editingTask.criadorId === user?.id)
            : canCreate}
          canDeleteAttachments={canEdit}
          pendingAttachments={pendingAttachments}
          onPendingAttachmentsChange={setPendingAttachments}
          onSubmit={saveTask}
        />,
        document.body,
      )}
      {attachmentTask && portalReady && createPortal(
        <TaskAttachmentsDialog
          task={attachmentTask}
          canDelete={canEdit}
          onClose={() => {
            setAttachmentTask(null);
            void loadTasks(new AbortController().signal);
          }}
        />,
        document.body,
      )}
    </AppFrame>
  );
}

export function MyTasksPage({ initialTab = "atribuídas" }: { initialTab?: MyTasksTab }) {
  const { user } = useAuthPermissions();
  const { hasPermission } = useAuthPermissions();
  const canEdit = hasPermission("tarefas", "editar");
  const [taskGroups, setTaskGroups] = useState<Record<MyTasksTab, Task[]>>({
    atribuídas: [],
    ondeColaboro: [],
    criadasPorMim: [],
  });
  const [counts, setCounts] = useState<Record<MyTasksTab, number>>({
    atribuídas: 0,
    ondeColaboro: 0,
    criadasPorMim: 0,
  });
  const [options, setOptions] = useState(initialOptions);
  const [activeTab, setActiveTab] = useState<MyTasksTab>(initialTab);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"prazo" | "prioridade" | "recentes">("prazo");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [attachmentTask, setAttachmentTask] = useState<Task | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const portalReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReady,
    getServerClientReady,
  );

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tarefas/minhas", { cache: "no-store", signal });
      const payload = await response.json() as MyTasksResponse;
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar suas tarefas.");
      setTaskGroups(payload.tarefas);
      setCounts(payload.contagens);
      setOptions(payload.opcoes);
    } catch (loadError) {
      if (signal?.aborted) return;
      console.error("Falha ao carregar tarefas do usuário:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar suas tarefas.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadTasks(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadTasks]);

  useEffect(() => {
    const refreshOnFocus = () => void loadTasks();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [loadTasks]);

  const visibleTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    const filtered = taskGroups[activeTab].filter((task) => (
      !normalizedSearch ||
      `${task.titulo} ${task.codigo ?? ""} ${task.category?.sigla ?? ""} ${task.category?.nome ?? task.categoria ?? ""} ${task.criador.nome} ${task.responsavel?.nome ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch)
    ));
    return [...filtered].sort((left, right) => {
      if (sort === "prioridade") {
        const priorities = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };
        return priorities[left.prioridade] - priorities[right.prioridade]
          || compareTaskDeadlines(left, right);
      }
      if (sort === "recentes") {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
      return compareTaskDeadlines(left, right);
    });
  }, [activeTab, search, sort, taskGroups]);

  function openTask(task: Task, readOnly: boolean) {
    setEditingTask(readOnly ? null : task);
    setViewingTask(readOnly ? task : null);
    releasePendingPreviews(pendingAttachments);
    setPendingAttachments([]);
    setForm({
      titulo: task.titulo,
      dataTarefa: dateTimeLocalValue(new Date(task.dataTarefa)),
      privada: task.privada,
      unidadeId: task.unidadeId ?? "",
      unidadesCompartilhadas: task.unidadesCompartilhadas,
      descricao: task.descricao ?? "",
      responsavelId: !readOnly && !user?.podeAtribuirParaOutros
        ? user?.id ?? ""
        : task.responsavelId ?? "",
      prazo: task.prazo ? dateTimeLocalValue(new Date(task.prazo)) : "",
      status: task.status,
      categoriaId: task.categoriaId ?? "",
      prioridade: task.prioridade,
      progresso: task.progresso,
      notasImportantes: task.notasImportantes ?? "",
      colaboradoresIds: task.colaboradoresIds,
    });
    if (task.category) {
      setOptions((current) => current.categorias.some(({ id }) => id === task.category?.id)
        ? current
        : { ...current, categorias: [...current.categorias, task.category!] });
    }
    setError("");
    setModalOpen(true);
  }

  function updateForm<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateResponsible(responsavelId: string) {
    setForm((current) => ({
      ...current,
      responsavelId,
      colaboradoresIds: current.colaboradoresIds.filter((id) => id !== responsavelId),
    }));
  }

  function toggleSelection(key: "unidadesCompartilhadas" | "colaboradoresIds", id: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((selected) => selected !== id)
        : [...current[key], id],
    }));
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTask) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/tarefas/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          colaboradoresIds: user?.podeConvidarColaboradores ? form.colaboradoresIds : undefined,
          categoriaId: form.categoriaId || null,
          responsavelId: form.responsavelId || null,
          unidadeId: form.unidadeId || null,
          prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
          dataTarefa: new Date(form.dataTarefa).toISOString(),
        }),
      });
      const payload = await response.json() as { tarefa?: Task; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a tarefa.");
      if (pendingAttachments.length > 0) {
        try {
          await uploadPendingAttachments(editingTask.id, pendingAttachments);
          releasePendingPreviews(pendingAttachments);
          setPendingAttachments([]);
        } catch (uploadError) {
          throw new Error(`A tarefa foi atualizada, mas os anexos não foram enviados. ${uploadError instanceof Error ? uploadError.message : ""} Tente salvar novamente para reenviar.`);
        }
      }
      setModalOpen(false);
      notifyAssignedTaskCountRefresh();
      setNotice("Tarefa atualizada com sucesso.");
      await loadTasks();
    } catch (saveError) {
      console.error("Falha ao atualizar tarefa:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível atualizar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: MyTasksTab; label: string; icon: typeof ListTodo }[] = [
    { id: "atribuídas", label: "Atribuídas a Mim", icon: ListTodo },
    { id: "ondeColaboro", label: "Onde Colaboro", icon: Handshake },
    { id: "criadasPorMim", label: "Criadas por Mim", icon: ClipboardList },
  ];
  const emptyMessages: Record<MyTasksTab, string> = {
    atribuídas: "Nenhuma tarefa sob sua responsabilidade no momento.",
    ondeColaboro: "Você ainda não está colaborando em tarefas.",
    criadasPorMim: "Você ainda não criou tarefas.",
  };

  return (
    <AppFrame section="Minhas Tarefas" breadcrumbParent="Tarefas">
      <div className="page-wrap task-page my-tasks-page">
        <div className="page-heading task-page-heading">
          <div>
            <div className="eyebrow"><ListTodo size={15} /> GESTÃO DE TAREFAS</div>
            <h1>Minhas Tarefas</h1>
            <p>Acompanhe responsabilidades, colaborações e tarefas que você criou.</p>
          </div>
        </div>

        {notice && <div className="feedback success-feedback" role="status"><CheckCircle2 size={17} />{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {error && !modalOpen && <div className="feedback error-feedback" role="alert"><AlertCircle size={17} />{error}<button type="button" aria-label="Fechar erro" onClick={() => setError("")}><X size={16} /></button></div>}

        <div className="my-task-tabs" role="tablist" aria-label="Grupos de tarefas">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`my-task-tab${activeTab === id ? " active" : ""}`}
              type="button"
              id={`my-task-tab-${id}`}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls="my-task-panel"
              onClick={() => setActiveTab(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              <span className="my-task-tab-count" aria-label={`${counts[id]} tarefas ativas`}>{counts[id]}</span>
            </button>
          ))}
        </div>

        <section className="task-filter-card my-task-filter-card" aria-label="Pesquisar e ordenar tarefas">
          <div className="task-filters">
            <label className="task-search-field">
              <Search size={17} />
              <input type="search" placeholder="Buscar por título, código ou categoria..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label className="my-task-sort">
              <span>Ordenar por</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="prazo">Prazo mais próximo</option>
                <option value="prioridade">Maior prioridade</option>
                <option value="recentes">Mais recentes</option>
              </select>
            </label>
          </div>
        </section>

        <section id="my-task-panel" role="tabpanel" aria-labelledby={`my-task-tab-${activeTab}`}>
          <div className="task-list-title">
            <h2>{tabs.find(({ id }) => id === activeTab)?.label}</h2>
            <span>{loading ? "Carregando..." : `${visibleTasks.length} ${visibleTasks.length === 1 ? "tarefa" : "tarefas"}`}</span>
          </div>
          {loading ? (
            <div className="task-list-state"><LoaderCircle className="spin" size={24} />Carregando suas tarefas...</div>
          ) : visibleTasks.length > 0 ? (
            <div className="task-cards">
              {visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canView
                  canEdit={canEdit}
                  onView={() => openTask(task, true)}
                  onEdit={() => openTask(task, false)}
                  onAttachments={() => setAttachmentTask(task)}
                />
              ))}
            </div>
          ) : (
            <div className="task-list-state task-empty-state">
              <span><ListTodo size={23} /></span>
              <strong>{search ? "Nenhuma tarefa encontrada" : emptyMessages[activeTab]}</strong>
              {search && <p>Tente alterar os termos da busca.</p>}
            </div>
          )}
        </section>
      </div>

      {modalOpen && portalReady && createPortal(
        <TaskModal
          form={form}
          options={options}
          currentUser={user ? { id: user.id, nome: user.nome } : null}
          canAssignToOthers={user?.podeAtribuirParaOutros ?? false}
          canInviteCollaborators={user?.podeConvidarColaboradores ?? false}
          saving={saving}
          error={error}
          readOnly={viewingTask !== null}
          editing={editingTask !== null}
          onClose={() => {
            releasePendingPreviews(pendingAttachments);
            setPendingAttachments([]);
            setModalOpen(false);
            setError("");
            void loadTasks();
          }}
          onChange={updateForm}
          onResponsibleChange={updateResponsible}
          onToggle={toggleSelection}
          taskId={editingTask?.id ?? viewingTask?.id ?? null}
          canManageAttachments={Boolean(editingTask && canEdit)}
          canDeleteAttachments={canEdit}
          pendingAttachments={pendingAttachments}
          onPendingAttachmentsChange={setPendingAttachments}
          onSubmit={saveTask}
        />,
        document.body,
      )}
      {attachmentTask && portalReady && createPortal(
        <TaskAttachmentsDialog
          task={attachmentTask}
          canDelete={canEdit}
          onClose={() => {
            setAttachmentTask(null);
            void loadTasks();
          }}
        />,
        document.body,
      )}
    </AppFrame>
  );
}

function compareTaskDeadlines(left: Task, right: Task) {
  if (!left.prazo && !right.prazo) return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  if (!left.prazo) return 1;
  if (!right.prazo) return -1;
  return new Date(left.prazo).getTime() - new Date(right.prazo).getTime();
}

function TaskCard({ task, canView, canEdit, onView, onEdit, onAttachments }: {
  task: Task;
  canView: boolean;
  canEdit: boolean;
  onView: () => void;
  onEdit: () => void;
  onAttachments: () => void;
}) {
  return (
    <article className={`task-card status-border-${task.status.toLowerCase()}`}>
      <div className="task-card-main">
        <div className="task-card-topline">
          <span className="task-code">{task.codigo ?? `#${task.numero}`}</span>
          <span className={`task-status-badge status-badge-${task.status.toLowerCase()}`}>{getStatusLabel(task.status)}</span>
          {(task.category || task.categoria) && <span className="task-category-badge" style={categoryBadgeStyle(task.category)}>{task.category ? `[${task.category.sigla}] ${task.category.nome}` : task.categoria}</span>}
          <span className={`task-priority-badge priority-${task.prioridade.toLowerCase()}`}>{getPriorityLabel(task.prioridade)}</span>
          {task.unidade && <span className="task-unit-badge">{task.unidade.sigla}</span>}
          {task.privada && <span className="task-private-badge"><ShieldAlert size={13} /> Privada</span>}
          {task.anexosCount > 0 && <span className="task-attachment-count"><Paperclip size={13} /> {task.anexosCount}</span>}
          {(canView || canEdit) && (
            <div className="task-card-actions">
              {canView && <button type="button" className="icon-button" aria-label={`Ver anexos de ${task.titulo}`} title={`Ver Anexos (${task.anexosCount})`} onClick={onAttachments}><Paperclip size={16} /></button>}
              {canView && <button type="button" className="icon-button" aria-label={`Visualizar ${task.titulo}`} title="Visualizar" onClick={onView}><Eye size={17} /></button>}
              {canEdit && <button type="button" className="icon-button" aria-label={`Editar ${task.titulo}`} title="Editar" onClick={onEdit}><Pencil size={16} /></button>}
            </div>
          )}
        </div>
        <h3>{task.titulo}</h3>
        {task.descricao && <p className="task-description">{task.descricao}</p>}
        <div className="task-progress">
          <div className="task-progress-label"><span>Progresso</span><strong>{task.progresso}%</strong></div>
          <div className="task-progress-track" role="progressbar" aria-valuenow={task.progresso} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso da tarefa ${task.titulo}`}>
            <span style={{ width: `${task.progresso}%` }} />
          </div>
        </div>
        <div className="task-card-footer">
          <div className="task-card-person">
            <span className="task-avatar">{initials(task.criador.nome)}</span>
            <span><small>CRIADO POR</small><strong>{task.criador.nome}</strong></span>
          </div>
          <div className="task-card-date"><small>CRIADA EM</small><strong>{formatDate(task.createdAt)}</strong></div>
          <div className={`task-card-date task-deadline${isOverdue(task) ? " overdue" : ""}`}>
            <small>PRAZO</small>
            <strong>{formatDate(task.prazo)}</strong>
            {isOverdue(task) && <span><AlertCircle size={13} /> Atrasada</span>}
          </div>
          {task.responsavel && <div className="task-card-date task-card-responsible"><small>RESPONSÁVEL</small><strong>{task.responsavel.nome}</strong></div>}
        </div>
      </div>
    </article>
  );
}

function KanbanColumn({
  status,
  label,
  count,
  tasks,
  canView,
  canEdit,
  movingTaskIds,
  onView,
  onEdit,
  onAttachments,
  onMove,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  tasks: Task[];
  canView: boolean;
  canEdit: boolean;
  movingTaskIds: Set<string>;
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onAttachments: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
}) {
  const statusIndex = kanbanStatuses.findIndex((item) => item.value === status);
  return (
    <section className={`kanban-column kanban-column-${status.toLowerCase()}`} aria-label={`${label}: ${count} tarefas`}>
      <header className="kanban-column-header">
        <span className="kanban-column-marker" />
        <h2>{label}</h2>
        <span className="kanban-column-count">{count}</span>
      </header>
      <div className="kanban-column-content">
        {tasks.length === 0 ? (
          <div className="kanban-column-empty">Nenhuma tarefa nesta etapa.</div>
        ) : tasks.map((task) => (
          <article className={`kanban-task-card${movingTaskIds.has(task.id) ? " is-moving" : ""}`} key={task.id}>
            <div className="kanban-task-topline">
              <span className="task-code">{task.codigo ?? `#${task.numero}`}</span>
              <span className={`task-priority-badge priority-${task.prioridade.toLowerCase()}`}>{getPriorityLabel(task.prioridade)}</span>
              {task.anexosCount > 0 && <span className="task-attachment-count"><Paperclip size={12} /> {task.anexosCount}</span>}
            </div>
            <h3>{task.titulo}</h3>
            {(task.category || task.categoria) && <span className="task-category-badge kanban-category" style={categoryBadgeStyle(task.category)}>{task.category ? `[${task.category.sigla}] ${task.category.nome}` : task.categoria}</span>}
            <div className="kanban-task-meta">
              {task.responsavel ? (
                <span className="kanban-assignee" title={task.responsavel.nome}>
                  <span className="task-avatar">{initials(task.responsavel.nome)}</span>
                  <span>{task.responsavel.nome}</span>
                </span>
              ) : (
                <span className="kanban-assignee kanban-unassigned">Sem responsável</span>
              )}
              <span className={`kanban-deadline${isOverdue(task) ? " overdue" : ""}`}>
                <CalendarDays size={13} /> {formatDate(task.prazo)}
              </span>
            </div>
            <div className="kanban-task-actions">
              {(canView || canEdit) && (
                <div className="kanban-open-actions">
                  {canView && <button className="icon-button" type="button" aria-label={`Visualizar ${task.titulo}`} title="Visualizar" onClick={() => onView(task)}><Eye size={15} /></button>}
                  {canView && <button className="icon-button" type="button" aria-label={`Ver anexos de ${task.titulo}`} title={`Ver Anexos (${task.anexosCount})`} onClick={() => onAttachments(task)}><Paperclip size={15} /></button>}
                  {canEdit && <button className="icon-button" type="button" aria-label={`Editar ${task.titulo}`} title="Editar" onClick={() => onEdit(task)}><Pencil size={15} /></button>}
                </div>
              )}
              {canEdit && (
                <div className="kanban-move-actions" aria-label={`Mover ${task.titulo}`}>
                  {statusIndex > 0 && (
                    <button
                      className="kanban-move-button"
                      type="button"
                      aria-label={`Mover ${task.titulo} para ${kanbanStatuses[statusIndex - 1].label}`}
                      title={`Mover para ${kanbanStatuses[statusIndex - 1].label}`}
                      disabled={movingTaskIds.has(task.id)}
                      onClick={() => onMove(task, kanbanStatuses[statusIndex - 1].value)}
                    ><ArrowLeft size={15} /></button>
                  )}
                  {statusIndex < kanbanStatuses.length - 1 && (
                    <button
                      className="kanban-move-button"
                      type="button"
                      aria-label={`Mover ${task.titulo} para ${kanbanStatuses[statusIndex + 1].label}`}
                      title={`Mover para ${kanbanStatuses[statusIndex + 1].label}`}
                      disabled={movingTaskIds.has(task.id)}
                      onClick={() => onMove(task, kanbanStatuses[statusIndex + 1].value)}
                    ><ArrowRight size={15} /></button>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TaskAttachmentPanel({
  taskId,
  allowUpload,
  allowDelete,
  pending,
  onPendingChange,
  disabled = false,
}: {
  taskId: string | null;
  allowUpload: boolean;
  allowDelete: boolean;
  pending: PendingAttachment[];
  onPendingChange: (attachments: PendingAttachment[]) => void;
  disabled?: boolean;
}) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState("");
  const [attachmentNames, setAttachmentNames] = useState<Record<string, string>>({});
  const [savingAttachmentIds, setSavingAttachmentIds] = useState<Set<string>>(() => new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!taskId) return;
    const controller = new AbortController();
    void fetch(`/api/tarefas/${taskId}/anexos`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { anexos?: TaskAttachment[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os anexos.");
        setAttachments(result.anexos ?? []);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os anexos.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [taskId]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const added = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      nome: file.name.replace(/\.[^.]+$/, "") || file.name,
      previewUrl: /\.(png|jpe?g|gif|webp)$/i.test(file.name) ? URL.createObjectURL(file) : null,
    }));
    onPendingChange([...pending, ...added]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removeAttachment(attachment: TaskAttachment) {
    if (!taskId) return;
    setError("");
    try {
      const response = await fetch(`/api/tarefas/${taskId}/anexos/${attachment.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível excluir o anexo.");
      setAttachments((current) => current.filter(({ id }) => id !== attachment.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Não foi possível excluir o anexo.");
    }
  }

  async function saveAttachmentName(attachment: TaskAttachment) {
    if (!taskId) return;
    const nome = (attachmentNames[attachment.id] ?? attachment.nome).trim();
    if (!nome || nome.length > 180 || nome === attachment.nome) return;
    setError("");
    setSavingAttachmentIds((current) => new Set(current).add(attachment.id));
    try {
      const response = await fetch(`/api/tarefas/${taskId}/anexos/${attachment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const result = await response.json() as { anexo?: TaskAttachment; error?: string };
      if (!response.ok || !result.anexo) {
        throw new Error(result.error ?? "Não foi possível atualizar o nome do anexo.");
      }
      setAttachments((current) => current.map((item) => item.id === attachment.id ? result.anexo! : item));
      setAttachmentNames((current) => {
        const next = { ...current };
        delete next[attachment.id];
        return next;
      });
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Não foi possível atualizar o nome do anexo.");
    } finally {
      setSavingAttachmentIds((current) => {
        const next = new Set(current);
        next.delete(attachment.id);
        return next;
      });
    }
  }

  return (
    <section className="task-attachments-section" aria-label="Arquivos anexados">
      <div className="task-attachments-heading">
        <div><Paperclip size={17} /><strong>Arquivos Anexados</strong></div>
        {allowUpload && (
          <>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.ods"
              onChange={(event) => addFiles(event.target.files)}
            />
            <button className="button button-secondary task-attachment-add" type="button" onClick={() => fileInput.current?.click()}>
              <Upload size={15} /> Anexar Arquivos
            </button>
          </>
        )}
      </div>

      {error && <p className="task-attachment-error" role="alert">{error}</p>}
      {loading && <p className="task-attachment-empty">Carregando anexos...</p>}
      {!loading && taskId && attachments.length === 0 && pending.length === 0 && (
        <p className="task-attachment-empty">Nenhum arquivo anexado.</p>
      )}
      {attachments.length > 0 && (
        <ul className="task-attachment-list">
          {attachments.map((attachment) => {
            const Icon = attachmentIcon(attachment.nomeOriginal);
            const href = `/api/tarefas/${taskId}/anexos/${attachment.id}`;
            return (
              <li key={attachment.id} className="task-attachment-item">
                <Icon size={19} />
                <div className="task-attachment-copy">
                  {allowDelete ? (
                    <input
                      className="form-input task-attachment-name-input"
                      aria-label={`Nome descritivo de ${attachment.nome}`}
                      value={attachmentNames[attachment.id] ?? attachment.nome}
                      maxLength={180}
                      disabled={disabled || savingAttachmentIds.has(attachment.id)}
                      onChange={(event) => setAttachmentNames((current) => ({ ...current, [attachment.id]: event.target.value }))}
                    />
                  ) : <strong title={attachment.nome}>{attachment.nome}</strong>}
                  <small>{formatFileSize(attachment.tamanho)} · {formatDate(attachment.createdAt, true)}{attachment.enviadoPor ? ` · ${attachment.enviadoPor.nome}` : ""}</small>
                </div>
                <a href={`${href}?inline=true`} target="_blank" rel="noopener noreferrer" aria-label={`Visualizar ${attachment.nome}`} title="Visualizar"><Eye size={16} /></a>
                <a href={href} download={attachment.nomeOriginal} aria-label={`Baixar ${attachment.nome}`} title="Download"><Download size={16} /></a>
                {allowDelete && (attachmentNames[attachment.id] ?? attachment.nome).trim() !== attachment.nome && (
                  <button
                    type="button"
                    disabled={disabled || savingAttachmentIds.has(attachment.id) || !(attachmentNames[attachment.id] ?? "").trim()}
                    onClick={() => void saveAttachmentName(attachment)}
                    aria-label={`Salvar nome de ${attachment.nome}`}
                    title="Salvar nome"
                  ><Check size={16} /></button>
                )}
                {allowDelete && <button type="button" disabled={disabled} onClick={() => void removeAttachment(attachment)} aria-label={`Excluir ${attachment.nome}`} title="Excluir"><Trash2 size={16} /></button>}
              </li>
            );
          })}
        </ul>
      )}
      {pending.length > 0 && (
        <ul className="task-attachment-list task-attachment-pending">
          {pending.map(({ id, file, nome, previewUrl }) => {
            const Icon = attachmentIcon(file.name);
            return (
              <li key={id} className="task-attachment-item">
                {previewUrl ? (
                  <Image className="task-attachment-preview" src={previewUrl} alt={`Pré-visualização de ${file.name}`} width={48} height={48} unoptimized />
                ) : <Icon size={19} />}
                <label className="task-attachment-copy">
                  <span className="visually-hidden">Nome descritivo de {file.name}</span>
                  <input
                    className="form-input"
                    value={nome}
                    maxLength={180}
                    required
                    disabled={disabled}
                    onChange={(event) => onPendingChange(pending.map((item) => item.id === id ? { ...item, nome: event.target.value } : item))}
                  />
                  <small>{file.name} · {formatFileSize(file.size)}</small>
                </label>
                <button type="button" disabled={disabled} onClick={() => {
                  const removed = pending.find((item) => item.id === id);
                  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
                  onPendingChange(pending.filter((item) => item.id !== id));
                }} aria-label={`Remover ${file.name} da fila`} title="Remover arquivo"><X size={16} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TaskAttachmentsDialog({
  task,
  canDelete,
  onClose,
}: {
  task: Task;
  canDelete: boolean;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop task-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="create-modal task-attachments-dialog" role="dialog" aria-modal="true" aria-labelledby="task-attachments-title">
        <header className="task-modal-header">
          <span className="modal-icon"><Paperclip size={21} /></span>
          <div><h2 id="task-attachments-title">Anexos da tarefa</h2><p>{task.codigo ?? `#${task.numero}`} · {task.titulo}</p></div>
          <button className="icon-button" type="button" aria-label="Fechar anexos" onClick={onClose}><X size={18} /></button>
        </header>
        <TaskAttachmentPanel
          key={task.id}
          taskId={task.id}
          allowUpload={false}
          allowDelete={canDelete}
          pending={[]}
          onPendingChange={() => {}}
        />
      </section>
    </div>
  );
}

function TaskModal({
  form,
  options,
  currentUser,
  canAssignToOthers,
  canInviteCollaborators,
  saving,
  error,
  readOnly,
  editing,
  onClose,
  onChange,
  onResponsibleChange,
  onToggle,
  taskId,
  canManageAttachments,
  canDeleteAttachments,
  pendingAttachments,
  onPendingAttachmentsChange,
  onSubmit,
}: {
  form: TaskForm;
  options: TaskOptions;
  currentUser: UserOption | null;
  canAssignToOthers: boolean;
  canInviteCollaborators: boolean;
  saving: boolean;
  error: string;
  readOnly: boolean;
  editing: boolean;
  onClose: () => void;
  onChange: <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => void;
  onResponsibleChange: (responsavelId: string) => void;
  onToggle: (key: "unidadesCompartilhadas" | "colaboradoresIds", id: string) => void;
  taskId: string | null;
  canManageAttachments: boolean;
  canDeleteAttachments: boolean;
  pendingAttachments: PendingAttachment[];
  onPendingAttachmentsChange: (attachments: PendingAttachment[]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const disabled = readOnly || saving;
  return (
    <div className="modal-backdrop task-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="create-modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <header className="task-modal-header">
          <span className="modal-icon"><ListChecks size={22} /></span>
          <div>
            <h2 id="task-modal-title">{readOnly ? "Visualizar tarefa" : editing ? "Editar tarefa" : "Nova Tarefa"}</h2>
            <p>{readOnly ? "Detalhes e acompanhamento da tarefa." : "Preencha os dados para registrar a tarefa."}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Fechar formulário" onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="task-form-body">
            <div className="task-form-grid">
            <label className="form-label task-form-title">Título da Tarefa
              <input className="form-input" value={form.titulo} onChange={(event) => onChange("titulo", event.target.value)} maxLength={240} required disabled={disabled} />
            </label>
            <label className="task-private-toggle">
              <input type="checkbox" checked={form.privada} onChange={(event) => onChange("privada", event.target.checked)} disabled={disabled} />
              <span><strong>Tarefa privada</strong><small>Somente criador, responsável e colaboradores.</small></span>
            </label>
            <label className="form-label task-form-half">Data da Tarefa
              <input className="form-input" type="datetime-local" value={form.dataTarefa} onChange={(event) => onChange("dataTarefa", event.target.value)} required disabled={disabled} />
            </label>
            <label className="form-label task-form-half">Data/Hora de Entrega
              <input className="form-input" type="datetime-local" value={form.prazo} onChange={(event) => onChange("prazo", event.target.value)} disabled={disabled} />
            </label>
            <label className="form-label task-form-wide w-full">Unidade principal
              <select className="form-input w-full" value={form.unidadeId} onChange={(event) => onChange("unidadeId", event.target.value)} disabled={disabled}>
                <option value="">Sem unidade</option>
                {options.unidades.map((unit) => <option key={unit.id} value={unit.id}>{unit.sigla} · {unit.nome}</option>)}
              </select>
            </label>
            <fieldset className="task-choice-fieldset task-form-wide">
              <legend>Unidades com acesso compartilhado</legend>
              {options.unidades.length === 0 ? <small>Nenhuma unidade ativa disponível.</small> : (
                <div className="task-choice-grid">
                  {options.unidades.map((unit) => (
                    <label key={unit.id} className="task-choice">
                      <input type="checkbox" checked={form.unidadesCompartilhadas.includes(unit.id)} onChange={() => onToggle("unidadesCompartilhadas", unit.id)} disabled={disabled || form.privada} />
                      <span>{unit.sigla} · {unit.nome}</span>
                    </label>
                  ))}
                </div>
              )}
              {form.privada && <small>O compartilhamento por unidade não altera a visibilidade de uma tarefa privada.</small>}
            </fieldset>
            <label className="form-label task-form-wide">Descrição
              <textarea className="form-input form-textarea task-description-input" value={form.descricao} onChange={(event) => onChange("descricao", event.target.value)} disabled={disabled} />
            </label>
            <label className="form-label">Responsável
              <select className="form-input" value={form.responsavelId} onChange={(event) => onResponsibleChange(event.target.value)} disabled={disabled || (!canAssignToOthers && !readOnly)}>
                {canAssignToOthers || readOnly
                  ? <option value="">Não definido</option>
                  : currentUser && <option value={currentUser.id}>{currentUser.nome}</option>}
                {(canAssignToOthers || readOnly) && options.usuarios.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}
              </select>
            </label>
            <label className="form-label">Categoria
              <select className="form-input" value={form.categoriaId} onChange={(event) => onChange("categoriaId", event.target.value)} disabled={disabled}>
                <option value="">Sem categoria</option>
                {options.categorias.map((category) => <option key={category.id} value={category.id} style={{ color: category.cor }}>[{category.sigla}] {category.nome}</option>)}
              </select>
            </label>
            <label className="form-label">Prioridade
              <select className="form-input" value={form.prioridade} onChange={(event) => onChange("prioridade", event.target.value as TaskPriority)} disabled={disabled}>
                {priorityOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="form-label">Status
              <select className="form-input" value={form.status} onChange={(event) => onChange("status", event.target.value as TaskStatus)} disabled={disabled}>
                {statusOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="form-label task-form-wide task-progress-input">Progresso
              <strong>{form.progresso}%</strong>
              <input type="range" min="0" max="100" step="1" value={form.progresso} onChange={(event) => onChange("progresso", Number(event.target.value))} disabled={disabled} />
            </label>
            {canInviteCollaborators && <fieldset className="task-choice-fieldset task-form-wide">
              <legend>Colaboradores</legend>
              {options.usuarios.length === 0 ? <small>Nenhum usuário ativo disponível.</small> : (
                <>
                  <div className="task-selected-users">
                    {form.colaboradoresIds.map((id) => {
                      const person = options.usuarios.find((userOption) => userOption.id === id);
                      return person ? (
                        <span className="task-selected-user" key={id}>
                          {person.nome}
                          {!disabled && <button type="button" aria-label={`Remover ${person.nome} dos colaboradores`} onClick={() => onToggle("colaboradoresIds", id)}><X size={13} /></button>}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <div className="task-choice-grid">
                    {options.usuarios.filter((person) => person.id !== form.responsavelId).map((person) => (
                      <label key={person.id} className="task-choice">
                        <input type="checkbox" checked={form.colaboradoresIds.includes(person.id)} onChange={() => onToggle("colaboradoresIds", person.id)} disabled={disabled} />
                        <span>{person.nome}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </fieldset>}
            <label className="form-label task-form-wide">Notas Importantes / Observações
              <textarea className="form-input form-textarea task-notes-input" value={form.notasImportantes} onChange={(event) => onChange("notasImportantes", event.target.value)} disabled={disabled} />
            </label>
            <div className="task-form-wide">
              <TaskAttachmentPanel
                key={taskId ?? "new-task"}
                taskId={taskId}
                allowUpload={canManageAttachments && !disabled}
                allowDelete={canDeleteAttachments && !disabled}
                pending={pendingAttachments}
                onPendingChange={onPendingAttachmentsChange}
                disabled={saving}
              />
            </div>
            </div>
          </div>
          {error && <div className="feedback error-feedback task-modal-error" role="alert"><AlertCircle size={17} />{error}</div>}
          <div className="modal-actions task-modal-actions">
            <button className="button button-secondary" type="button" onClick={onClose}>{readOnly ? "Fechar" : "Cancelar"}</button>
            {!readOnly && <button className="button button-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : editing ? <Check size={16} /> : <Plus size={16} />}{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar Tarefa"}</button>}
          </div>
        </form>
      </section>
    </div>
  );
}
